/**
 * THE C1RCLE - Master Order Engine (Phase 1)
 * Centralizes order lifecycle, validation, and status transitions.
 * Location: packages/core/order-engine.js
 */

import { randomUUID } from "node:crypto";

const ORDER_SEQUENCE_COLLECTION = "system_counters";
const ORDER_SEQUENCE_DOC_ID = "orders";

function formatOrderNumber(orderIndex) {
    return `#${String(orderIndex).padStart(8, "0")}`;
}

async function assignOrderSequence(transaction, db) {
    const sequenceRef = db.collection(ORDER_SEQUENCE_COLLECTION).doc(ORDER_SEQUENCE_DOC_ID);
    const sequenceDoc = await transaction.get(sequenceRef);
    const currentValue = Number(sequenceDoc.data()?.lastOrderIndex || 0);
    const nextValue = currentValue + 1;

    return {
        sequenceRef,
        nextValue,
        orderIndex: nextValue,
        orderNumber: formatOrderNumber(nextValue)
    };
}

/**
 * Validates if an order can be placed based on global and user-specific limits.
 */
export async function validateOrder(event, items, userContext, options = {}) {
    const { existingTicketCount = 0, hasExistingRSVP = false, userGender = "any" } = userContext;
    const { isRSVP = false } = event;

    const totalRequested = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const eventTickets = Array.isArray(event?.tickets)
        ? event.tickets
        : (Array.isArray(event?.ticketCatalog?.tiers) ? event.ticketCatalog.tiers : []);

    const normalizeGenderRequirement = (ticket = {}) => {
        const explicitRequirement = String(
            ticket.genderRequirement ||
            ticket.requiredGender ||
            ticket.gender ||
            ""
        ).toLowerCase();

        if (explicitRequirement === "female" || explicitRequirement === "male" || explicitRequirement === "couple") {
            return explicitRequirement;
        }

        const entryType = String(ticket.entryType || "").toLowerCase();
        if (entryType === "female") return "female";
        if (entryType === "stag" || entryType === "male") return "male";

        return "any";
    };

    // 1. RSVP Specific Rules
    if (isRSVP) {
        if (totalRequested !== 1) {
            return { success: false, error: "RSVP is limited to 1 person per registration" };
        }
        if (hasExistingRSVP) {
            return { success: false, error: "You have already RSVP'd for this event" };
        }
    }

    // 2. Global Order Limits (Paid)
    const minTickets = event.minTicketsPerOrder || 1;
    const maxTickets = event.maxTicketsPerOrder || 10;

    if (totalRequested < minTickets) {
        return { success: false, error: `Minimum ${minTickets} tickets required per order` };
    }

    if (existingTicketCount + totalRequested > maxTickets) {
        const msg = existingTicketCount > 0
            ? `You have already purchased ${existingTicketCount} tickets. Maximum ${maxTickets} allowed per account.`
            : `Maximum ${maxTickets} tickets allowed per account.`;
        return { success: false, error: msg };
    }

    // 3. Ticket-level restriction checks
    for (const item of items) {
        const eventTicket = eventTickets.find((ticket) => {
            const candidateIds = [ticket?.id, ticket?.ticketId, ticket?.tierId, ticket?.name].filter(Boolean);
            const itemIds = [item?.ticketId, item?.tierId, item?.id, item?.name].filter(Boolean);
            return itemIds.some((value) => candidateIds.includes(value));
        });
        const requiredGender = normalizeGenderRequirement(item) !== "any"
            ? normalizeGenderRequirement(item)
            : normalizeGenderRequirement(eventTicket);

        if (requiredGender !== "any" && requiredGender !== "couple" && userGender !== "any" && userGender !== requiredGender) {
            const tierName = eventTicket?.name || item?.name || "This ticket";
            return {
                success: false,
                error: `${tierName} is restricted to ${requiredGender} attendees only.`,
            };
        }
    }

    return { success: true };
}

/**
 * Generates a consistent Order ID
 */
export function generateOrderId(prefix = "ORD") {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Orchestrates atomic order creation (Firestore Transaction)
 */
export async function executeOrderCreation(transaction, {
    db,
    event,
    orderData,
    reservationId = null,
    inventoryEngine
}) {
    const eventRef = db.collection("events").doc(event.id);
    const orderId = orderData.id;
    const orderRef = db.collection(orderData.isRSVP ? "rsvp_orders" : "orders").doc(orderId);

    // 1. Transaction-level Idempotency
    const existingOrderDoc = await transaction.get(orderRef);
    if (existingOrderDoc.exists) return existingOrderDoc.data();

    const orderSequence =
        orderData.orderIndex && orderData.orderNumber
            ? {
                orderIndex: orderData.orderIndex,
                orderNumber: orderData.orderNumber
            }
            : await assignOrderSequence(transaction, db);

    // 2. Inventory Adjustment
    if (inventoryEngine && !orderData.isRSVP) {
        // If it was reserved, we "convert" the lock. 
        // If not, we deduct directly.
        // This is handled via the inventory engine passed in.
        await inventoryEngine.commitInventory(transaction, {
            event,
            items: orderData.tickets,
            reservationId
        });
    }

    // 3. Status logic
    const status = (orderData.totalAmount === 0 || orderData.isRSVP) ? "confirmed" : "pending_payment";
    if (orderSequence.sequenceRef) {
        transaction.set(
            orderSequence.sequenceRef,
            {
                lastOrderIndex: orderSequence.nextValue,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );
    }

    const finalOrder = {
        ...orderData,
        ...orderSequence,
        status,
        updatedAt: new Date().toISOString()
    };

    if (status === "confirmed") {
        finalOrder.confirmedAt = finalOrder.updatedAt;
    }

    // 4. Persistence
    transaction.set(orderRef, finalOrder);

    // 5. Reservation Conversion
    if (reservationId) {
        const resRef = db.collection("cart_reservations").doc(reservationId);
        transaction.update(resRef, {
            status: 'converted',
            orderId: orderId,
            convertedAt: finalOrder.updatedAt
        });
    }

    return finalOrder;
}

/**
 * Transitions an order to confirmed status after payment
 */
export function prepareOrderConfirmation(order, paymentData) {
    if (order.status === 'confirmed') return null;

    return {
        ...order,
        status: 'confirmed',
        paymentId: paymentData.paymentId,
        paymentSignature: paymentData.signature || null,
        paymentMode: paymentData.mode || 'unknown',
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export default {
    validateOrder,
    generateOrderId,
    executeOrderCreation,
    prepareOrderConfirmation
};

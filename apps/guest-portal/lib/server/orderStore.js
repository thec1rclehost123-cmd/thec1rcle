import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin.js";
import { getEvent } from "./eventStore.js";
import { getPromoterLinkByCode, recordConversion } from "./promoterStore.js";
import { generateOrderQRCodes } from "./qrStore.js";
import {
    recordOrderAuthorized,
    recordOrderCaptured,
    holdOrderRevenue,
    initiateRefund,
    finalizeRefund,
    MONEY_STATES
} from "@c1rcle/core/ledger-engine";
import { validateOrder as coreValidateOrder, executeOrderCreation as coreExecuteOrderCreation, generateOrderId } from "@c1rcle/core/order-engine";
import inventoryEngine from "@c1rcle/core/inventory-engine";
import { sendEvent, Events } from "@c1rcle/core/inngest";
import { buildStoredOrderTicket } from "./ticketingLogic.js";

const ORDERS_COLLECTION = "orders";
const RSVP_COLLECTION = "rsvp_orders";

// In-memory fallback for development without Firebase
let fallbackOrders = [];
let fallbackRSVPs = [];

export const __resetOrderStoreForTests = () => {
    fallbackOrders = [];
    fallbackRSVPs = [];
};

export const __getFallbackOrdersForTests = () => [...fallbackOrders];

export const __getFallbackRSVPsForTests = () => [...fallbackRSVPs];

// Local fallback order ID generator (used in mock/dev env where core engine isn't available).
// Renamed to avoid shadowing the named import from '@c1rcle/core/order-engine'.
const generateLocalOrderId = (prefix = "ORD") => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

const calculateOrderTotal = (tickets) => {
    return tickets.reduce((sum, ticket) => {
        return sum + (Number(ticket.price) || 0) * (Number(ticket.quantity) || 0);
    }, 0);
};

const mapOrderDocument = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };
};

/**
 * Create an RSVP order (strictly for RSVP events)
 */
export async function createRSVPOrder(payload) {
    const {
        eventId,
        tickets,
        userId,
        userEmail,
        userName,
        promoterCode = null,
        reservationId = null // Track reservation for idempotency
    } = payload;

    const event = await getEvent(eventId);
    if (!event || !event.isRSVP) {
        throw new Error("Invalid event for RSVP");
    }

    // Check if an RSVP already exists for this reservation (Idempotency)
    if (reservationId) {
        const existingOrder = await getOrderByReservationId(reservationId);
        if (existingOrder && existingOrder.isRSVP) {
            return existingOrder;
        }
    }

    // RSVPs are strictly 1 ticket per owner across the event
    const totalSelectedQuantity = tickets.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    if (totalSelectedQuantity !== 1) {
        throw new Error("RSVP is limited to 1 person per registration");
    }

    const hasExisting = await checkExistingRSVP(eventId, { userId, email: userEmail });
    if (hasExisting) {
        throw new Error("You have already RSVP'd for this event");
    }

    const orderId = reservationId ? `RSVP-${reservationId}` : generateLocalOrderId("RSVP");
    const now = new Date().toISOString();

    const rsvpOrder = {
        id: orderId,
        reservationId: reservationId,
        eventId,
        venueId: event.venueId || null,
        eventTitle: event.title,
        eventImage: event.image,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        userId: userId || null,
        userEmail: userEmail || "",
        userName: userName || "",
        userPhone: payload.userPhone || "",
        promoterCode: promoterCode || null,
        tickets: tickets.map(t => ({ ...t, price: 0, subtotal: 0 })),
        totalAmount: 0,
        currency: "INR",
        paymentMethod: "free",
        status: "confirmed",
        isRSVP: true,
        createdAt: now,
        updatedAt: now,
        confirmedAt: now
    };

    // Generate QR codes with RSVP metadata
    rsvpOrder.qrCodes = generateOrderQRCodes(rsvpOrder, event);

    // Resolve promoter code if provided
    let promoterLinkId = null;
    if (promoterCode) {
        try {
            const link = await getPromoterLinkByCode(promoterCode);
            if (link) {
                promoterLinkId = link.id;
            }
        } catch (err) {
            console.error("[OrderStore] Failed to resolve promoter code for RSVP:", err);
        }
    }

    if (!isFirebaseConfigured()) {
        fallbackRSVPs.push(rsvpOrder);
        return rsvpOrder;
    }

    const db = getAdminDb();

    await db.runTransaction(async (transaction) => {
        transaction.db = db; // Inject db for unified engine
        await coreExecuteOrderCreation(transaction, {
            db,
            event,
            orderData: rsvpOrder,
            reservationId,
            inventoryEngine
        });

        // MONEY LEDGER INTEGRATION (₹0 RSVP) - ATOMIC
        await recordOrderCaptured(rsvpOrder, "INTERNAL_RSVP", transaction);
        await holdOrderRevenue(rsvpOrder, transaction);
    });

    // Trigger background fulfillment pipeline for RSVP (entitlements, email, analytics).
    sendEvent(Events.TICKET_PURCHASED, {
        orderId: rsvpOrder.id,
        userId: rsvpOrder.userId,
        userEmail: rsvpOrder.userEmail,
        eventId: rsvpOrder.eventId,
        tickets: rsvpOrder.tickets.map(t => ({
            tierId: t.ticketId,
            tierName: t.name,
            quantity: t.quantity,
            entryType: t.entryType || 'general',
        })),
        totalAmount: 0,
        promoterCode: promoterCode || null,
    }, { idempotencyKey: `ticket-purchased-${rsvpOrder.id}` }).catch(err =>
        console.error("[OrderStore] Failed to dispatch TICKET_PURCHASED (RSVP) to Inngest:", err)
    );

    // Fire-and-forget: admission consumption and promoter conversion
    if (reservationId) {
        (async () => {
            const { getReservation } = await import("./checkoutService.js");
            const res = await getReservation(reservationId);
            if (res?.queueId) {
                const { consumeAdmission } = await import("./queueStore.js");
                await consumeAdmission(res.queueId);
            }
        })().catch(err => console.error("[OrderStore] Failed to consume admission for RSVP:", err));
    }

    if (promoterLinkId) {
        recordConversion(promoterLinkId, rsvpOrder.id, 0, rsvpOrder.tickets[0]?.ticketId)
            .catch(err => console.error("[OrderStore] Failed to record promoter RSVP conversion:", err));
    }

    return rsvpOrder;
}

/**
 * Create an order and update ticket inventory atomically
 */
export async function createOrder(payload) {
    const {
        eventId,
        tickets, // Array of { ticketId, quantity }
        userId,
        userEmail,
        userName,
        promoterCode = null,
        paymentMethod = "card",
        reservationId = null, // Track reservation for idempotency
    } = payload;

    // Validate tickets array
    if (!Array.isArray(tickets) || tickets.length === 0) {
        const error = new Error("Tickets must be a non-empty array");
        error.statusCode = 400;
        throw error;
    }

    // Check if an order already exists for this reservation (Idempotency)
    if (reservationId) {
        const existingOrder = await getOrderByReservationId(reservationId);
        if (existingOrder) {
            return existingOrder;
        }
    }

    // Fetch event to validate and get ticket details
    const event = await getEvent(eventId);
    if (!event) {
        const error = new Error(`Event not found: ${eventId}`);
        error.statusCode = 404;
        throw error;
    }

    // Global order limits validation via Core Engine
    const existingTicketCount = await getUserTicketCountForEvent(eventId, { userId, email: userEmail });
    const hasExistingRSVP = await checkExistingRSVP(eventId, { userId, email: userEmail });

    const validation = await coreValidateOrder(event, tickets, {
        existingTicketCount,
        hasExistingRSVP
    });

    if (!validation.success) {
        throw new Error(validation.error);
    }

    // Build order tickets with full details
    const orderTickets = [];
    const ticketUpdates = []; // Track what needs to be updated

    for (const selectedTicket of tickets) {
        const { ticketId, quantity } = selectedTicket;

        if (!ticketId || !quantity || quantity <= 0) {
            const error = new Error("Each ticket must have a valid ticketId and quantity > 0");
            error.statusCode = 400;
            throw error;
        }

        // Find the ticket in the event
        const eventTicket = event.tickets?.find(t => t.id === ticketId);
        if (!eventTicket) {
            const error = new Error(`Ticket not found: ${ticketId}`);
            error.statusCode = 404;
            throw error;
        }

        // Check if enough tickets are available
        const available = Number(eventTicket.remaining ?? eventTicket.quantity) || 0;
        if (available < quantity) {
            throw new Error(
                `Not enough tickets available for "${eventTicket.name}". Requested: ${quantity}, Available: ${available}`
            );
        }

        orderTickets.push(buildStoredOrderTicket(selectedTicket, eventTicket));

        ticketUpdates.push({
            ticketId: eventTicket.id,
            quantity: Number(quantity),
        });
    }

    // Resolve promoter code if provided
    let promoterLinkId = null;
    let promoterDiscount = 0; // Percentage discount for promoter-linked purchases
    if (promoterCode) {
        try {
            const link = await getPromoterLinkByCode(promoterCode);
            if (link) {
                promoterLinkId = link.id;
                promoterDiscount = link.promoterDiscount || 0; // Get discount percentage
            }
        } catch (err) {
            console.error("[OrderStore] Failed to resolve promoter code:", err);
        }
    }

    // Apply promoter discount if applicable
    let discountAmount = 0;
    if (promoterDiscount > 0) {
        const fullSubtotal = calculateOrderTotal(orderTickets);
        discountAmount = Math.round(fullSubtotal * (promoterDiscount / 100));
        // Apply discount proportionally to each ticket
        orderTickets.forEach(ticket => {
            const ticketDiscount = Math.round(ticket.subtotal * (promoterDiscount / 100));
            ticket.discount = ticketDiscount;
            ticket.finalPrice = ticket.subtotal - ticketDiscount;
        });
    }

    const subtotal = calculateOrderTotal(orderTickets);
    // Note: Total amount might be slightly different than pure subtotal - discount due to fees calculated in service
    // But here we use the provided payload total if available to ensure consistency
    const totalAmount = payload.totalAmount !== undefined ? payload.totalAmount : (subtotal - discountAmount);

    // Use reservationId as part of orderId to ensure deterministic creation
    const orderId = reservationId ? `ORD-${reservationId}` : generateOrderId();
    const now = new Date().toISOString();

    const order = {
        id: orderId,
        reservationId: reservationId,
        eventId,
        venueId: event.venueId || null,
        eventTitle: event.title,
        eventImage: event.image,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        userId: userId || null,
        userEmail: userEmail || "",
        userName: userName || "",
        userPhone: payload.userPhone || "",
        promoterCode: promoterCode || null,
        promoterLinkId: promoterLinkId || null,
        promoCodeId: payload.promoCodeId || null,
        promoterDiscount: promoterDiscount || 0,
        discountAmount: discountAmount || 0,
        tickets: orderTickets,
        subtotal,
        totalAmount,
        currency: "INR",
        paymentMethod,
        status: totalAmount === 0 ? "confirmed" : "pending_payment", // Auto-confirm free tickets IN PAID FLOW
        isRSVP: false, // This is a paid event order (even if total is 0)
        qrCodes: null, // Will be populated after confirmation
        createdAt: now,
        updatedAt: now,
    };

    // Generate QR codes if order is auto-confirmed (free tickets)
    if (order.status === "confirmed") {
        order.qrCodes = generateOrderQRCodes(order, event);
    }

    // If Firebase is not configured, use fallback
    if (!isFirebaseConfigured()) {
        // Update fallback event tickets
        const { events: fallbackEvents } = await import("../../data/events.js");
        const eventIndex = (fallbackEvents || []).findIndex(e => e.id === eventId);
        if (eventIndex >= 0) {
            const events = fallbackEvents;
            ticketUpdates.forEach(update => {
                const ticket = events[eventIndex].tickets?.find(t => t.id === update.ticketId);
                if (ticket) {
                    ticket.remaining = Math.max(0, (ticket.remaining ?? ticket.quantity) - update.quantity);
                }
            });
        }

        fallbackOrders.push(order);
        return order;
    }

    // Use Firestore transaction to ensure atomic updates
    const db = getAdminDb();

    try {
        await db.runTransaction(async (transaction) => {
            transaction.db = db; // Inject db for unified engine

            // 1. Transaction-level Idempotency Check
            const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
            const existingOrderDoc = await transaction.get(orderRef);
            if (existingOrderDoc.exists) return existingOrderDoc.data();

            // 2. Execute unified order creation and inventory commitment
            await coreExecuteOrderCreation(transaction, {
                db,
                event,
                orderData: order,
                reservationId,
                inventoryEngine
            });

            // 3. MONEY LEDGER INTEGRATION (ATOMIC)
            if (order.status === "confirmed") {
                // Free tickets/Auto-confirmed
                await recordOrderCaptured(order, "INTERNAL_FREE", transaction);
                await holdOrderRevenue(order, transaction);
            } else {
                // Paid tickets awaiting payment
                await recordOrderAuthorized(order, null, transaction);
            }
        });

        console.log(`Order created successfully: ${orderId}`);

        if (order.status === "confirmed") {
            // Trigger background fulfillment pipeline (entitlements, email, promoter credits, analytics).
            sendEvent(Events.TICKET_PURCHASED, {
                orderId,
                userId: order.userId,
                userEmail: order.userEmail,
                eventId: order.eventId,
                tickets: order.tickets.map(t => ({
                    tierId: t.ticketId,
                    tierName: t.name,
                    quantity: t.quantity,
                    entryType: t.entryType || 'general',
                })),
                totalAmount: order.totalAmount,
                promoterCode: order.promoterCode || null,
            }, { idempotencyKey: `ticket-purchased-${orderId}` }).catch(err =>
                console.error("[OrderStore] Failed to dispatch TICKET_PURCHASED to Inngest:", err)
            );

            // Fire-and-forget: share bundle creation
            (async () => {
                const { createShareBundle } = await import("./ticketShareStore");
                for (const ticket of order.tickets) {
                    await createShareBundle(order.id, order.userId, order.eventId, ticket.quantity, ticket.ticketId);
                }
            })().catch(err => console.error("[OrderStore] Failed to create share bundles:", err));

            // Consumption of admission for auto-confirmed free tickets
            if (reservationId) {
                (async () => {
                    const { getReservation } = await import("./checkoutService.js");
                    const res = await getReservation(reservationId);
                    if (res?.queueId) {
                        const { consumeAdmission } = await import("./queueStore.js");
                        await consumeAdmission(res.queueId);
                    }
                })().catch(err => console.error("[OrderStore] Failed to consume admission for free order:", err));
            }
        }

        return order;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

/**
 * Get order by ID (checks both collections)
 */
export async function getOrderById(orderId) {
    if (!orderId) return null;

    if (!isFirebaseConfigured()) {
        return fallbackOrders.find(o => o.id === orderId) || fallbackRSVPs.find(o => o.id === orderId) || null;
    }

    const db = getAdminDb();

    // Check Paid Orders first
    let doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    if (doc.exists) return mapOrderDocument(doc);

    // Then check RSVP Orders
    doc = await db.collection(RSVP_COLLECTION).doc(orderId).get();
    if (doc.exists) return mapOrderDocument(doc);

    return null;
}

/**
 * Get all orders for a specific user (unified view)
 */
export async function getUserOrders(userId, limit = 50) {
    if (!userId) return [];

    if (!isFirebaseConfigured()) {
        const combined = [...fallbackOrders, ...fallbackRSVPs]
            .filter(o => o.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return combined.slice(0, limit);
    }

    const db = getAdminDb();

    // Fetch from both collections
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        db.collection(ORDERS_COLLECTION).where("userId", "==", userId).limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("userId", "==", userId).limit(limit).get()
    ]);

    const allOrders = [
        ...ordersSnapshot.docs.map(mapOrderDocument),
        ...rsvpsSnapshot.docs.map(mapOrderDocument)
    ];

    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allOrders.slice(0, limit);
}

/**
 * Check if a user already has an RSVP for a specific event
 * Used to enforce 1-ticket-per-user hard limit
 */
export async function checkExistingRSVP(eventId, { userId, email }) {
    if (!eventId || (!userId && !email)) return false;

    if (!isFirebaseConfigured()) {
        return fallbackRSVPs.some(o =>
            o.eventId === eventId &&
            o.status === "confirmed" &&
            ((userId && o.userId === userId) || (email && o.userEmail === email))
        );
    }

    const db = getAdminDb();

    // Check by userId if available
    if (userId) {
        const userSnapshot = await db.collection(RSVP_COLLECTION)
            .where("eventId", "==", eventId)
            .where("userId", "==", userId)
            .where("status", "==", "confirmed")
            .limit(1)
            .get();

        if (!userSnapshot.empty) return true;
    }

    // Check by email to block duplicates across sessions/devices
    if (email) {
        const emailSnapshot = await db.collection(RSVP_COLLECTION)
            .where("eventId", "==", eventId)
            .where("userEmail", "==", email)
            .where("status", "==", "confirmed")
            .limit(1)
            .get();

        if (!emailSnapshot.empty) return true;
    }

    return false;
}

/**
 * Get total confirmed tickets a user has already purchased for an event
 */
export async function getUserTicketCountForEvent(eventId, { userId, email }) {
    if (!eventId || (!userId && !email)) return 0;

    let confirmedOrders = [];

    if (!isFirebaseConfigured()) {
        confirmedOrders = fallbackOrders.filter(o =>
            o.eventId === eventId &&
            o.status === "confirmed" &&
            ((userId && o.userId === userId) || (email && o.userEmail === email))
        );
    } else {
        const db = getAdminDb();
        let query = db.collection(ORDERS_COLLECTION)
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed");

        // We'll perform two separate queries for userId and email to be safe, or if using a complex query
        // For simplicity and correctness with Firestore's limited OR queries, we check both
        const userIdSnapshot = userId ? await query.where("userId", "==", userId).get() : { empty: true, docs: [] };
        const emailSnapshot = email ? await query.where("userEmail", "==", email).get() : { empty: true, docs: [] };

        // Combine unique order documents
        const orderIds = new Set();
        const combinedDocs = [];

        [...userIdSnapshot.docs, ...emailSnapshot.docs].forEach(doc => {
            if (!orderIds.has(doc.id)) {
                orderIds.add(doc.id);
                combinedDocs.push(doc.data());
            }
        });
        confirmedOrders = combinedDocs;
    }

    // Sum up quantity across all tickets in these orders
    return confirmedOrders.reduce((sum, order) => {
        const orderQty = (order.tickets || []).reduce((tSum, t) => tSum + (Number(t.quantity) || 0), 0);
        return sum + orderQty;
    }, 0);
}

/**
 * Get order by reservation ID
 * Used for idempotency to check if an order already exists for a reservation
 */
export async function getOrderByReservationId(reservationId) {
    if (!reservationId) return null;

    if (!isFirebaseConfigured()) {
        return (fallbackOrders || []).find(o => o.reservationId === reservationId) ||
            (fallbackRSVPs || []).find(o => o.reservationId === reservationId) || null;
    }

    const db = getAdminDb();

    // Check Paid Orders first
    const ordersSnapshot = await db.collection(ORDERS_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();

    if (!ordersSnapshot.empty) {
        const doc = ordersSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    // Then check RSVP Orders
    const rsvpsSnapshot = await db.collection(RSVP_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();

    if (!rsvpsSnapshot.empty) {
        const doc = rsvpsSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    return null;
}

/**
 * Get all orders for a specific event
 */
export async function getEventOrders(eventId, limit = 100) {
    if (!eventId) return [];

    if (!isFirebaseConfigured()) {
        const combined = [...fallbackOrders, ...fallbackRSVPs]
            .filter(o => o.eventId === eventId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return combined.slice(0, limit);
    }

    const db = getAdminDb();
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        db.collection(ORDERS_COLLECTION).where("eventId", "==", eventId).limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("eventId", "==", eventId).limit(limit).get()
    ]);

    const allOrders = [
        ...ordersSnapshot.docs.map(mapOrderDocument),
        ...rsvpsSnapshot.docs.map(mapOrderDocument)
    ];

    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allOrders.slice(0, limit);
}

/**
 * Calculate ticket sales statistics for an event
 */
export async function getEventSalesStats(eventId) {
    const orders = await getEventOrders(eventId);

    const stats = {
        totalOrders: orders.length,
        totalRevenue: 0,
        ticketsSold: {},
        totalTicketsSold: 0,
    };

    orders.forEach(order => {
        // Only count Paid orders in Sales Stats; exclude RSVPs
        if (order.status === "confirmed" && !order.isRSVP) {
            stats.totalRevenue += Number(order.totalAmount) || 0;

            order.tickets.forEach(ticket => {
                if (!stats.ticketsSold[ticket.ticketId]) {
                    stats.ticketsSold[ticket.ticketId] = {
                        name: ticket.name,
                        quantity: 0,
                        revenue: 0,
                    };
                }
                stats.ticketsSold[ticket.ticketId].quantity += Number(ticket.quantity);
                stats.ticketsSold[ticket.ticketId].revenue += Number(ticket.subtotal);
                stats.totalTicketsSold += Number(ticket.quantity);
            });
        }
    });

    // Recalculate total orders based on confirmed paid orders only
    stats.totalOrders = orders.filter(o => o.status === "confirmed" && !o.isRSVP).length;

    return stats;
}

/**
 * Cancel an order and restore ticket inventory
 */
export async function cancelOrder(orderId) {
    const order = await getOrderById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status === "cancelled") {
        return order; // Already cancelled
    }

    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const orderIndex = fallbackOrders.findIndex(o => o.id === orderId);
        if (orderIndex >= 0) {
            fallbackOrders[orderIndex].status = "cancelled";
            fallbackOrders[orderIndex].updatedAt = now;

            // Restore ticket inventory
            const events = require("../../data/events").events;
            const eventIndex = events.findIndex(e => e.id === order.eventId);
            if (eventIndex >= 0) {
                order.tickets.forEach(orderTicket => {
                    const ticket = events[eventIndex].tickets?.find(t => t.id === orderTicket.ticketId);
                    if (ticket) {
                        ticket.remaining = (ticket.remaining ?? ticket.quantity) + orderTicket.quantity;
                    }
                });
            }

            return fallbackOrders[orderIndex];
        }
        throw new Error("Order not found");
    }

    const db = getAdminDb();

    await db.runTransaction(async (transaction) => {
        const eventRef = db.collection("events").doc(order.eventId);
        const eventDoc = await transaction.get(eventRef);

        if (eventDoc.exists) {
            const currentEvent = eventDoc.data();
            const updatedTickets = [...(currentEvent.tickets || [])];

            // Restore ticket inventory
            order.tickets.forEach(orderTicket => {
                const ticketIndex = updatedTickets.findIndex(t => t.id === orderTicket.ticketId);
                if (ticketIndex >= 0) {
                    const currentRemaining = Number(updatedTickets[ticketIndex].remaining ?? updatedTickets[ticketIndex].quantity) || 0;
                    updatedTickets[ticketIndex].remaining = currentRemaining + orderTicket.quantity;
                }
            });

            transaction.update(eventRef, {
                tickets: updatedTickets,
                updatedAt: now,
            });
        }

        // Update order status
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        transaction.update(orderRef, {
            status: "cancelled",
            updatedAt: now,
        });

        // VOID BUNDLES & ASSIGNMENTS (Refinement 237)
        const bundlesSnapshot = await transaction.get(
            db.collection("share_bundles").where("orderId", "==", orderId)
        );
        bundlesSnapshot.forEach(bundleDoc => {
            transaction.update(bundleDoc.ref, {
                status: "cancelled",
                updatedAt: now
            });
        });

        const assignmentsSnapshot = await transaction.get(
            db.collection("ticket_assignments").where("orderId", "==", orderId)
        );
        assignmentsSnapshot.forEach(assignmentDoc => {
            transaction.update(assignmentDoc.ref, {
                status: "voided",
                updatedAt: now
            });
        });
        transaction.update(orderRef, {
            status: "cancelled",
            updatedAt: now,
        });

        // ENTITLEMENT ENGINE INTEGRATION
        const entitlementsSnapshot = await transaction.get(
            db.collection("entitlements").where("orderId", "==", orderId)
        );
        entitlementsSnapshot.forEach(entDoc => {
            transaction.update(entDoc.ref, {
                state: "REVOKED",
                revokedAt: now,
                revokedReason: "ORDER_CANCELLED",
                revokedBy: "SYSTEM"
            });
        });
    });

    // MONEY LEDGER INTEGRATION (Async/Retry-safe)
    if (order.totalAmount > 0 && order.status === "confirmed") {
        try {
            await initiateRefund(order.id, order.totalAmount, "Order Cancelled", MONEY_STATES.HELD);
            console.log(`[OrderStore] Refund initiated in ledger for order ${orderId}`);
        } catch (ledgerErr) {
            console.error("[OrderStore] Failed to record refund initiation in ledger:", ledgerErr);
        }
    }

    return { ...order, status: "cancelled", updatedAt: now };
}


/**
 * Update order status (e.g., from Webhook)
 */
export async function updateOrderStatus(orderId, status, paymentDetails = {}) {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");

    const now = new Date().toISOString();
    const updates = {
        status,
        updatedAt: now,
        paymentDetails: {
            ...order.paymentDetails,
            ...paymentDetails
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackOrders.findIndex(o => o.id === orderId);
        if (index >= 0) {
            fallbackOrders[index] = { ...fallbackOrders[index], ...updates };

            // If confirming, trigger email logic (simulated here, usually handled by caller)
            if (status === "confirmed" && order.status !== "confirmed") {
                console.log(`[OrderStore] Order ${orderId} confirmed via update.`);
            }

            return fallbackOrders[index];
        }
    }

    const db = getAdminDb();
    await db.collection(ORDERS_COLLECTION).doc(orderId).update(updates);

    // If confirming, record promo redemption if applicable
    if (status === "confirmed" && order.status !== "confirmed" && order.promoCodeId) {
        try {
            const { recordRedemption } = await import("@c1rcle/core/promo-service");
            await recordRedemption(order.promoCodeId, order.id, order.userId, {
                discountAmount: order.discountAmount
            });
            console.log(`[OrderStore] Promo redemption recorded for order ${order.id} after payment.`);
        } catch (err) {
            console.error("[OrderStore] Failed to record promo redemption after payment:", err);
        }
    }

    return { ...order, ...updates };
}

/**
 * Confirm an order after successful payment
 * Generates QR codes and handles promoter conversion
 */
export async function confirmOrder(orderId, paymentDetails = {}) {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.status === "confirmed") {
        return order; // Already confirmed
    }

    const event = await getEvent(order.eventId);
    const now = new Date().toISOString();

    // Generate QR codes for the order
    const qrCodes = generateOrderQRCodes(order, event);

    const updates = {
        status: "confirmed",
        qrCodes,
        confirmedAt: now,
        updatedAt: now,
        paymentDetails: {
            ...order.paymentDetails,
            ...paymentDetails,
            paidAt: now
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackOrders.findIndex(o => o.id === orderId);
        if (index >= 0) {
            fallbackOrders[index] = { ...fallbackOrders[index], ...updates };

            // Handle promoter conversion
            if (order.promoterLinkId) {
                try {
                    const firstTicket = order.tickets[0];
                    await recordConversion(order.promoterLinkId, orderId, order.totalAmount, firstTicket.ticketId);
                } catch (err) {
                    console.error("[OrderStore] Failed to record promoter conversion (fallback):", err);
                }
            }
            return fallbackOrders[index];
        }
        throw new Error("Order not found in fallback");
    }

    const db = getAdminDb();

    await db.runTransaction(async (transaction) => {
        transaction.update(db.collection(ORDERS_COLLECTION).doc(orderId), updates);

        // MONEY LEDGER INTEGRATION (ATOMIC)
        const paymentId = paymentDetails.razorpayPaymentId || paymentDetails.id || "UNKNOWN";
        await recordOrderCaptured({ ...order, ...updates }, paymentId, transaction);
        await holdOrderRevenue({ ...order, ...updates }, transaction);
    });

    console.log(`[OrderStore] Money ledger and order status updated for confirmed order ${orderId}`);

    // Trigger background fulfillment pipeline (entitlements, email, promoter credits, analytics).
    // handleTicketFulfillment retries up to 5× and writes to fulfillment_failures on exhaustion.
    sendEvent(Events.TICKET_PURCHASED, {
        orderId,
        userId: order.userId,
        userEmail: order.userEmail,
        eventId: order.eventId,
        tickets: order.tickets.map(t => ({
            tierId: t.ticketId,
            tierName: t.name,
            quantity: t.quantity,
            entryType: t.entryType || 'general',
        })),
        totalAmount: order.totalAmount,
        promoterCode: order.promoterCode || null,
    }, { idempotencyKey: `ticket-purchased-${orderId}` }).catch(err =>
        console.error("[OrderStore] Failed to dispatch TICKET_PURCHASED to Inngest:", err)
    );


    // Handle promoter conversion
    if (order.promoterLinkId) {
        try {
            const firstTicket = order.tickets[0];
            await recordConversion(order.promoterLinkId, orderId, order.totalAmount, firstTicket.ticketId);
        } catch (err) {
            console.error("[OrderStore] Failed to record promoter conversion:", err);
            try {
                await db.collection("promoter_conversion_outbox").add({
                    orderId, userId: order.userId, eventId: order.eventId,
                    promoterLinkId: order.promoterLinkId, totalAmount: order.totalAmount,
                    status: "pending", error: err.message, retryCount: 0,
                    createdAt: new Date().toISOString()
                });
            } catch (outboxErr) {
                console.error("[OrderStore] Failed to write promoter_conversion_outbox:", outboxErr);
            }
        }
    }

    // Fire-and-forget: share bundle creation (best-effort, not critical path)
    (async () => {
                const { createShareBundle } = await import("./ticketShareStore.js");
        for (const ticket of order.tickets) {
            await createShareBundle(orderId, order.userId, order.eventId, ticket.quantity, ticket.ticketId);
        }
    })().catch(err => console.error("[OrderStore] Failed to create share bundles:", err));

    // Send ticket notification (async, don't await)
    try {
        const { notifyTicketPurchase } = require("./notificationStore");
        notifyTicketPurchase({ ...order, ...updates }).catch(err =>
            console.error("[OrderStore] Failed to send ticket notification:", err)
        );
    } catch (err) {
        console.warn("[OrderStore] Notification module not available:", err.message);
    }

    // Consume admission if this order came from a waiting room
    if (order.reservationId) {
        try {
            const { getReservation } = await import("./checkoutService.js");
            const res = await getReservation(order.reservationId);
            if (res?.queueId) {
                const { consumeAdmission } = await import("./queueStore");
                await consumeAdmission(res.queueId);
                console.log(`[OrderStore] Admission consumed for confirmed order ${orderId}`);
            }
        } catch (err) {
            console.error("[OrderStore] Failed to consume admission after confirmation:", err);
        }
    }

    // REAL-TIME NOTIFICATION (Redis Pub/Sub)
    if (event.venueId) {
        try {
            const { notifySale } = await import("@c1rcle/core/analytics-service");
            await notifySale(event.venueId, {
                orderId,
                totalAmount: order.totalAmount,
                userName: order.userName,
                tickets: order.tickets,
                eventTitle: event.title
            });
            console.log(`[OrderStore] Published sale notification for venue ${event.venueId}`);
        } catch (err) {
            console.error("[OrderStore] Failed to publish sale notification:", err);
        }
    }

    return { ...order, ...updates };
}

/**
 * Clean up stale pending orders (run periodically or proactively)
 */
export async function cleanupStaleOrders(userId = null) {
    if (!isFirebaseConfigured()) return { cleaned: 0 };

    const db = getAdminDb();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    let query = db.collection(ORDERS_COLLECTION)
        .where("status", "==", "pending_payment")
        .where("createdAt", "<", fifteenMinutesAgo);

    if (userId) {
        query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();
    let cleaned = 0;

    for (const doc of snapshot.docs) {
        try {
            await cancelOrder(doc.id);
            cleaned++;
        } catch (err) {
            console.error(`[OrderStore] Failed to cleanup stale order ${doc.id}:`, err);
        }
    }

    if (cleaned > 0) {
        console.log(`[OrderStore] Cleaned up ${cleaned} stale pending orders`);
    }

    return { cleaned };
}
/**
 * Check if a webhook was already processed
 */
export async function wasWebhookProcessed(paymentId) {
    if (!isFirebaseConfigured()) {
        // Assume fallbackWebhookLogs is defined at module level
        return typeof fallbackWebhookLogs !== 'undefined' && fallbackWebhookLogs.has(paymentId);
    }
    const db = getAdminDb();
    const doc = await db.collection("payment_webhook_logs").doc(paymentId).get();
    return doc.exists;
}

/**
 * Log a processed webhook for idempotency
 */
export async function logWebhookProcessed(paymentId, orderId, status) {
    const logEntry = {
        paymentId,
        orderId,
        status,
        processedAt: new Date().toISOString()
    };

    if (!isFirebaseConfigured()) {
        if (typeof fallbackWebhookLogs !== 'undefined') {
            fallbackWebhookLogs.set(paymentId, logEntry);
        }
        return;
    }

    const db = getAdminDb();
    await db.collection("payment_webhook_logs").doc(paymentId).set(logEntry);
}

/**
 * Update order refund status from webhook
 */
export async function updateOrderRefundStatus(paymentId, eventType, data) {
    if (!isFirebaseConfigured()) return { status: "success", message: "Handled in fallback" };

    const db = getAdminDb();
    // Search for the order containing this payment ID
    const snapshot = await db.collection(ORDERS_COLLECTION)
        .where("paymentDetails.razorpayPaymentId", "==", paymentId)
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.warn(`[OrderStore] Order for payment ${paymentId} not found during refund update`);
        return null;
    }

    const orderId = snapshot.docs[0].id;
    const now = new Date().toISOString();

    // On refund.processed: void entitlements atomically and mark order as refunded
    if (eventType === "refund.processed") {
        await db.runTransaction(async (tx) => {
            const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
            tx.update(orderRef, {
                status: "refunded",
                refundStatus: eventType,
                refundDetails: data,
                updatedAt: now,
            });

            const bundlesSnap = await tx.get(
                db.collection("share_bundles").where("orderId", "==", orderId)
            );
            bundlesSnap.forEach(d => tx.update(d.ref, { status: "cancelled", updatedAt: now }));

            const assignmentsSnap = await tx.get(
                db.collection("ticket_assignments").where("orderId", "==", orderId)
            );
            assignmentsSnap.forEach(d => tx.update(d.ref, { status: "voided", updatedAt: now }));
        });

        const updatedDoc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
        return { status: "refunded", order: { id: orderId, ...updatedDoc.data() } };
    }

    // For other refund events (created, failed, speed_changed): record metadata only
    const updates = {
        refundStatus: eventType,
        refundDetails: data,
        updatedAt: now,
    };

    await db.collection(ORDERS_COLLECTION).doc(orderId).update(updates);
    return { status: "success", message: `Refund ${eventType} recorded for order ${orderId}` };
}

import { db } from './firebase';
import { getEvent } from './events';
import { generateOrderQRCodes } from './qrStore';

const ORDERS_COLLECTION = "orders";
const RSVP_COLLECTION = "rsvp_orders";

export async function createOrder(payload: any) {
    const {
        eventId,
        tickets,
        // userId,
        // userEmail,
        // userName,
        reservationId = null
    } = payload;

    const event = await getEvent(eventId);
    if (!event) {
        throw new Error("Event not found");
    }

    // Atomic transaction
    return await db.runTransaction(async (transaction) => {
        const eventRef = db.collection("events").doc(eventId);
        const eventDoc = await transaction.get(eventRef);

        if (!eventDoc.exists) {
            throw new Error(`Event not found in transaction`);
        }

        const currentEvent = eventDoc.data()!;
        const updatedTickets = [...(currentEvent.tickets || [])];
        const ticketUpdates = tickets.map((t: any) => ({
            ticketId: t.ticketId,
            quantity: Number(t.quantity)
        }));

        // Check if order already exists inside the transaction (High-Concurrency Idempotency)
        const orderId = reservationId ? `ORD-${reservationId}` : `ORD-${Date.now()}`;
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        const existingOrderDoc = await transaction.get(orderRef);

        if (existingOrderDoc.exists) {
            return existingOrderDoc.data();
        }

        // Reduce inventory and release lock
        for (const update of ticketUpdates) {
            const ticketIndex = updatedTickets.findIndex((t: any) => t.id === update.ticketId);
            if (ticketIndex === -1) throw new Error("Ticket not found");

            const t = updatedTickets[ticketIndex];
            const currentRemaining = Number(t.remaining ?? t.quantity ?? 0);
            const currentLocked = Number(t.lockedQuantity || 0);

            // If we have a reservationId, we expect the inventory to be in 'lockedQuantity'
            if (reservationId) {
                // Deduct from remaining and release from locked
                updatedTickets[ticketIndex].remaining = Math.max(0, currentRemaining - update.quantity);
                updatedTickets[ticketIndex].lockedQuantity = Math.max(0, currentLocked - update.quantity);
            } else {
                // Direct purchase (no reservation hold)
                // In production, we should enforce reservations first, but for now we follow the existing flow
                if (currentRemaining - currentLocked < update.quantity) {
                    throw new Error(`Sold out: ${t.name}`);
                }
                updatedTickets[ticketIndex].remaining = Math.max(0, currentRemaining - update.quantity);
            }
        }

        // Update event
        transaction.update(eventRef, {
            tickets: updatedTickets,
            updatedAt: new Date().toISOString()
        });

        // Create Order
        const orderData: any = {
            ...payload,
            id: orderId,
            status: payload.totalAmount === 0 ? 'confirmed' : 'pending_payment',
            ledger: payload.ledger || {}, // Store audit ledger from pricing
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Generate QR codes if confirmed
        if (orderData.status === 'confirmed') {
            orderData.qrCodes = generateOrderQRCodes(orderData, currentEvent);
            orderData.confirmedAt = new Date().toISOString();
            orderData.confirmationSource = payload.totalAmount === 0 ? 'system_zero_total' : 'internal_override';

            // Record promo redemption if applicable
            if (orderData.promoCodeId) {
                const { recordRedemption } = await import('./promos');
                await recordRedemption(orderData.promoCodeId, orderId, orderData.userId, {
                    discountAmount: orderData.discountAmount || 0
                });
            }
        }

        transaction.set(orderRef, orderData);

        // If reserved, mark reservation as converted
        if (reservationId) {
            const resRef = db.collection("cart_reservations").doc(reservationId);
            transaction.update(resRef, { status: 'converted', orderId: orderId, updatedAt: new Date().toISOString() });
        }

        return orderData;
    });
}

/**
 * Confirms an order via webhook (Idempotent)
 */
export async function confirmOrderPayment(orderId: string, paymentData: { paymentId: string, signature: string, mode?: string }) {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

    return await db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) throw new Error("Order not found");

        const order = orderDoc.data()!;

        // IDEMPOTENCY: If already confirmed, don't re-issue
        if (order.status === 'confirmed') {
            console.log(`[Orders] Order ${orderId} already confirmed, skipping.`);
            return order;
        }

        const event = await getEvent(order.eventId);
        if (!event) throw new Error("Event not found for confirmation");

        const updatedOrder: any = {
            ...order,
            status: 'confirmed',
            paymentId: paymentData.paymentId,
            paymentSignature: paymentData.signature,
            paymentMode: paymentData.mode || 'unknown',
            confirmedAt: new Date().toISOString(),
            confirmationSource: 'razorpay_webhook',
            updatedAt: new Date().toISOString()
        };

        // Generate QR codes
        updatedOrder.qrCodes = generateOrderQRCodes(updatedOrder, event);

        // Record promo redemption if applicable
        if (updatedOrder.promoCodeId) {
            const { recordRedemption } = await import('./promos');
            await recordRedemption(updatedOrder.promoCodeId, orderId, updatedOrder.userId, {
                discountAmount: updatedOrder.discountAmount || 0
            });
        }

        transaction.update(orderRef, updatedOrder);
        return updatedOrder;
    });
}

export async function createRSVPOrder(payload: any) {
    // Simplified RSVP creation without transaction transaction for reducing inventory (usually irrelevant for RSVP unless capped)
    // But adhering to structure
    const event = await getEvent(payload.eventId);
    const orderId = payload.reservationId ? `RSVP-${payload.reservationId}` : `RSVP-${Date.now()}`;
    const orderData: any = {
        ...payload,
        id: orderId,
        status: 'confirmed',
        isRSVP: true,
        createdAt: new Date().toISOString()
    };

    // Generate QR codes
    if (event) {
        orderData.qrCodes = generateOrderQRCodes(orderData, event);
    }

    await db.collection(RSVP_COLLECTION).doc(orderId).set(orderData);
    return orderData;
}

/**
 * Get order by reservation ID (Idempotency Helper)
 */
export async function getOrderByReservationId(reservationId: string) {
    if (!reservationId) return null;

    // Check Paid Orders
    const ordersSnapshot = await db.collection(ORDERS_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();

    if (!ordersSnapshot.empty) {
        const doc = ordersSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    // Check RSVP Orders
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
 * Fails orders that have been stuck in pending_payment for too long (20+ mins)
 */
export async function failStaleOrders() {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const snapshot = await db.collection(ORDERS_COLLECTION)
        .where('status', '==', 'pending_payment')
        .where('createdAt', '<', twentyMinsAgo)
        .limit(20)
        .get();

    console.log(`[Cleanup] Found ${snapshot.size} stale pending orders`);

    for (const doc of snapshot.docs) {
        const orderId = doc.id;
        try {
            await db.collection(ORDERS_COLLECTION).doc(orderId).update({
                status: 'expired',
                updatedAt: new Date().toISOString(),
                failureReason: 'Payment timeout'
            });
            console.log(`[Cleanup] Marked order ${orderId} as expired`);
        } catch (e) {
            console.error(`[Cleanup] Failed to expire order ${orderId}:`, e);
        }
    }
}

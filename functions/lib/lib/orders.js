"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.failStaleOrders = exports.getOrderByReservationId = exports.createRSVPOrder = exports.confirmOrderPayment = exports.createOrder = void 0;
const firebase_1 = require("./firebase");
const events_1 = require("./events");
const qrStore_1 = require("./qrStore");
const ORDERS_COLLECTION = "orders";
const RSVP_COLLECTION = "rsvp_orders";
async function createOrder(payload) {
    const { eventId, tickets, 
    // userId,
    // userEmail,
    // userName,
    reservationId = null } = payload;
    const event = await (0, events_1.getEvent)(eventId);
    if (!event) {
        throw new Error("Event not found");
    }
    // Atomic transaction
    return await firebase_1.db.runTransaction(async (transaction) => {
        var _a, _b;
        const eventRef = firebase_1.db.collection("events").doc(eventId);
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists) {
            throw new Error(`Event not found in transaction`);
        }
        const currentEvent = eventDoc.data();
        const updatedTickets = [...(currentEvent.tickets || [])];
        const ticketUpdates = tickets.map((t) => ({
            ticketId: t.ticketId,
            quantity: Number(t.quantity)
        }));
        // Check if order already exists inside the transaction (High-Concurrency Idempotency)
        const orderId = reservationId ? `ORD-${reservationId}` : `ORD-${Date.now()}`;
        const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId);
        const existingOrderDoc = await transaction.get(orderRef);
        if (existingOrderDoc.exists) {
            return existingOrderDoc.data();
        }
        // Reduce inventory and release lock
        for (const update of ticketUpdates) {
            const ticketIndex = updatedTickets.findIndex((t) => t.id === update.ticketId);
            if (ticketIndex === -1)
                throw new Error("Ticket not found");
            const t = updatedTickets[ticketIndex];
            const currentRemaining = Number((_b = (_a = t.remaining) !== null && _a !== void 0 ? _a : t.quantity) !== null && _b !== void 0 ? _b : 0);
            const currentLocked = Number(t.lockedQuantity || 0);
            // If we have a reservationId, we expect the inventory to be in 'lockedQuantity'
            if (reservationId) {
                // Deduct from remaining and release from locked
                updatedTickets[ticketIndex].remaining = Math.max(0, currentRemaining - update.quantity);
                updatedTickets[ticketIndex].lockedQuantity = Math.max(0, currentLocked - update.quantity);
            }
            else {
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
        const orderData = Object.assign(Object.assign({}, payload), { id: orderId, status: payload.totalAmount === 0 ? 'confirmed' : 'pending_payment', ledger: payload.ledger || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        // Generate QR codes if confirmed
        if (orderData.status === 'confirmed') {
            orderData.qrCodes = (0, qrStore_1.generateOrderQRCodes)(orderData, currentEvent);
            orderData.confirmedAt = new Date().toISOString();
            orderData.confirmationSource = payload.totalAmount === 0 ? 'system_zero_total' : 'internal_override';
            // Record promo redemption if applicable
            if (orderData.promoCodeId) {
                const { recordRedemption } = await Promise.resolve().then(() => __importStar(require('./promos')));
                await recordRedemption(orderData.promoCodeId, orderId, orderData.userId, {
                    discountAmount: orderData.discountAmount || 0
                });
            }
        }
        transaction.set(orderRef, orderData);
        // If reserved, mark reservation as converted
        if (reservationId) {
            const resRef = firebase_1.db.collection("cart_reservations").doc(reservationId);
            transaction.update(resRef, { status: 'converted', orderId: orderId, updatedAt: new Date().toISOString() });
        }
        return orderData;
    });
}
exports.createOrder = createOrder;
/**
 * Confirms an order via webhook (Idempotent)
 */
async function confirmOrderPayment(orderId, paymentData) {
    const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId);
    return await firebase_1.db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists)
            throw new Error("Order not found");
        const order = orderDoc.data();
        // IDEMPOTENCY: If already confirmed, don't re-issue
        if (order.status === 'confirmed') {
            console.log(`[Orders] Order ${orderId} already confirmed, skipping.`);
            return order;
        }
        const event = await (0, events_1.getEvent)(order.eventId);
        if (!event)
            throw new Error("Event not found for confirmation");
        const updatedOrder = Object.assign(Object.assign({}, order), { status: 'confirmed', paymentId: paymentData.paymentId, paymentSignature: paymentData.signature, paymentMode: paymentData.mode || 'unknown', confirmedAt: new Date().toISOString(), confirmationSource: 'razorpay_webhook', updatedAt: new Date().toISOString() });
        // Generate QR codes
        updatedOrder.qrCodes = (0, qrStore_1.generateOrderQRCodes)(updatedOrder, event);
        // Record promo redemption if applicable
        if (updatedOrder.promoCodeId) {
            const { recordRedemption } = await Promise.resolve().then(() => __importStar(require('./promos')));
            await recordRedemption(updatedOrder.promoCodeId, orderId, updatedOrder.userId, {
                discountAmount: updatedOrder.discountAmount || 0
            });
        }
        transaction.update(orderRef, updatedOrder);
        return updatedOrder;
    });
}
exports.confirmOrderPayment = confirmOrderPayment;
async function createRSVPOrder(payload) {
    // Simplified RSVP creation without transaction transaction for reducing inventory (usually irrelevant for RSVP unless capped)
    // But adhering to structure
    const event = await (0, events_1.getEvent)(payload.eventId);
    const orderId = payload.reservationId ? `RSVP-${payload.reservationId}` : `RSVP-${Date.now()}`;
    const orderData = Object.assign(Object.assign({}, payload), { id: orderId, status: 'confirmed', isRSVP: true, createdAt: new Date().toISOString() });
    // Generate QR codes
    if (event) {
        orderData.qrCodes = (0, qrStore_1.generateOrderQRCodes)(orderData, event);
    }
    await firebase_1.db.collection(RSVP_COLLECTION).doc(orderId).set(orderData);
    return orderData;
}
exports.createRSVPOrder = createRSVPOrder;
/**
 * Get order by reservation ID (Idempotency Helper)
 */
async function getOrderByReservationId(reservationId) {
    if (!reservationId)
        return null;
    // Check Paid Orders
    const ordersSnapshot = await firebase_1.db.collection(ORDERS_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();
    if (!ordersSnapshot.empty) {
        const doc = ordersSnapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }
    // Check RSVP Orders
    const rsvpsSnapshot = await firebase_1.db.collection(RSVP_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();
    if (!rsvpsSnapshot.empty) {
        const doc = rsvpsSnapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }
    return null;
}
exports.getOrderByReservationId = getOrderByReservationId;
/**
 * Fails orders that have been stuck in pending_payment for too long (20+ mins)
 */
async function failStaleOrders() {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const snapshot = await firebase_1.db.collection(ORDERS_COLLECTION)
        .where('status', '==', 'pending_payment')
        .where('createdAt', '<', twentyMinsAgo)
        .limit(20)
        .get();
    console.log(`[Cleanup] Found ${snapshot.size} stale pending orders`);
    for (const doc of snapshot.docs) {
        const orderId = doc.id;
        try {
            await firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId).update({
                status: 'expired',
                updatedAt: new Date().toISOString(),
                failureReason: 'Payment timeout'
            });
            console.log(`[Cleanup] Marked order ${orderId} as expired`);
        }
        catch (e) {
            console.error(`[Cleanup] Failed to expire order ${orderId}:`, e);
        }
    }
}
exports.failStaleOrders = failStaleOrders;
//# sourceMappingURL=orders.js.map
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.failStaleOrders = exports.getOrderByReservationId = exports.createRSVPOrder = exports.confirmOrderPayment = exports.createOrder = void 0;
const firebase_1 = require("./firebase");
const admin = __importStar(require("firebase-admin"));
const events_1 = require("./events");
const qrStore_1 = require("./qrStore");
const reservations_1 = require("./reservations");
const ORDERS_COLLECTION = "orders";
const RSVP_COLLECTION = "rsvp_orders";
// @ts-ignore
const order_engine_1 = require("@c1rcle/core/order-engine");
// @ts-ignore
const inventory_engine_1 = __importDefault(require("@c1rcle/core/inventory-engine"));
async function createOrder(payload) {
    const { eventId, reservationId = null } = payload;
    const event = await (0, events_1.getEvent)(eventId);
    if (!event)
        throw new Error("Event not found");
    // Atomic transaction
    return await firebase_1.db.runTransaction(async (transaction) => {
        const orderId = reservationId ? `ORD-${reservationId}` : `ORD-${Date.now()}`;
        // Inject dependencies for core engine
        transaction.db = firebase_1.db;
        const orderData = Object.assign(Object.assign({}, payload), { id: orderId, status: payload.totalAmount === 0 ? 'confirmed' : 'pending_payment', ledger: payload.ledger || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        // 1. Execute unified order creation and inventory commitment
        const finalOrder = await (0, order_engine_1.executeOrderCreation)(transaction, {
            db: firebase_1.db,
            event,
            orderData,
            reservationId,
            inventoryEngine: inventory_engine_1.default
        });
        // 2. Generate QR codes if confirmed
        if (finalOrder.status === 'confirmed') {
            finalOrder.qrCodes = (0, qrStore_1.generateOrderQRCodes)(finalOrder, event);
            finalOrder.confirmedAt = new Date().toISOString();
            // Record promo redemption if applicable
            if (finalOrder.promoCodeId) {
                const { recordRedemption } = await Promise.resolve().then(() => __importStar(require('./promos')));
                await recordRedemption(finalOrder.promoCodeId, orderId, finalOrder.userId, {
                    discountAmount: finalOrder.discountAmount || 0
                });
            }
            // --- PUBLIC DISCOVERY SYNC ---
            const attendeeRef = firebase_1.db.collection('public_attendees').doc(`${finalOrder.userId}_${finalOrder.eventId}`);
            const userDoc = await transaction.get(firebase_1.db.collection('users').doc(finalOrder.userId));
            const userData = userDoc.exists ? userDoc.data() : {};
            transaction.set(attendeeRef, {
                userId: finalOrder.userId,
                userName: (userData === null || userData === void 0 ? void 0 : userData.displayName) || finalOrder.userName || "C1RCLE Member",
                userAvatar: (userData === null || userData === void 0 ? void 0 : userData.photoURL) || null,
                eventId: finalOrder.eventId,
                orderId: orderId,
                joinedAt: new Date().toISOString(),
                type: finalOrder.isRSVP ? 'rsvp' : 'purchase'
            });
        }
        return finalOrder;
    });
}
exports.createOrder = createOrder;
/**
 * Confirms an order via webhook (Idempotent)
 * Includes a "Safety Valve" to handle payments arriving for expired/stale orders.
 */
async function confirmOrderPayment(orderId, paymentData) {
    const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId);
    return await firebase_1.db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists)
            throw new Error("Order not found");
        const order = orderDoc.data();
        // 1. IDEMPOTENCY: If already confirmed, don't re-issue
        if (order.status === 'confirmed') {
            console.log(`[Orders] Order ${orderId} already confirmed, skipping.`);
            return order;
        }
        // 2. SAFETY VALVE: Handle Payment for Expired/Timed-out Orders
        // If the order was 'expired', the inventory has already been returned to the pool by 'failStaleOrders'.
        // We must re-check if the tickets are still available before confirming.
        const eventRef = firebase_1.db.collection("events").doc(order.eventId);
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists)
            throw new Error("Event not found for confirmation");
        const event = eventDoc.data();
        if (order.status === 'expired') {
            console.log(`[Orders] Webhook received for EXPIRED order ${orderId}. Re-verifying sharded inventory...`);
            const orderTickets = order.tickets || [];
            let canRestore = true;
            for (const ot of orderTickets) {
                // Check sharded inventory
                const stats = await (0, reservations_1.getTierInventoryStats)(order.eventId, ot.ticketId);
                const tier = (event.tickets || []).find((t) => t.id === ot.ticketId);
                const totalCapacity = Number((tier === null || tier === void 0 ? void 0 : tier.quantity) || 0);
                const available = totalCapacity - stats.sold; // Don't count locks since it's an expired restoration check
                if (ot.quantity > available) {
                    canRestore = false;
                    break;
                }
            }
            if (!canRestore) {
                console.error(`[Orders] INVENTORY EXHAUSTED for expired order ${orderId}. Marking for manual refund.`);
                const refundOrder = Object.assign(Object.assign({}, order), { status: 'payment_received_stale', paymentId: paymentData.paymentId, paymentMode: paymentData.mode || 'unknown', failureReason: 'Inventory no longer available after payment timeout. Manual refund required.', updatedAt: new Date().toISOString() });
                transaction.update(orderRef, refundOrder);
                return refundOrder;
            }
            // Inventory is available, re-deduct it from shards
            const shardId = order.shardId || Math.floor(Math.random() * 10).toString();
            for (const ot of orderTickets) {
                const shardRef = eventRef.collection('ticket_shards').doc(`${ot.ticketId}_${shardId}`);
                transaction.set(shardRef, {
                    soldQuantity: admin.firestore.FieldValue.increment(ot.quantity),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
            transaction.update(eventRef, {
                updatedAt: new Date().toISOString()
            });
            console.log(`[Orders] Sharded inventory successfully re-secured for stale order ${orderId}`);
        }
        // 3. PROCEED TO CONFIRMATION
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
        // --- PUBLIC DISCOVERY SYNC ---
        const attendeeRef = firebase_1.db.collection('public_attendees').doc(`${updatedOrder.userId}_${updatedOrder.eventId}`);
        // Fetch profile for denormalization
        const userDoc = await transaction.get(firebase_1.db.collection('users').doc(updatedOrder.userId));
        const userData = userDoc.exists ? userDoc.data() : {};
        transaction.set(attendeeRef, {
            userId: updatedOrder.userId,
            userName: (userData === null || userData === void 0 ? void 0 : userData.displayName) || updatedOrder.userName || "C1RCLE Member",
            userAvatar: (userData === null || userData === void 0 ? void 0 : userData.photoURL) || null,
            eventId: updatedOrder.eventId,
            orderId: orderId,
            joinedAt: new Date().toISOString(),
            type: 'purchase'
        });
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
    // --- PUBLIC DISCOVERY SYNC ---
    try {
        const userDoc = await firebase_1.db.collection('users').doc(payload.userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        await firebase_1.db.collection('public_attendees').doc(`${payload.userId}_${payload.eventId}`).set({
            userId: payload.userId,
            userName: (userData === null || userData === void 0 ? void 0 : userData.displayName) || payload.userName || "C1RCLE Member",
            userAvatar: (userData === null || userData === void 0 ? void 0 : userData.photoURL) || null,
            eventId: payload.eventId,
            orderId: orderId,
            joinedAt: new Date().toISOString(),
            type: 'rsvp'
        });
    }
    catch (e) {
        console.error("Public attendee sync failed for RSVP:", e);
    }
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
 * ATOMIC: Restores inventory back to the event pool.
 */
async function failStaleOrders() {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const snapshot = await firebase_1.db.collection(ORDERS_COLLECTION)
        .where('status', '==', 'pending_payment')
        .where('createdAt', '<', twentyMinsAgo)
        .limit(20)
        .get();
    if (snapshot.empty) {
        console.log(`[Cleanup] No stale pending orders found`);
        return;
    }
    console.log(`[Cleanup] Found ${snapshot.size} stale pending orders to expire and restore`);
    for (const doc of snapshot.docs) {
        const orderId = doc.id;
        try {
            await firebase_1.db.runTransaction(async (transaction) => {
                const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId);
                const currentOrderDoc = await transaction.get(orderRef);
                if (!currentOrderDoc.exists)
                    return;
                const order = currentOrderDoc.data();
                // Safety check: ensure still pending
                if (order.status !== 'pending_payment')
                    return;
                // 1. Mark order as expired
                transaction.update(orderRef, {
                    status: 'expired',
                    updatedAt: new Date().toISOString(),
                    failureReason: 'Payment timeout (20m)'
                });
                // 2. Restore inventory to shards
                const eventRef = firebase_1.db.collection("events").doc(order.eventId);
                const orderTickets = order.tickets || [];
                const shardId = order.shardId || "0";
                for (const ot of orderTickets) {
                    const shardRef = eventRef.collection('ticket_shards').doc(`${ot.ticketId}_${shardId}`);
                    transaction.set(shardRef, {
                        soldQuantity: admin.firestore.FieldValue.increment(-ot.quantity),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }
                transaction.update(eventRef, {
                    updatedAt: new Date().toISOString()
                });
            });
            console.log(`[Cleanup] Successfully expired order ${orderId} and restored inventory`);
        }
        catch (e) {
            console.error(`[Cleanup] Failed to expire order ${orderId}:`, e);
        }
    }
}
exports.failStaleOrders = failStaleOrders;
//# sourceMappingURL=orders.js.map
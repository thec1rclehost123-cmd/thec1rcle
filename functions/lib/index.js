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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupReservations = exports.razorpayWebhook = exports.verifyPayment = exports.initiateCheckout = exports.calculatePricing = exports.reserveTickets = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const reservations_1 = require("./lib/reservations");
const pricing_1 = require("./lib/pricing");
const orders_1 = require("./lib/orders");
const events_1 = require("./lib/events");
const razorpay_1 = require("./lib/razorpay");
// Initialize Admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * 1. Reserve Tickets
 */
exports.reserveTickets = functions.https.onCall(async (data, context) => {
    // data = { eventId, items: [{tierId, quantity}], deviceId }
    var _a, _b;
    // Auth check (optional for public reservation but good to record)
    const userId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'anonymous';
    try {
        if (!data.eventId || !data.items || !Array.isArray(data.items)) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing eventId or items');
        }
        const result = await (0, reservations_1.createCartReservation)(data.eventId, userId, data.deviceId, data.items);
        if (!result.success) {
            throw new functions.https.HttpsError('failed-precondition', result.error || ((_b = result.errors) === null || _b === void 0 ? void 0 : _b.join(', ')));
        }
        return result;
    }
    catch (error) {
        console.error("reserveTickets error:", error);
        if (error.stack)
            console.error(error.stack);
        // Pass through HttpsErrors, wrap others
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
    }
});
/**
 * 2. Calculate Pricing
 */
exports.calculatePricing = functions.https.onCall(async (data, context) => {
    var _a;
    // data = { eventId, items, promoCode?, promoterCode? }
    const userId = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    try {
        const event = await (0, events_1.getEvent)(data.eventId);
        if (!event) {
            throw new functions.https.HttpsError('not-found', 'Event not found');
        }
        const result = await (0, pricing_1.calculatePricingInternal)(event, data.items, {
            promoCode: data.promoCode,
            promoterCode: data.promoterCode,
            userId
        });
        if (!result.success)
            throw new Error(result.error);
        const pricing = result.pricing;
        const { ledger } = pricing, pricingForClient = __rest(pricing, ["ledger"]); // Omit audit ledger for security
        return pricingForClient;
    }
    catch (error) {
        console.error("calculatePricing error", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * 3. Initiate Checkout
 */
exports.initiateCheckout = functions.https.onCall(async (data, context) => {
    // data = { reservationId, userDetails: {email, name, phone}, promoCode?, promoterCode? }
    var _a, _b;
    const userId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || data.userId || 'anonymous';
    try {
        const reservation = await (0, reservations_1.getReservation)(data.reservationId);
        if (!reservation) {
            throw new functions.https.HttpsError('not-found', 'Reservation not found');
        }
        if (reservation.status !== 'active') {
            throw new functions.https.HttpsError('failed-precondition', 'Reservation expired or invalid');
        }
        const event = await (0, events_1.getEvent)(reservation.eventId);
        if (!event)
            throw new functions.https.HttpsError('not-found', 'Event not found');
        // Calculate final pricing
        const pricingResult = await (0, pricing_1.calculatePricingInternal)(event, reservation.items, data);
        if (!pricingResult.success)
            throw new Error(pricingResult.error);
        const pricing = pricingResult.pricing;
        // --- IDEMPOTENCY CHECK ---
        // Check if an order already exists for this reservation
        const existingOrder = await (0, orders_1.getOrderByReservationId)(reservation.id);
        if (existingOrder) {
            console.log(`[Checkout] Reusing existing order ${existingOrder.id} for res ${reservation.id}`);
            // If it was a paid order, it might already have razorpay details or need them
            const { ledger } = pricing, pricingForClient = __rest(pricing, ["ledger"]);
            return {
                success: true,
                requiresPayment: existingOrder.totalAmount > 0 && existingOrder.status !== 'confirmed',
                order: existingOrder,
                pricing: pricingForClient,
                razorpay: existingOrder.razorpayOrder || null
            };
        }
        // RSVP FLow
        if (event.isRSVP) {
            const result = await (0, orders_1.createRSVPOrder)({
                reservationId: reservation.id,
                eventId: reservation.eventId,
                userId,
                userName: data.userDetails.name,
                userEmail: data.userDetails.email,
                userPhone: data.userDetails.phone,
                tickets: reservation.items,
                promoterCode: data.promoterCode
            });
            return { success: true, requiresPayment: false, order: result };
        }
        // Paid Flow
        else {
            const orderPayload = {
                eventId: reservation.eventId,
                eventName: event.title || 'Event',
                userId,
                userName: data.userDetails.name,
                userEmail: data.userDetails.email,
                userPhone: data.userDetails.phone,
                tickets: pricing.items.map((item) => ({
                    ticketId: item.tierId,
                    name: item.tierName,
                    entryType: item.entryType || 'general',
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.subtotal
                })),
                subtotal: pricing.subtotal,
                discounts: pricing.discounts,
                discountTotal: pricing.discountTotal,
                fees: pricing.fees,
                totalAmount: pricing.grandTotal,
                reservationId: reservation.id,
                promoterCode: data.promoterCode || null,
                promoCodeId: ((_b = pricing.discounts.find((d) => d.type === 'promo')) === null || _b === void 0 ? void 0 : _b.id) || null,
                discountAmount: pricing.discountTotal || 0,
            };
            const order = await (0, orders_1.createOrder)(orderPayload);
            let razorpay = null;
            if (order.totalAmount > 0) {
                razorpay = await (0, razorpay_1.createRazorpayOrder)({
                    amount: Math.round(order.totalAmount * 100),
                    currency: 'INR',
                    receipt: order.id,
                    notes: {
                        orderId: order.id,
                        eventId: order.eventId,
                        userId
                    }
                });
                // Link Razorpay order to the native order for idempotency
                await admin.firestore().collection('orders').doc(order.id).update({
                    razorpayOrderId: razorpay.id,
                    razorpayOrder: razorpay,
                    updatedAt: new Date().toISOString()
                });
            }
            const { ledger } = pricing, pricingForClient = __rest(pricing, ["ledger"]);
            return {
                success: true,
                requiresPayment: order.totalAmount > 0,
                order,
                pricing: pricingForClient,
                razorpay
            };
        }
    }
    catch (error) {
        console.error("initiateCheckout error", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * 4. Verify Payment (Manual/Fallback)
 */
exports.verifyPayment = functions.https.onCall(async (data, context) => {
    const { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id } = data;
    // 1. Signature Verification
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');
    if (expectedSignature !== razorpay_signature) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid payment signature');
    }
    // 2. Confirm Order
    try {
        const order = await (0, orders_1.confirmOrderPayment)(orderId, {
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });
        return { success: true, order };
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * 5. Razorpay Webhook (Authority)
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    // Verify Webhook Signature
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    if (expectedSignature !== signature) {
        res.status(403).send('Invalid signature');
        return;
    }
    const event = req.body.event;
    const payload = req.body.payload;
    if (event === 'payment.captured') {
        const payment = payload.payment.entity;
        const orderId = payment.notes.orderId || payment.description;
        console.log(`[Webhook] Payment CAPTURED for Order ${orderId}`);
        try {
            await (0, orders_1.confirmOrderPayment)(orderId, {
                paymentId: payment.id,
                signature: signature,
                mode: payment.method
            });
        }
        catch (error) {
            console.error(`[Webhook] Error confirming order ${orderId}:`, error);
        }
    }
    res.status(200).send('ok');
});
/**
 * 6. Inventory Cleanup (Cron)
 */
exports.cleanupReservations = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log('[Cron] Running reservation + order cleanup...');
    await (0, reservations_1.cleanupExpiredReservations)();
    await (0, orders_1.failStaleOrders)(); // Restore inventory for abandoned payments
    return null;
});
//# sourceMappingURL=index.js.map

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { createCartReservation, getReservation, cleanupExpiredReservations } from './lib/reservations';
import { calculatePricingInternal } from './lib/pricing';
import { createOrder, createRSVPOrder, getOrderByReservationId, confirmOrderPayment, failStaleOrders } from './lib/orders';
import { getEvent } from './lib/events';
import { createRazorpayOrder } from './lib/razorpay';

// Initialize Admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * 1. Reserve Tickets
 */
export const reserveTickets = functions.https.onCall(async (data, context) => {
    // data = { eventId, items: [{tierId, quantity}], deviceId }

    // Auth check (optional for public reservation but good to record)
    const userId = context.auth?.uid || 'anonymous';

    try {
        if (!data.eventId || !data.items || !Array.isArray(data.items)) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing eventId or items');
        }

        const result: any = await createCartReservation(
            data.eventId,
            userId,
            data.deviceId,
            data.items
        );

        if (!result.success) {
            throw new functions.https.HttpsError('failed-precondition', result.error || result.errors?.join(', '));
        }

        return result;

    } catch (error: any) {
        console.error("reserveTickets error:", error);
        if (error.stack) console.error(error.stack);
        // Pass through HttpsErrors, wrap others
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
    }
});

/**
 * 2. Calculate Pricing
 */
export const calculatePricing = functions.https.onCall(async (data, context) => {
    // data = { eventId, items, promoCode?, promoterCode? }
    const userId = context.auth?.uid;

    try {
        const event = await getEvent(data.eventId);
        if (!event) {
            throw new functions.https.HttpsError('not-found', 'Event not found');
        }

        const result: any = await calculatePricingInternal(event, data.items, {
            promoCode: data.promoCode,
            promoterCode: data.promoterCode,
            userId
        });

        if (!result.success) throw new Error(result.error);

        const pricing = result.pricing;
        const { ledger, ...pricingForClient } = pricing; // Omit audit ledger for security

        return pricingForClient;

    } catch (error: any) {
        console.error("calculatePricing error", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * 3. Initiate Checkout
 */
export const initiateCheckout = functions.https.onCall(async (data, context) => {
    // data = { reservationId, userDetails: {email, name, phone}, promoCode?, promoterCode? }

    const userId = context.auth?.uid || data.userId || 'anonymous';

    try {
        const reservation: any = await getReservation(data.reservationId);
        if (!reservation) {
            throw new functions.https.HttpsError('not-found', 'Reservation not found');
        }

        if (reservation.status !== 'active') {
            throw new functions.https.HttpsError('failed-precondition', 'Reservation expired or invalid');
        }

        const event = await getEvent(reservation.eventId);
        if (!event) throw new functions.https.HttpsError('not-found', 'Event not found');

        // Calculate final pricing
        const pricingResult: any = await calculatePricingInternal(event, reservation.items, data);
        if (!pricingResult.success) throw new Error(pricingResult.error);
        const pricing = pricingResult.pricing;

        // --- IDEMPOTENCY CHECK ---
        // Check if an order already exists for this reservation
        const existingOrder: any = await getOrderByReservationId(reservation.id);
        if (existingOrder) {
            console.log(`[Checkout] Reusing existing order ${existingOrder.id} for res ${reservation.id}`);

            // If it was a paid order, it might already have razorpay details or need them
            const { ledger, ...pricingForClient } = pricing;
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
            const result = await createRSVPOrder({
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
                tickets: pricing.items.map((item: any) => ({
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
                promoCodeId: pricing.discounts.find((d: any) => d.type === 'promo')?.id || null,
                discountAmount: pricing.discountTotal || 0,
            };

            const order: any = await createOrder(orderPayload);

            let razorpay = null;
            if (order.totalAmount > 0) {
                razorpay = await createRazorpayOrder({
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

            const { ledger, ...pricingForClient } = pricing;
            return {
                success: true,
                requiresPayment: order.totalAmount > 0,
                order,
                pricing: pricingForClient,
                razorpay
            };
        }

    } catch (error: any) {
        console.error("initiateCheckout error", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * 4. Verify Payment (Manual/Fallback)
 */
export const verifyPayment = functions.https.onCall(async (data, context) => {
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
        const order = await confirmOrderPayment(orderId, {
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });
        return { success: true, order };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * 5. Razorpay Webhook (Authority)
 */
export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
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
            await confirmOrderPayment(orderId, {
                paymentId: payment.id,
                signature: signature,
                mode: payment.method
            });
        } catch (error) {
            console.error(`[Webhook] Error confirming order ${orderId}:`, error);
        }
    }

    res.status(200).send('ok');
});

/**
 * 6. Inventory Cleanup (Cron)
 */
export const cleanupReservations = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log('[Cron] Running reservation + order cleanup...');
    await cleanupExpiredReservations();
    await failStaleOrders(); // Restore inventory for abandoned payments
    return null;
});

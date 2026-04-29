import { FastifyInstance } from 'fastify';
// @ts-ignore
import { validatePromoCode } from '@c1rcle/core/promo-service';
// @ts-ignore
import { calculatePricing } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { flagPaymentFailure } from '@c1rcle/core/surge';
import { z } from 'zod';
import * as Sentry from '@sentry/node';

const CheckoutCalculateBody = z.object({
    eventId: z.string().optional(),
    reservationId: z.string().optional(),
    items: z.array(z.object({ tierId: z.string(), quantity: z.number() })).optional(),
    promoCode: z.string().optional().nullable(),
    promoterCode: z.string().optional().nullable(),
});

const CheckoutValidateBody = z.object({
    eventId: z.string(),
    items: z.array(z.any()).optional()
}).strict();

const CheckoutPromoBody = z.object({
    eventId: z.string(),
    code: z.string(),
    items: z.array(z.any()).optional()
}).strict();

const CheckoutReserveBody = z.object({
    eventId: z.string(),
    items: z.array(z.any()),
    deviceId: z.string().optional(),
    admissionToken: z.string().optional()
}).strict();

const CheckoutInitiateBody = z.object({
    eventId: z.string().optional(),
    items: z.array(z.any()).optional(),
    reservationId: z.string().optional(),
    promoCode: z.string().optional(),
    promoterCode: z.string().optional(),
    deviceId: z.string().optional(),
    guestInputs: z.any().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    userPhone: z.string().optional(),
}).strict();

const CheckoutCancelBody = z.object({
    reservationId: z.string().optional(),
    orderId: z.string().optional()
}).strict();

const CheckoutFailureBody = z.object({
    admissionToken: z.string()
}).strict();

function extractQueueId(admissionToken?: string | null): string | null {
    if (!admissionToken) return null;
    const parts = String(admissionToken).split(':');
    if (parts.length !== 4) return null;
    return parts[2] || null;
}

export default async function checkoutRoutes(fastify: FastifyInstance) {
    /**
     * Calculate server-side pricing (discounts, fees, grand total)
     * POST /checkout/calculate
     */
    fastify.post('/checkout/calculate', {
        preHandler: [fastify.validate({ body: CheckoutCalculateBody })]
    }, async (request: any, reply) => {
        try {
            let { eventId, reservationId, items, promoCode = null, promoterCode = null } = request.body;

            // If reservationId provided, load event + items from reservation
            if (reservationId) {
                const resDoc = await fastify.db.collection('cart_reservations').doc(reservationId).get();
                if (!resDoc.exists) return reply.status(404).send({ success: false, error: 'Reservation not found' });
                const res = resDoc.data() as any;
                if (res.status !== 'active') return reply.status(400).send({ success: false, error: `Reservation is ${res.status}` });
                if (new Date(res.expiresAt) < new Date()) return reply.status(400).send({ success: false, error: 'Reservation has expired' });
                eventId = res.eventId;
                items = res.items;
            }

            if (!eventId) return reply.status(400).send({ success: false, error: 'eventId is required' });
            if (!items || items.length === 0) return reply.status(400).send({ success: false, error: 'items are required' });

            const eventDoc = await fastify.db.collection('events').doc(eventId).get();
            if (!eventDoc.exists) return reply.status(404).send({ success: false, error: 'Event not found' });
            const event = { id: eventDoc.id, ...eventDoc.data() };

            const pricing = await calculatePricing({ event, items, promoCode, promoterCode });
            return { success: true, pricing };
        } catch (error: any) {
            fastify.log.error(`Checkout calculate failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: 'Internal server error' });
        }
    });

    /**
     * Validate pricing for a set of items
     * POST /checkout/validate
     */
    fastify.post('/checkout/validate', {
        preHandler: [fastify.validate({ body: CheckoutValidateBody })]
    }, async (request: any, reply) => {
        try {
            const workspaceId = request.workspaceId;
            const result = await fastify.checkoutService.validatePricing(request.body, workspaceId);
            return result;
        } catch (error: any) {
            fastify.log.error(`Pricing validation failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: "Internal server error" });
        }
    });

    /**
     * Validate Promo Code
     * POST /checkout/promo
     * Requires auth to prevent anonymous brute-forcing of promo codes.
     */
    fastify.post('/checkout/promo', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutPromoBody })]
    }, async (request: { body: any, user: any }, reply) => {
        const { eventId, code, items } = request.body;
        const userId = request.user?.uid || null;

        try {
            const result = await validatePromoCode(eventId, code, userId, items || []);
            if (result.valid) {
                return {
                    success: true,
                    valid: true,
                    discountAmount: result.discountAmount,
                    label: result.message
                };
            } else {
                return {
                    success: true,
                    valid: false,
                    error: result.error || "Invalid promo code"
                };
            }
        } catch (error: any) {
            fastify.log.error(`Promo validation failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });

    /**
     * Reserve Inventory
     * POST /checkout/reserve
     */
    fastify.post('/checkout/reserve', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutReserveBody })]
    }, async (request: any, reply) => {
        const { eventId, items, deviceId, admissionToken } = request.body;
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Authentication required to reserve tickets' });
        }

        try {
            const result = await fastify.checkoutService.reserveItems(
                eventId,
                userId,
                deviceId || null,
                items,
                request.workspaceId,
                { queueId: extractQueueId(admissionToken) }
            );
            request.log.info({
                eventId,
                userId,
                reservationId: result?.reservationId,
                workspaceId: request.workspaceId || null,
                queueId: extractQueueId(admissionToken),
            }, 'Checkout reservation created');
            return result;
        } catch (error: any) {
            fastify.log.error(`Reservation failed: ${error.message}`);
            return reply.status(409).send({ success: false, error: "Request conflict" });
        }
    });

    /**
     * Initiate Checkout (Orchestration)
     * POST /checkout/initiate
     */
    fastify.post('/checkout/initiate', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutInitiateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        try {
            const result = await fastify.checkoutService.initiateCheckout({
                ...request.body,
                userId
            }, request.workspaceId);

            request.log.info({
                eventId: result?.order?.eventId || request.body?.eventId,
                orderId: result?.order?.id,
                reservationId: request.body?.reservationId,
                userId,
                workspaceId: result?.order?.workspaceId || request.workspaceId || null,
            }, 'Checkout initiated');

            if (!result?.requiresPayment || !result?.order?.id) {
                return result;
            }

            const payment = await fastify.checkoutService.preparePayment(result.order.id, userId, {
                keyId: process.env.RAZORPAY_KEY_ID,
                keySecret: process.env.RAZORPAY_KEY_SECRET
            });

            return {
                success: true,
                requiresPayment: true,
                order: {
                    id: result.order.id,
                    totalAmount: result.pricing?.grandTotal ?? result.order.totalAmount,
                },
                pricing: result.pricing,
                razorpay: {
                    orderId: payment.razorpayOrderId,
                    amount: payment.amount,
                    currency: payment.currency,
                    key: payment.key,
                }
            };
        } catch (error: any) {
            const isContention = error.code === 10 || error.code === 'ABORTED' ||
                (error.message || '').toUpperCase().includes('ABORTED');

            if (isContention) {
                fastify.log.warn(`Firestore transaction contention on checkout initiate: ${error.message}`);
                Sentry.captureException(error, {
                    level: 'warning',
                    tags: { type: 'firestore_contention', route: 'checkout_initiate' },
                    extra: {
                        userId,
                        reservationId: request.body?.reservationId,
                        eventId: request.body?.eventId
                    }
                });
                return reply.status(409).send({ success: false, error: 'Checkout temporarily unavailable, please retry.' });
            }

            fastify.log.error(`Initiate checkout failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: "Internal server error" });
        }
    });

    fastify.post('/checkout/failure', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutFailureBody })]
    }, async (request: any, reply) => {
        const queueId = extractQueueId(request.body?.admissionToken);
        if (!queueId) {
            return reply.status(400).send({ success: false, error: 'Invalid token' });
        }

        try {
            await flagPaymentFailure(fastify.db, queueId);
            request.log.info({ queueId }, 'Checkout payment failure retry window restored');
            return { success: true, message: 'Retry window activated' };
        } catch (error: any) {
            fastify.log.error(`Checkout failure restore failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });

    /**
     * Cancel Reservation
     * POST /checkout/cancel
     * Requires auth and verifies the reservation/order belongs to the authenticated user.
     */
    fastify.post('/checkout/cancel', {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutCancelBody })]
    }, async (request: any, reply) => {
        const { reservationId, orderId } = request.body;
        const userId = request.user.uid;

        // Verify ownership before cancelling
        if (reservationId) {
            const resDoc = await fastify.db.collection('cart_reservations').doc(reservationId).get();
            if (!resDoc.exists) return reply.status(404).send({ success: false, error: 'Reservation not found' });
            if ((resDoc.data() as any).userId !== userId) {
                fastify.log.warn({ uid: userId, reservationId, ip: request.ip }, 'SECURITY: Unauthorized cancel attempt on reservation');
                return reply.status(403).send({ success: false, error: 'Forbidden: Not your reservation' });
            }
        } else if (orderId) {
            const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return reply.status(404).send({ success: false, error: 'Order not found' });
            const order = orderDoc.data() as any;
            if (order.userId !== userId && order.customerId !== userId) {
                fastify.log.warn({ uid: userId, orderId, ip: request.ip }, 'SECURITY: Unauthorized cancel attempt on order');
                return reply.status(403).send({ success: false, error: 'Forbidden: Not your order' });
            }
        }

        try {
            const result = await fastify.checkoutService.cancelCheckout(reservationId, orderId);
            await fastify.writeAuditLog({
                action: 'checkout.cancel',
                actorUid: userId,
                entityType: reservationId ? 'reservation' : 'order',
                entityId: (reservationId || orderId) as string,
                requestId: request.id,
                payload: { reservationId, orderId, ip: request.ip },
            });
            return result;
        } catch (error: any) {
            fastify.log.error(`Release reservation failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });
}

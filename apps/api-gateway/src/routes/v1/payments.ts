import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import { z } from 'zod';
// @ts-ignore
import { flagPaymentFailure } from '@c1rcle/core/surge';
import { logPaymentEvent } from '../../lib/securityLogger';

const PaymentOrderBody = z.object({
    orderId: z.string()
}).strict();

const PaymentVerifyBody = z.object({
    orderId: z.string(),
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string()
}).strict();

function getRazorpayKeyId() {
    return process.env.RAZORPAY_KEY_ID;
}

function getRazorpayKeySecret() {
    return process.env.RAZORPAY_KEY_SECRET;
}

function getRazorpayWebhookSecret() {
    return process.env.RAZORPAY_WEBHOOK_SECRET;
}

function getPaymentConfig() {
    return {
        key: getRazorpayKeyId() || 'rzp_test_DEVELOPMENT',
        currency: 'INR',
        name: 'THE C1RCLE',
        description: 'Event Tickets',
        theme: { color: '#1d1d1f' }
    };
}

function buildWebhookRawBody(request: any): string {
    if (typeof request.body === 'string') return request.body;
    if (Buffer.isBuffer(request.body)) return request.body.toString('utf8');
    return JSON.stringify(request.body || {});
}

export default async function paymentRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/payments/config
     * Get Razorpay client configuration
     */
    fastify.get('/payments/config', async (request, reply) => {
        return { config: getPaymentConfig() };
    });

    /**
     * POST /api/v1/payments/order
     * Create a Razorpay order from a pending system order
     */
    fastify.post('/payments/order', {
        preHandler: [fastify.validate({ body: PaymentOrderBody })]
    }, async (request: { body: any, user: any }, reply) => {
        const { orderId } = request.body;
        const userId = request.user?.uid;

        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const result = await fastify.checkoutService.preparePayment(orderId, userId, {
                keyId: getRazorpayKeyId(),
                keySecret: getRazorpayKeySecret()
            });
            logPaymentEvent(request as any, 'PAYMENT_ORDER_CREATED', {
                orderId,
                userId,
                razorpayOrderId: result?.razorpayOrderId,
            });
            return {
                ...result,
                config: getPaymentConfig(),
            };
        } catch (error: any) {
            fastify.log.error(`Payment order failed: ${error.message}`);
            const status = error.message === 'Forbidden'
                ? 403
                : error.message === 'Order not found'
                    ? 404
                    : error.message === 'Order is already confirmed'
                        ? 409
                        : error.message?.startsWith('Order is ')
                            ? 409
                            : 500;
            return reply.status(status).send({ error: error.message || 'Payment processing failed' });
        }
    });

    /**
     * PATCH /api/v1/payments/verify
     * Verify payment and confirm order
     */
    fastify.patch('/payments/verify', {
        preHandler: [fastify.validate({ body: PaymentVerifyBody })]
    }, async (request: { body: any, user: any }, reply) => {
        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = request.body;
        const userId = request.user?.uid;

        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            // Verify Signature
            const razorpayKeySecret = getRazorpayKeySecret();
            if (razorpayKeySecret) {
                const data = `${razorpay_order_id}|${razorpay_payment_id}`;
                const expected = crypto.createHmac("sha256", razorpayKeySecret).update(data).digest("hex");
                if (expected !== razorpay_signature) {
                    logPaymentEvent(request as any, 'SIGNATURE_MISMATCH', {
                        orderId,
                        razorpayOrderId: razorpay_order_id,
                        razorpayPaymentId: razorpay_payment_id,
                    });
                    return reply.status(400).send({ error: 'Invalid signature' });
                }
            }

            // Atomic Confirmation via Service
            const result = await fastify.checkoutService.verifyPayment({
                orderId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                userId
            });

            logPaymentEvent(request as any, result?.alreadyConfirmed ? 'PAYMENT_VERIFY_DUPLICATE' : 'PAYMENT_VERIFIED', {
                orderId,
                userId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
            });

            return {
                success: true,
                alreadyConfirmed: Boolean(result?.alreadyConfirmed),
                order: result?.order || null,
                message: result?.alreadyConfirmed ? 'Order already confirmed' : 'Order confirmed'
            };

        } catch (error: any) {
            fastify.log.error(`Payment verification failed: ${error.message}`);
            const status = error.message === 'Order not found'
                ? 404
                : error.message === 'Unauthorized'
                    ? 403
                    : error.message === 'Payment already linked to another order'
                        ? 409
                        : 500;
            return reply.status(status).send({ error: error.message || 'Internal server error' });
        }
    });

    fastify.post('/payments/webhook', async (request: any, reply) => {
        const rawBody = buildWebhookRawBody(request);
        const signature = request.headers['x-razorpay-signature'] as string | undefined;

        const webhookSecret = getRazorpayWebhookSecret();
        if (!webhookSecret) {
            fastify.log.error('RAZORPAY_WEBHOOK_SECRET is not configured');
            return reply.status(500).send({ error: 'Webhook not configured' });
        }

        const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        if (!signature || expected !== signature) {
            logPaymentEvent(request, 'SIGNATURE_MISMATCH', {});
            return reply.status(401).send({ error: 'Invalid signature' });
        }

        let payload: any;
        try {
            payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
        } catch {
            return reply.status(400).send({ error: 'Invalid payload' });
        }

        const eventType = payload?.event || payload?.type;
        const paymentEntity = payload?.payload?.payment?.entity || payload?.payment || payload;
        const paymentId = paymentEntity?.id || null;
        const orderId = paymentEntity?.notes?.orderId || payload?.orderId || null;
        const razorpayOrderId = paymentEntity?.order_id || payload?.razorpay_order_id || null;

        try {
            if ((eventType === 'payment.captured' || eventType === 'payment_success') && orderId && razorpayOrderId && paymentId) {
                const order = await fastify.orderRepo.getOrderById(orderId);
                if (!order) return reply.status(404).send({ error: 'Order not found' });

                const result = await fastify.checkoutService.verifyPayment({
                    orderId,
                    razorpayOrderId,
                    razorpayPaymentId: paymentId,
                    userId: order.userId,
                });

                logPaymentEvent(request, result?.alreadyConfirmed ? 'WEBHOOK_DUPLICATE' : 'WEBHOOK_CONFIRMED', {
                    orderId,
                    razorpayOrderId,
                    razorpayPaymentId: paymentId,
                    eventType,
                });

                return {
                    success: true,
                    alreadyConfirmed: Boolean(result?.alreadyConfirmed),
                    orderId,
                };
            }

            if (eventType === 'payment.failed' && orderId) {
                const order = await fastify.orderRepo.getOrderById(orderId);
                if (order) {
                    await fastify.orderRepo.updateOrder(orderId, {
                        status: 'payment_pending',
                        updatedAt: new Date().toISOString(),
                    }, order.isRSVP);

                    if (order.reservationId) {
                        const reservation = await fastify.orderRepo.getReservationById(order.reservationId);
                        if (reservation?.queueId) {
                            await flagPaymentFailure(fastify.db, reservation.queueId);
                        }
                    }
                }

                logPaymentEvent(request, 'PAYMENT_FAILED', {
                    orderId,
                    razorpayOrderId,
                    razorpayPaymentId: paymentId,
                    eventType,
                });

                return { success: true, orderId, status: 'payment_pending' };
            }

            return { success: true, ignored: true, eventType };
        } catch (error: any) {
            fastify.log.error(`Payment webhook failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}

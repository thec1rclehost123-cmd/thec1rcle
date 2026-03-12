import * as crypto from 'node:crypto';
import { z } from 'zod';
const PaymentOrderBody = z.object({
    orderId: z.string()
}).strict();
const PaymentVerifyBody = z.object({
    orderId: z.string(),
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string()
}).strict();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
export default async function paymentRoutes(fastify) {
    /**
     * GET /api/v1/payments/config
     * Get Razorpay client configuration
     */
    fastify.get('/payments/config', async (request, reply) => {
        return {
            config: {
                key: RAZORPAY_KEY_ID || "rzp_test_DEVELOPMENT",
                currency: "INR",
                name: "THE C1RCLE",
                description: "Event Tickets",
                theme: { color: "#1d1d1f" }
            }
        };
    });
    /**
     * POST /api/v1/payments/order
     * Create a Razorpay order from a pending system order
     */
    fastify.post('/payments/order', {
        preHandler: [fastify.validate({ body: PaymentOrderBody })]
    }, async (request, reply) => {
        const { orderId } = request.body;
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: 'Unauthorized' });
        try {
            const result = await fastify.checkoutService.preparePayment(orderId, userId, {
                keyId: RAZORPAY_KEY_ID,
                keySecret: RAZORPAY_KEY_SECRET
            });
            return result;
        }
        catch (error) {
            fastify.log.error(`Payment order failed: ${error.message}`);
            const status = error.message === 'Forbidden' ? 403 : (error.message === 'Order not found' ? 404 : 500);
            return reply.status(status).send({ error: error.message || 'Internal Server Error' });
        }
    });
    /**
     * PATCH /api/v1/payments/verify
     * Verify payment and confirm order
     */
    fastify.patch('/payments/verify', {
        preHandler: [fastify.validate({ body: PaymentVerifyBody })]
    }, async (request, reply) => {
        const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: 'Unauthorized' });
        try {
            // Verify Signature
            if (RAZORPAY_KEY_SECRET) {
                const data = `${razorpay_order_id}|${razorpay_payment_id}`;
                const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(data).digest("hex");
                if (expected !== razorpay_signature) {
                    return reply.status(400).send({ error: 'Invalid signature' });
                }
            }
            // Atomic Confirmation via Service
            await fastify.checkoutService.verifyPayment({
                orderId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                userId
            });
            return { success: true, message: 'Order confirmed' };
        }
        catch (error) {
            fastify.log.error(`Payment verification failed: ${error.message}`);
            return reply.status(500).send({ error: error.message || 'Internal Server Error' });
        }
    });
}
//# sourceMappingURL=payments.js.map
import { FastifyInstance } from 'fastify';
// @ts-ignore
import { validatePromoCode } from '@c1rcle/core/promo-service';

export default async function checkoutRoutes(fastify: FastifyInstance) {
    /**
     * Validate pricing for a set of items
     * POST /checkout/validate
     */
    fastify.post('/checkout/validate', async (request: { body: any, user: any }, reply) => {
        try {
            const result = await fastify.checkoutService.validatePricing(request.body);
            return result;
        } catch (error: any) {
            fastify.log.error(`Pricing validation failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
        }
    });

    /**
     * Validate Promo Code
     * POST /checkout/promo
     */
    fastify.post('/checkout/promo', async (request: { body: any, user: any }, reply) => {
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
    fastify.post('/checkout/reserve', async (request: { body: any, user: any }, reply) => {
        const { eventId, items, deviceId } = request.body;
        const userId = request.user?.uid || deviceId || 'anonymous';

        try {
            const result = await fastify.checkoutService.reserveItems(eventId, userId, deviceId || null, items);
            return result;
        } catch (error: any) {
            fastify.log.error(`Reservation failed: ${error.message}`);
            return reply.status(409).send({ success: false, error: error.message || 'Failed to reserve tickets' });
        }
    });

    /**
     * Initiate Checkout (Orchestration)
     * POST /checkout/initiate
     */
    fastify.post('/checkout/initiate', async (request: { body: any, user: any }, reply) => {
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        try {
            const result = await fastify.checkoutService.initiateCheckout({
                ...request.body,
                userId
            });
            return result;
        } catch (error: any) {
            fastify.log.error(`Initiate checkout failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
        }
    });

    /**
     * Cancel Reservation
     * POST /checkout/cancel
     */
    fastify.post('/checkout/cancel', async (request: { body: any }, reply) => {
        const { reservationId, orderId } = request.body;
        try {
            const result = await fastify.checkoutService.cancelCheckout(reservationId, orderId);
            return result;
        } catch (error: any) {
            fastify.log.error(`Release reservation failed: ${error.message}`);
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });
}

import { FastifyInstance } from 'fastify';
// @ts-ignore
import { validatePromoCode } from '@c1rcle/core/promo-service';
import { z } from 'zod';
import * as Sentry from '@sentry/node';

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
    deviceId: z.string().optional()
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

export default async function checkoutRoutes(fastify: FastifyInstance) {
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
            return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
        }
    });

    /**
     * Validate Promo Code
     * POST /checkout/promo
     */
    fastify.post('/checkout/promo', {
        preHandler: [fastify.validate({ body: CheckoutPromoBody })]
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
        preHandler: [fastify.validate({ body: CheckoutReserveBody })]
    }, async (request: any, reply) => {
        const { eventId, items, deviceId } = request.body;
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Authentication required to reserve tickets' });
        }

        try {
            const workspaceId = request.workspaceId;
            if (!workspaceId) return reply.status(400).send({ success: false, error: 'Missing x-workspace-id header' });

            const result = await fastify.checkoutService.reserveItems(eventId, userId, deviceId || null, items, workspaceId);
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
    fastify.post('/checkout/initiate', {
        preHandler: [fastify.validate({ body: CheckoutInitiateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) {
            return reply.status(401).send({ success: false, error: 'Authentication required' });
        }

        try {
            const workspaceId = request.workspaceId;
            if (!workspaceId) return reply.status(400).send({ success: false, error: 'Missing x-workspace-id header' });

            const result = await fastify.checkoutService.initiateCheckout({
                ...request.body,
                userId
            }, workspaceId);
            return result;
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
            return reply.status(500).send({ success: false, error: error.message || 'Internal Server Error' });
        }
    });

    /**
     * Cancel Reservation
     * POST /checkout/cancel
     */
    fastify.post('/checkout/cancel', {
        preHandler: [fastify.validate({ body: CheckoutCancelBody })]
    }, async (request: { body: any }, reply) => {
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

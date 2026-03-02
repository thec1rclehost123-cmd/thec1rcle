import { FastifyInstance } from 'fastify';
import { createPromoCode, getPromoCodeByCode, upsertPromoCode, getPromoCodeById, getEventPromoCodes, validatePromoCode } from '@c1rcle/core/promo-service';
import { z } from 'zod';

const EventIdParam = z.object({ eventId: z.string() }).strict();
const PromoIdParam = z.object({ id: z.string() }).strict();

const CreatePromoBody = z.object({
    eventId: z.string(),
    codeData: z.record(z.string(), z.any())
}).strict();

const ValidatePromoBody = z.object({
    eventId: z.string(),
    code: z.string(),
    userId: z.string().optional(),
    items: z.array(z.any()).optional()
}).strict();

export default async function promoRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/promos/event/:eventId
     */
    fastify.get('/event/:eventId', {
        preHandler: [fastify.validate({ params: EventIdParam })]
    }, async (request, reply) => {
        const { eventId } = request.params as { eventId: string };
        try {
            return await getEventPromoCodes(eventId);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /api/v1/promos/:id
     */
    fastify.get('/:id', {
        preHandler: [fastify.validate({ params: PromoIdParam })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return await getPromoCodeById(id);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/promos
     */
    fastify.post('/', {
        preHandler: [fastify.validate({ body: CreatePromoBody })]
    }, async (request, reply) => {
        const { eventId, codeData } = request.body as any;
        const user = (request as any).user;
        try {
            return await upsertPromoCode(eventId, codeData, user);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/promos/validate
     */
    fastify.post('/validate', {
        preHandler: [fastify.validate({ body: ValidatePromoBody })]
    }, async (request, reply) => {
        const { eventId, code, userId, items } = request.body as any;
        try {
            return await validatePromoCode(eventId, code, userId, items);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });
}

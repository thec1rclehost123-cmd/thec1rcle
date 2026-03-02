import { FastifyInstance } from 'fastify';
import { getVenueAvailability, blockDate, unblockDate, createSlotRequest, respondToSlotRequest } from '@c1rcle/core/calendar-engine';
import { z } from 'zod';

const VenueIdParam = z.object({ id: z.string() }).strict();
const DateRangeQuery = z.object({ start: z.string(), end: z.string() }).strict();
const OperatingQuery = z.object({ partnerId: z.string().optional(), role: z.string().optional(), start: z.string(), end: z.string() }).strict();

const BlockDateBody = z.object({
    venueId: z.string(),
    date: z.string(),
    reason: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional()
}).strict();

const UnblockDateBody = z.object({
    venueId: z.string(),
    date: z.string()
}).strict();

const SlotRequestBody = z.object({
    venueId: z.string().optional(),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    details: z.string().optional()
}).catchall(z.any());

const SlotRespondBody = z.object({
    id: z.string(),
    action: z.enum(['approve', 'reject']),
    responseData: z.any().optional()
}).strict();

export default async function calendarRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/calendar/venue/:id
     */
    fastify.get('/venue/:id', {
        preHandler: [fastify.validate({ params: VenueIdParam, querystring: DateRangeQuery })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { start, end } = request.query as { start: string, end: string };
        try {
            return await getVenueAvailability(id, start, end);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/calendar/block
     */
    fastify.post('/block', {
        preHandler: [fastify.validate({ body: BlockDateBody })]
    }, async (request, reply) => {
        const { venueId, date, reason, startTime, endTime } = request.body as any;
        const user = (request as any).user;
        try {
            return await blockDate(venueId, date, reason, user, startTime, endTime);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * DELETE /api/v1/calendar/block
     */
    fastify.delete('/block', {
        preHandler: [fastify.validate({ body: UnblockDateBody })]
    }, async (request, reply) => {
        const { venueId, date } = request.body as { venueId: string, date: string };
        try {
            return await unblockDate(venueId, date);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/calendar/slots/request
     */
    fastify.post('/slots/request', {
        preHandler: [fastify.validate({ body: SlotRequestBody })]
    }, async (request, reply) => {
        const data = request.body as any;
        try {
            return await createSlotRequest(data);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/calendar/slots/respond
     */
    fastify.post('/slots/respond', {
        preHandler: [fastify.validate({ body: SlotRespondBody })]
    }, async (request, reply) => {
        const { id, action, responseData } = request.body as any;
        const user = (request as any).user;
        try {
            return await respondToSlotRequest(id, action, responseData, user);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * GET /api/v1/calendar/operating
     */
    fastify.get('/operating', {
        preHandler: [fastify.validate({ querystring: OperatingQuery })]
    }, async (request, reply) => {
        const { partnerId, role, start, end } = request.query as any;
        try {
            const { getOperatingCalendar } = await import('@c1rcle/core/calendar-engine');
            // @ts-ignore
            return await getOperatingCalendar(fastify.db, partnerId, role, start, end);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });
}

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
        preHandler: [fastify.requirePartnerAccess((req) => (req.params as any).id), fastify.validate({ params: VenueIdParam, querystring: DateRangeQuery })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { start, end } = request.query as { start: string, end: string };
        try {
            return await getVenueAvailability(id, start, end);
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * POST /api/v1/calendar/block
     * Caller must manage the venue they are blocking dates for.
     */
    fastify.post('/block', {
        preHandler: [
            fastify.requirePartnerAccess((req) => (req.body as any).venueId),
            fastify.validate({ body: BlockDateBody })
        ]
    }, async (request, reply) => {
        const { venueId, date, reason, startTime, endTime } = request.body as any;
        const user = (request as any).user;
        try {
            return await blockDate(venueId, date, reason, user, startTime, endTime);
        } catch (error: any) {
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * DELETE /api/v1/calendar/block
     * Caller must manage the venue they are unblocking dates for.
     */
    fastify.delete('/block', {
        preHandler: [
            fastify.requirePartnerAccess((req) => (req.body as any).venueId),
            fastify.validate({ body: UnblockDateBody })
        ]
    }, async (request, reply) => {
        const { venueId, date } = request.body as { venueId: string, date: string };
        try {
            return await unblockDate(venueId, date);
        } catch (error: any) {
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * POST /api/v1/calendar/slots/request
     * Requires auth — actor identity is recorded in the slot request.
     */
    fastify.post('/slots/request', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: SlotRequestBody })]
    }, async (request, reply) => {
        const data = request.body as any;
        const actor = (request as any).user;
        try {
            return await createSlotRequest(data, actor);
        } catch (error: any) {
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * POST /api/v1/calendar/slots/respond
     * Caller must manage the venue whose slot request they are responding to.
     */
    fastify.post('/slots/respond', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: SlotRespondBody })]
    }, async (request: any, reply) => {
        const { id, action, responseData } = request.body as any;
        const user = request.user;
        // Fetch the slot request to resolve the venueId, then verify partner access
        try {
            const slotDoc = await fastify.db.collection('slot_requests').doc(id).get();
            if (!slotDoc.exists) return reply.status(404).send({ error: 'Slot request not found' });
            const venueId = (slotDoc.data() as any).venueId;
            if (venueId) {
                try {
                    await fastify.verifyPartnerAccess(request, venueId);
                } catch {
                    return reply.status(403).send({ error: 'Forbidden: Insufficient access to this venue' });
                }
            }
            return await respondToSlotRequest(id, action, responseData, user);
        } catch (error: any) {
            if (error.statusCode) throw error;
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * GET /api/v1/calendar/operating
     * Requires auth; if a specific partnerId is requested the caller must manage it.
     */
    fastify.get('/operating', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: OperatingQuery })]
    }, async (request: any, reply) => {
        const { partnerId, role, start, end } = request.query as any;
        if (partnerId) {
            try {
                await fastify.verifyPartnerAccess(request, partnerId);
            } catch {
                return reply.status(403).send({ error: 'Forbidden: Insufficient access to this partner' });
            }
        }
        try {
            const { getOperatingCalendar } = await import('@c1rcle/core/calendar-engine');
            // @ts-ignore
            return await getOperatingCalendar(fastify.db, partnerId, role, start, end);
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });
}

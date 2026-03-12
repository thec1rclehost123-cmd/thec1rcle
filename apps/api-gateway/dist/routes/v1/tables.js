import { getFloorPlan, updateMasterTable, assignTable, getEventAssignments } from '@c1rcle/core/table-engine';
import { z } from 'zod';
const VenueIdParam = z.object({ venueId: z.string() }).strict();
const EventIdParam = z.object({ eventId: z.string() }).strict();
const FloorPlanBody = z.record(z.string(), z.any());
const AssignBody = z.object({
    eventId: z.string(),
    tableId: z.string(),
    bookingId: z.string().optional(),
    status: z.string()
}).strict();
export default async function tableRoutes(fastify) {
    /**
     * GET /api/v1/tables/floor-plan/:venueId
     */
    fastify.get('/floor-plan/:venueId', {
        preHandler: [fastify.validate({ params: VenueIdParam })]
    }, async (request, reply) => {
        const { venueId } = request.params;
        try {
            return await getFloorPlan(venueId);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/tables/floor-plan/:venueId
     */
    fastify.post('/floor-plan/:venueId', {
        preHandler: [fastify.validate({ params: VenueIdParam, body: FloorPlanBody })]
    }, async (request, reply) => {
        const { venueId } = request.params;
        const tableData = request.body;
        try {
            return await updateMasterTable(venueId, tableData);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/tables/assign
     */
    fastify.post('/assign', {
        preHandler: [fastify.validate({ body: AssignBody })]
    }, async (request, reply) => {
        const { eventId, tableId, bookingId, status } = request.body;
        try {
            return await assignTable(eventId, tableId, bookingId, status);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/tables/assignments/:eventId
     */
    fastify.get('/assignments/:eventId', {
        preHandler: [fastify.validate({ params: EventIdParam })]
    }, async (request, reply) => {
        const { eventId } = request.params;
        try {
            return await getEventAssignments(eventId);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=tables.js.map
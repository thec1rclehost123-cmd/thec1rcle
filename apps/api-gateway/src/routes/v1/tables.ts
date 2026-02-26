import { FastifyInstance } from 'fastify';
import { getFloorPlan, updateMasterTable, assignTable, getEventAssignments } from '@c1rcle/core/table-engine';

export default async function tableRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/tables/floor-plan/:venueId
     */
    fastify.get('/floor-plan/:venueId', async (request, reply) => {
        const { venueId } = request.params as { venueId: string };
        try {
            return await getFloorPlan(venueId);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/tables/floor-plan/:venueId
     */
    fastify.post('/floor-plan/:venueId', async (request, reply) => {
        const { venueId } = request.params as { venueId: string };
        const tableData = request.body as any;
        try {
            return await updateMasterTable(venueId, tableData);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/tables/assign
     */
    fastify.post('/assign', async (request, reply) => {
        const { eventId, tableId, bookingId, status } = request.body as any;
        try {
            return await assignTable(eventId, tableId, bookingId, status);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * GET /api/v1/tables/assignments/:eventId
     */
    fastify.get('/assignments/:eventId', async (request, reply) => {
        const { eventId } = request.params as { eventId: string };
        try {
            return await getEventAssignments(eventId);
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });
}

import { getVenueAvailability, blockDate, unblockDate, createSlotRequest, respondToSlotRequest } from '@c1rcle/core/calendar-engine';
export default async function calendarRoutes(fastify) {
    /**
     * GET /api/v1/calendar/venue/:id
     */
    fastify.get('/venue/:id', async (request, reply) => {
        const { id } = request.params;
        const { start, end } = request.query;
        try {
            return await getVenueAvailability(id, start, end);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/calendar/block
     */
    fastify.post('/block', async (request, reply) => {
        const { venueId, date, reason, startTime, endTime } = request.body;
        const user = request.user;
        try {
            return await blockDate(venueId, date, reason, user, startTime, endTime);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * DELETE /api/v1/calendar/block
     */
    fastify.delete('/block', async (request, reply) => {
        const { venueId, date } = request.body;
        try {
            return await unblockDate(venueId, date);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/calendar/slots/request
     */
    fastify.post('/slots/request', async (request, reply) => {
        const data = request.body;
        try {
            return await createSlotRequest(data);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/calendar/slots/respond
     */
    fastify.post('/slots/respond', async (request, reply) => {
        const { id, action, responseData } = request.body;
        const user = request.user;
        try {
            return await respondToSlotRequest(id, action, responseData, user);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/calendar/operating
     */
    fastify.get('/operating', async (request, reply) => {
        const { partnerId, role, start, end } = request.query;
        try {
            const { getOperatingCalendar } = await import('@c1rcle/core/calendar-engine');
            // @ts-ignore
            return await getOperatingCalendar(fastify.db, partnerId, role, start, end);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=calendar.js.map
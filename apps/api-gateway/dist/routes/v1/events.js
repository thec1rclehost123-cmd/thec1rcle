export default async function eventRoutes(fastify) {
    /**
     * GET /api/v1/events
     * List events with filters
     */
    fastify.get('/events', async (request, reply) => {
        try {
            const result = await fastify.eventService.listEvents(request.query);
            return result;
        }
        catch (error) {
            fastify.log.error(`Error in GET /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * GET /api/v1/events/nearby
     */
    fastify.get('/events/nearby', async (request, reply) => {
        const { lat, lng, radius = 50, limit = 20 } = request.query;
        if (!lat || !lng)
            return reply.status(400).send({ error: "lat and lng are required" });
        try {
            const events = await fastify.eventService.listNearby(Number(lat), Number(lng), Number(radius), Number(limit));
            return events;
        }
        catch (error) {
            fastify.log.error(`Error in GET /events/nearby: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * GET /api/v1/events/:id
     * Fetch event by ID or Slug
     */
    fastify.get('/events/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const event = await fastify.eventService.getEventByIdOrSlug(id);
            if (!event)
                return reply.status(404).send({ error: "Event not found" });
            return event;
        }
        catch (error) {
            fastify.log.error(`Error in GET /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * POST /api/v1/events
     * Create new event
     */
    fastify.post('/events', async (request, reply) => {
        const userId = request.user?.uid;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        try {
            const event = await fastify.eventService.createEvent(request.body, userId);
            return { success: true, id: event.id };
        }
        catch (error) {
            fastify.log.error(`Error in POST /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * PATCH /api/v1/events/:id
     */
    fastify.patch('/events/:id', async (request, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        try {
            const event = await fastify.eventService.updateEvent(id, request.body, userId);
            if (!event)
                return reply.status(404).send({ error: "Event not found" });
            return { success: true, id: event.id };
        }
        catch (error) {
            fastify.log.error(`Error in PATCH /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
    /**
     * DELETE /api/v1/events/:id
     */
    fastify.delete('/events/:id', async (request, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        try {
            await fastify.eventService.deleteEvent(id, userId);
            return { success: true, message: "Event deleted" };
        }
        catch (error) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=events.js.map
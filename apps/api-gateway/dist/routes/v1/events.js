export default async function eventRoutes(fastify) {
    /**
     * GET /api/v1/events
     * List events with filters
     */
    fastify.get('/events', async (request, reply) => {
        try {
            const cacheKey = JSON.stringify(request.query || {});
            const cached = await fastify.cache.get('events:list', cacheKey);
            if (cached)
                return cached;
            const result = await fastify.eventService.listEvents(request.query);
            await fastify.cache.set('events:list', cacheKey, result, 60); // 60s TTL
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
            const cacheKey = JSON.stringify({ lat, lng, radius, limit });
            const cached = await fastify.cache.get('events:nearby', cacheKey);
            if (cached)
                return cached;
            const events = await fastify.eventService.listNearby(Number(lat), Number(lng), Number(radius), Number(limit));
            await fastify.cache.set('events:nearby', cacheKey, events, 60); // 60s TTL
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
            const cached = await fastify.cache.get('events:detail', id);
            if (cached)
                return cached;
            const event = await fastify.eventService.getEventByIdOrSlug(id);
            if (!event)
                return reply.status(404).send({ error: "Event not found" });
            await fastify.cache.set('events:detail', id, event, 120); // 120s TTL
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
            // Invalidate event lists when a new event is created
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
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
            // Invalidate the specific event detail and all lists
            await fastify.cache.delete('events:detail', id);
            if (event.slug)
                await fastify.cache.delete('events:detail', event.slug);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
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
            // Invalidate cache
            await fastify.cache.delete('events:detail', id);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            return { success: true, message: "Event deleted" };
        }
        catch (error) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=events.js.map
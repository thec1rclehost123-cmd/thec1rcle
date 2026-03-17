import { z } from 'zod';
const EventNearbyQuery = z.object({
    lat: z.string(),
    lng: z.string(),
    radius: z.string().optional(),
    limit: z.string().optional()
}).strict();
const EventParamId = z.object({
    id: z.string()
}).strict();
const EventCreateBody = z.object({
    title: z.string(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    venue: z.string().optional(),
    venueId: z.string().optional(),
    image: z.string().optional(),
    poster: z.string().optional(),
    status: z.string().optional(),
    lifecycle: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isPrivate: z.boolean().optional(),
    capacity: z.number().optional()
}).passthrough();
const EventUpdateBody = EventCreateBody.partial().passthrough();
export default async function eventRoutes(fastify) {
    /**
     * GET /api/v1/events
     * List events with filters
     */
    fastify.get('/events', async (request, reply) => {
        try {
            const rawQuery = request.query || {};
            const workspaceId = request.workspaceId; // 🏢 SaaS: Extract tenant context
            const query = {
                ...rawQuery,
                limit: parseInt(rawQuery.limit, 10) || 12,
                lastId: rawQuery.lastId || undefined
            };
            // 🛡️ SaaS: If workspaceId is provided, scope the cache and query
            const cacheKey = JSON.stringify({ ...query, workspaceId });
            const cached = await fastify.cache.get('events:list', cacheKey);
            if (cached)
                return cached;
            const result = await fastify.eventService.listEvents(query, workspaceId);
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
    fastify.get('/events/nearby', {
        preHandler: [fastify.validate({ querystring: EventNearbyQuery })]
    }, async (request, reply) => {
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
    fastify.get('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request, reply) => {
        const { id } = request.params;
        const workspaceId = request.workspaceId; // 🛡️ SaaS: Contextual fetch
        try {
            const cacheKey = `${id}:${workspaceId || 'global'}`;
            const cached = await fastify.cache.get('events:detail', cacheKey);
            if (cached)
                return cached;
            const event = await fastify.eventService.getEventByIdOrSlug(id, workspaceId);
            if (!event)
                return reply.status(404).send({ error: "Event not found" });
            await fastify.cache.set('events:detail', cacheKey, event, 300); // 300s TTL
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
    fastify.post('/events', {
        preHandler: [fastify.validate({ body: EventCreateBody })]
    }, async (request, reply) => {
        const userId = request.user?.uid;
        const workspaceId = request.workspaceId;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        if (!workspaceId)
            return reply.status(400).send({ error: "Missing x-workspace-id header" });
        let actorId = userId;
        // If a venue/host is creating the event on behalf of their entity, preserve their creatorId
        if (request.body.creatorId && request.body.creatorId !== userId) {
            try {
                await fastify.verifyPartnerAccess(request, request.body.creatorId);
                actorId = request.body.creatorId;
            }
            catch (error) {
                return reply.status(403).send({ error: "Forbidden: Cannot create an event for this entity." });
            }
        }
        try {
            const event = await fastify.eventService.createEvent(request.body, actorId, workspaceId);
            // Invalidate event lists for this workspace
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            // Broadcast real-time targeted update
            fastify.broadcast({
                type: 'EVENT_CREATED',
                payload: { id: event.id, title: event.title, status: event.status, workspaceId }
            }, `workspace:${workspaceId}`);
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
    fastify.patch('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventUpdateBody })]
    }, async (request, reply) => {
        const userId = request.user?.uid;
        const workspaceId = request.workspaceId;
        const { id } = request.params;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        if (!workspaceId)
            return reply.status(400).send({ error: "Missing x-workspace-id header" });
        try {
            const event = await fastify.eventService.updateEvent(id, request.body, userId, workspaceId);
            if (!event)
                return reply.status(404).send({ error: "Event not found in this workspace" });
            // Invalidate the specific event detail and all lists
            const cacheKeyId = `${id}:${workspaceId}`;
            await fastify.cache.delete('events:detail', cacheKeyId);
            if (event.slug)
                await fastify.cache.delete('events:detail', `${event.slug}:${workspaceId}`);
            // Namespace invalidation covers broad lists (nearby, discovery)
            await Promise.all([
                fastify.cache.invalidateNamespace('events:list'),
                fastify.cache.invalidateNamespace('events:nearby')
            ]);
            // Broadcast real-time targeted update
            fastify.broadcast({
                type: 'EVENT_UPDATED',
                payload: { id: event.id, title: event.title, status: event.status, workspaceId }
            }, `workspace:${workspaceId}`);
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
    fastify.delete('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request, reply) => {
        const userId = request.user?.uid;
        const workspaceId = request.workspaceId;
        const { id } = request.params;
        if (!userId)
            return reply.status(401).send({ error: "Unauthorized" });
        if (!workspaceId)
            return reply.status(400).send({ error: "Missing x-workspace-id header" });
        try {
            await fastify.eventService.deleteEvent(id, userId, workspaceId);
            // Invalidate cache
            const cacheKeyId = `${id}:${workspaceId}`;
            await fastify.cache.delete('events:detail', cacheKeyId);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            return { success: true, message: "Event deleted", workspaceId };
        }
        catch (error) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=events.js.map
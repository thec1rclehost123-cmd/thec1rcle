import { FastifyInstance } from 'fastify';
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

export default async function eventRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/events
     * List events with filters
     */
    fastify.get('/events', async (request: any, reply) => {
        try {
            const rawQuery = request.query || {};
            // Firestore requires integer for .limit() — parse numeric params
            const query = {
                ...rawQuery,
                ...(rawQuery.limit !== undefined && { limit: parseInt(rawQuery.limit, 10) || 12 }),
                ...(rawQuery.page !== undefined && { page: parseInt(rawQuery.page, 10) || 1 }),
            };

            const cacheKey = JSON.stringify(query);
            const cached = await fastify.cache.get('events:list', cacheKey);
            if (cached) return cached;

            const result = await fastify.eventService.listEvents(query);

            await fastify.cache.set('events:list', cacheKey, result, 60); // 60s TTL
            return result;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * GET /api/v1/events/nearby
     */
    fastify.get('/events/nearby', {
        preHandler: [fastify.validate({ querystring: EventNearbyQuery })]
    }, async (request: any, reply) => {
        const { lat, lng, radius = 50, limit = 20 } = request.query;
        if (!lat || !lng) return reply.status(400).send({ error: "lat and lng are required" });

        try {
            const cacheKey = JSON.stringify({ lat, lng, radius, limit });
            const cached = await fastify.cache.get('events:nearby', cacheKey);
            if (cached) return cached;

            const events = await fastify.eventService.listNearby(Number(lat), Number(lng), Number(radius), Number(limit));

            await fastify.cache.set('events:nearby', cacheKey, events, 60); // 60s TTL
            return events;
        } catch (error: any) {
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
    }, async (request: any, reply) => {
        const { id } = request.params;
        try {
            const cached = await fastify.cache.get('events:detail', id);
            if (cached) return cached;

            const event = await fastify.eventService.getEventByIdOrSlug(id);
            if (!event) return reply.status(404).send({ error: "Event not found" });

            await fastify.cache.set('events:detail', id, event, 120); // 120s TTL
            return event;
        } catch (error: any) {
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
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        let actorId = userId;

        // If a venue/host is creating the event on behalf of their entity, preserve their creatorId
        if (request.body.creatorId && request.body.creatorId !== userId) {
            try {
                await fastify.verifyPartnerAccess(request, request.body.creatorId);
                actorId = request.body.creatorId;
            } catch (error) {
                return reply.status(403).send({ error: "Forbidden: Cannot create an event for this entity." });
            }
        }

        try {
            const event = await fastify.eventService.createEvent(request.body, actorId);

            // Invalidate event lists when a new event is created
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');

            // Broadcast real-time targeted update
            fastify.broadcast({
                type: 'EVENT_CREATED',
                payload: { id: event.id, title: event.title, status: event.status }
            }, 'events:global');

            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in POST /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * PATCH /api/v1/events/:id
     */
    fastify.patch('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventUpdateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        try {
            const event = await fastify.eventService.updateEvent(id, request.body, userId);
            if (!event) return reply.status(404).send({ error: "Event not found" });

            // Invalidate the specific event detail and all lists
            await fastify.cache.delete('events:detail', id);
            if (event.slug) await fastify.cache.delete('events:detail', event.slug);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');

            // Broadcast real-time targeted update
            fastify.broadcast({
                type: 'EVENT_UPDATED',
                payload: { id: event.id, title: event.title, status: event.status }
            }, `event:${id}`);

            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * DELETE /api/v1/events/:id
     */
    fastify.delete('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        try {
            await fastify.eventService.deleteEvent(id, userId);

            // Invalidate cache
            await fastify.cache.delete('events:detail', id);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');

            return { success: true, message: "Event deleted" };
        } catch (error: any) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import {
    getEventQueueStatus,
    getEventSurgeStatus,
    joinEventQueue,
    joinEventWaitlist,
    toggleEventRsvp,
    trackGuestEventInteraction,
    trackGuestEventView,
    verifyEventWaitlistAccess,
} from '@c1rcle/core/guest-event-conversion';

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
const EventTrackBody = z.object({
    type: z.string().optional(),
    ref: z.string().optional(),
}).passthrough();
const EventRsvpBody = z.object({
    shouldInclude: z.boolean(),
}).strict();
const EventQueueQuery = z.object({
    queueId: z.string().optional(),
}).strict();
const EventQueueBody = z.object({
    userId: z.string().optional(),
}).passthrough();
const EventWaitlistQuery = z.object({
    email: z.string().email(),
}).strict();
const EventWaitlistBody = z.object({
    ticketId: z.string().optional(),
    tierId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
}).passthrough();

function getRequestViewerId(request: any) {
    const ip = request.headers['x-forwarded-for'] || request.ip || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'unknown';
    return Buffer.from(`${ip}-${userAgent}`).toString('base64');
}

export default async function eventRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/events
     * List events with filters
     */
    fastify.get('/events', async (request: any, reply) => {
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
            if (cached) return cached;

            const result = await fastify.eventService.listEvents(query, workspaceId);

            await fastify.cache.set('events:list', cacheKey, result, 60); // 60s TTL
            return result;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * GET /api/v1/events/nearby
     */
    fastify.get('/events/nearby', {
        preHandler: [fastify.validate({ querystring: EventNearbyQuery })]
    }, async (request: any, reply) => {
        const { lat, lng, radius = 50, limit = 20 } = request.query;
        if (!lat || !lng) return reply.status(400).send(buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'lat and lng are required',
            requestId: request.id,
        }));

        try {
            const cacheKey = JSON.stringify({ lat, lng, radius, limit });
            const cached = await fastify.cache.get('events:nearby', cacheKey);
            if (cached) return cached;

            const events = await fastify.eventService.listNearby(Number(lat), Number(lng), Number(radius), Number(limit));

            await fastify.cache.set('events:nearby', cacheKey, events, 60); // 60s TTL
            return events;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events/nearby: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/events/:id/view', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request: any, reply) => {
        try {
            return await trackGuestEventView(fastify.db, {
                eventId: request.params.id,
                viewerId: getRequestViewerId(request),
            });
        } catch (error: any) {
            request.log.warn({ error }, 'Non-critical event view tracking failed');
            return { ok: true };
        }
    });

    fastify.post('/events/:id/track', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventTrackBody })]
    }, async (request: any, reply) => {
        try {
            return await trackGuestEventInteraction(fastify.db, {
                eventId: request.params.id,
                type: request.body?.type,
                ref: request.body?.ref,
            });
        } catch (error: any) {
            request.log.warn({ error }, 'Non-critical event interaction tracking failed');
            return { ok: true };
        }
    });

    fastify.post('/events/:id/rsvp', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventRsvpBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
        }));

        try {
            const result = await toggleEventRsvp(fastify.db, {
                eventId: request.params.id,
                userId,
                shouldInclude: request.body.shouldInclude,
            });
            if (typeof fastify.invalidatePublicDiscovery === 'function') {
                await fastify.invalidatePublicDiscovery('events').catch(() => undefined);
            }
            return result;
        } catch (error: any) {
            request.log.error({ error }, 'Failed to update event RSVP');
            const status = error.message === 'Event not found' || error.message === 'User profile not found' ? 404 : 500;
            return reply.status(status).send(buildErrorResponse({
                code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
                message: error.message || 'Unable to update RSVP',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/events/:id/queue', {
        preHandler: [fastify.validate({ params: EventParamId, querystring: EventQueueQuery })]
    }, async (request: any, reply) => {
        try {
            const { queueId } = request.query;
            if (!queueId) {
                const status = await getEventSurgeStatus(fastify.db, request.params.id);
                return { surgeActive: status?.status === 'surge' };
            }

            return await getEventQueueStatus(fastify.db, queueId);
        } catch (error: any) {
            request.log.error({ error }, 'Failed to load event queue status');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: error.message || 'Unable to load queue status',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/events/:id/queue', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventQueueBody })]
    }, async (request: any, reply) => {
        try {
            const userId = request.user?.uid || request.body?.userId || 'anonymous';
            const deviceId = request.headers['user-agent'] || 'default';
            return await joinEventQueue(fastify.db, {
                eventId: request.params.id,
                userId,
                deviceId,
            });
        } catch (error: any) {
            request.log.error({ error }, 'Failed to join event queue');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: error.message || 'Unable to join queue',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/events/:id/waitlist', {
        preHandler: [fastify.validate({ params: EventParamId, querystring: EventWaitlistQuery })]
    }, async (request: any, reply) => {
        try {
            const accessDetails = await verifyEventWaitlistAccess(fastify.db, {
                eventId: request.params.id,
                email: request.query.email,
            });
            return { hasAccess: Boolean(accessDetails), accessDetails };
        } catch (error: any) {
            request.log.error({ error }, 'Failed to verify event waitlist access');
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: error.message || 'Unable to verify waitlist access',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/events/:id/waitlist', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventWaitlistBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid || null;
        const email = request.user?.email || request.body?.email;
        if (!email) return reply.status(400).send(buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'Email is required',
            requestId: request.id,
        }));

        try {
            const entry = await joinEventWaitlist(fastify.db, {
                eventId: request.params.id,
                ticketId: request.body?.ticketId,
                tierId: request.body?.tierId,
                userId,
                email,
                phone: request.body?.phone,
            });
            return { success: true, message: 'Added to waitlist', entry };
        } catch (error: any) {
            request.log.error({ error }, 'Failed to join event waitlist');
            return reply.status(400).send(buildErrorResponse({
                code: 'BAD_REQUEST',
                message: error.message || 'Unable to join waitlist',
                requestId: request.id,
            }));
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
        const workspaceId = request.workspaceId; // 🛡️ SaaS: Contextual fetch
        try {
            const cacheKey = `${id}:${workspaceId || 'global'}`;
            const cached = await fastify.cache.get('events:detail', cacheKey);
            if (cached) return cached;

            const event = await fastify.eventService.getEventByIdOrSlug(id, workspaceId);
            if (!event) return reply.status(404).send(buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
            }));

            await fastify.cache.set('events:detail', cacheKey, event, 300); // 300s TTL
            return event;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events/:id: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
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
        const workspaceId = request.workspaceId;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
        if (!workspaceId) return reply.status(400).send(buildErrorResponse({ code: 'MISSING_SCOPE', message: 'Missing x-workspace-id header', requestId: request.id }));

        let actorId = userId;

        // If a venue/host is creating the event on behalf of their entity, preserve their creatorId
        if (request.body.creatorId && request.body.creatorId !== userId) {
            try {
                await fastify.verifyPartnerAccess(request, request.body.creatorId);
                actorId = request.body.creatorId;
            } catch (error) {
                return reply.status(403).send(buildErrorResponse({
                    code: 'FORBIDDEN',
                    message: 'Forbidden: Cannot create an event for this entity.',
                    requestId: request.id,
                }));
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
            await fastify.publicDiscoveryService.syncEventReadModels(event.id);
            await fastify.invalidatePublicDiscovery('all');
            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in POST /events: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * PATCH /api/v1/events/:id
     */
    fastify.patch('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventUpdateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const workspaceId = request.workspaceId;
        const { id } = request.params;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
        if (!workspaceId) return reply.status(400).send(buildErrorResponse({ code: 'MISSING_SCOPE', message: 'Missing x-workspace-id header', requestId: request.id }));

        try {
            const event = await fastify.eventService.updateEvent(id, request.body, userId, workspaceId);
            if (!event) return reply.status(404).send(buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found in this workspace',
                requestId: request.id,
            }));

            // Invalidate the specific event detail and all lists
            const cacheKeyId = `${id}:${workspaceId}`;
            await fastify.cache.delete('events:detail', cacheKeyId);
            if (event.slug) await fastify.cache.delete('events:detail', `${event.slug}:${workspaceId}`);
            
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
            await fastify.publicDiscoveryService.syncEventReadModels(event.id);
            await fastify.invalidatePublicDiscovery('all');
            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /events/:id: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });

    /**
     * DELETE /api/v1/events/:id
     */
    fastify.delete('/events/:id', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const workspaceId = request.workspaceId;
        const { id } = request.params;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
        if (!workspaceId) return reply.status(400).send(buildErrorResponse({ code: 'MISSING_SCOPE', message: 'Missing x-workspace-id header', requestId: request.id }));

        try {
            await fastify.eventService.deleteEvent(id, userId, workspaceId);

            // Invalidate cache
            const cacheKeyId = `${id}:${workspaceId}`;
            await fastify.cache.delete('events:detail', cacheKeyId);
            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            await fastify.publicDiscoveryService.syncEventReadModels(id);
            await fastify.invalidatePublicDiscovery('all');
            return { success: true, message: "Event deleted", workspaceId };
        } catch (error: any) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Internal Server Error',
                requestId: request.id,
            }));
        }
    });
}

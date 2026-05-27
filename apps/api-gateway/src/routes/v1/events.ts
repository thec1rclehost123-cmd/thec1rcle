import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { resolvePartnerContext } from '../../lib/partner-context.js';
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
// @ts-ignore - JS module with runtime exports
import { buildEvent } from '@c1rcle/core/event-engine';

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
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    venue: z.string().optional(),
    venueId: z.string().optional(),
    image: z.string().optional(),
    poster: z.string().optional(),
    status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
    lifecycle: z.enum(['active', 'archived', 'deleted']).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).max(10).optional(),
    isPrivate: z.boolean().optional(),
    capacity: z.number().int().positive().optional(),
    creatorId: z.string().optional(),
}).strict();

const EventUpdateBody = EventCreateBody.partial();

// Wizard auto-save sends { actor, updates } — accept both flat and wrapped forms.
const PartnerEventUpdateBody = z.union([
    z.object({ actor: z.unknown(), updates: z.record(z.string(), z.unknown()), action: z.string().optional() }),
    z.record(z.string(), z.unknown()),
]);

// Partner wizard sends a rich payload — validate only the required fields
// and use .passthrough() so extra fields (tickets, tables, promoterSettings, etc.)
// flow through to buildEvent() without being stripped.
const PartnerEventCreateBody = z.object({
    title: z.string().min(1).max(200),
    creatorRole: z.enum(['host', 'venue', 'club']),
    creatorId: z.string().optional(),
    hostId: z.string().optional(),
    venueId: z.string().optional(),
    lifecycle: z.enum(['draft', 'submitted', 'scheduled', 'live', 'completed', 'cancelled', 'paused', 'denied', 'changes_requested']).optional(),
}).passthrough();
const EventTrackBody = z.object({
    type: z.enum(['view', 'click', 'share', 'rsvp_intent']),
    ref: z.string().max(100).optional(),
}).strict();
const EventRsvpBody = z.object({
    shouldInclude: z.boolean(),
}).strict();
const EventQueueQuery = z.object({
    queueId: z.string().optional(),
}).strict();
const EventQueueBody = z.object({}).strict();
function getRequestViewerId(request: any) {
    const ip = request.headers['x-forwarded-for'] || request.ip || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'unknown';
    return Buffer.from(`${ip}-${userAgent}`).toString('base64');
}

async function getEventViewerState(db: any, eventId: string, userId: string | null) {
    const surgeStatus = await getEventSurgeStatus(db, eventId);
    if (!userId) {
        return {
            hasRsvped: false,
            queue: null,
            surgeActive: surgeStatus?.status === 'surge',
        };
    }

    const [userDoc, queueSnapshot] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('event_queues')
            .where('eventId', '==', eventId)
            .where('userId', '==', userId)
            .where('status', 'in', ['waiting', 'admitted', 'payment_failed'])
            .limit(1)
            .get(),
    ]);

    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const attendedEvents = Array.isArray(userData.attendedEvents) ? userData.attendedEvents : [];
    let queue = null;

    if (!queueSnapshot.empty) {
        const queueDoc = queueSnapshot.docs[0];
        try {
            queue = await getEventQueueStatus(db, queueDoc.id);
        } catch {
            queue = { id: queueDoc.id, ...queueDoc.data() };
        }
    }

    return {
        hasRsvped: attendedEvents.includes(eventId),
        queue,
        surgeActive: surgeStatus?.status === 'surge',
    };
}

const SCHEDULING_BLOCKING_STATUSES = new Set(['blocked', 'booked', 'approved', 'pending', 'requested', 'countered', 'changes_requested']);

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    return aStart < bEnd && bStart < aEnd;
}

function hasSchedulingConflict(slotDocs: any[], proposed: { startTime?: string | null; endTime?: string | null }, ignoreId?: string) {
    return slotDocs.some((doc: any) => {
        if (ignoreId && doc.id === ignoreId) return false;

        const slot = doc.data ? (doc.data() as Record<string, any>) : (doc as Record<string, any>);
        const status = String(slot.status || '').toLowerCase();
        if (!SCHEDULING_BLOCKING_STATUSES.has(status)) return false;

        const startTime = slot.startTime || slot.requestedStartTime || null;
        const endTime = slot.endTime || slot.requestedEndTime || null;

        if (!startTime || !endTime || !proposed.startTime || !proposed.endTime) {
            return true;
        }

        return rangesOverlap(startTime, endTime, proposed.startTime, proposed.endTime);
    });
}

async function enrichPartnerSnapshots(db: any, event: Record<string, any>) {
    const enriched = { ...event };

    const [hostSnap, venueSnap] = await Promise.all([
        event.hostId ? db.collection('hosts').doc(String(event.hostId)).get().catch(() => null) : Promise.resolve(null),
        event.venueId ? db.collection('venues').doc(String(event.venueId)).get().catch(() => null) : Promise.resolve(null),
    ]);

    if (hostSnap?.exists) {
        const data = hostSnap.data() as Record<string, any>;
        enriched.hostData = {
            id: hostSnap.id,
            handle: data.handle || event.host || '',
            name: data.name || data.displayName || '',
            avatar: data.avatar || data.photoURL || '',
            slug: data.slug || hostSnap.id,
            type: 'host',
        };
    }

    if (venueSnap?.exists) {
        const data = venueSnap.data() as Record<string, any>;
        enriched.venueData = {
            id: venueSnap.id,
            name: data.name || event.venue || event.venueName || '',
            slug: data.slug || venueSnap.id,
            photoURL: data.photoURL || data.image || '',
            image: data.image || data.photoURL || '',
            area: data.area || '',
            type: 'venue',
        };
    }

    return enriched;
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

    fastify.get('/events/:id/viewer-state', {
        preHandler: [fastify.validate({ params: EventParamId })]
    }, async (request: any, reply) => {
        try {
            const eventDoc = await fastify.db.collection('events').doc(request.params.id).get();
            if (!eventDoc.exists) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Event not found',
                    requestId: request.id,
                }));
            }

            const viewerState = await getEventViewerState(fastify.db, request.params.id, request.user?.uid || null);
            return buildSuccessResponse(viewerState);
        } catch (error: any) {
            request.log.error({ error }, 'Failed to load event viewer state');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: error.message || 'Unable to load event viewer state',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/events/:id/queue', {
        preHandler: [fastify.validate({ params: EventParamId, querystring: EventQueueQuery })]
    }, async (request: any, reply) => {
        try {
            const eventDoc = await fastify.db.collection('events').doc(request.params.id).get();
            if (!eventDoc.exists) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Event not found',
                    requestId: request.id,
                }));
            }

            const { queueId } = request.query;
            if (!queueId) {
                const status = await getEventSurgeStatus(fastify.db, request.params.id);
                return { surgeActive: status?.status === 'surge' };
            }

            const queueStatus = await getEventQueueStatus(fastify.db, queueId);
            if (queueStatus?.eventId !== request.params.id) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Queue entry not found for this event',
                    requestId: request.id,
                }));
            }

            return queueStatus;
        } catch (error: any) {
            request.log.error({ error }, 'Failed to load event queue status');
            const statusCode = error.message === 'Queue entry not found' ? 404 : 500;
            return reply.status(statusCode).send(buildErrorResponse({
                code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
                message: error.message || 'Unable to load queue status',
                requestId: request.id,
            }));
        }
    });

    fastify.post('/events/:id/queue', {
        preHandler: [fastify.validate({ params: EventParamId, body: EventQueueBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
        }));

        try {
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
            await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, { type: 'event', id: event.id });

            await fastify.invalidatePublicDiscovery('all');
            await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch((err: any) => {
                fastify.log.error({ eventId: event.id, error: err?.message || String(err) }, '[syncEventReadModels] Failed to sync event card index after create');
            });
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
        preHandler: [fastify.validate({ params: EventParamId, body: PartnerEventUpdateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        // workspaceId from x-workspace-id header or auth context activeMembership.
        // For solo owners (no partner_memberships doc), both may be null — derive from the event itself.
        let workspaceId: string | null = request.workspaceId || null;
        let existingEventSnap: any = null;
        if (!workspaceId) {
            const snap = await fastify.db.collection('events').doc(id).get().catch(() => null);
            if (snap?.exists) {
                existingEventSnap = snap.data() as any;
                const candidate: string = existingEventSnap.workspaceId || existingEventSnap.creatorId || existingEventSnap.hostId || '';
                if (candidate) {
                    const ok = candidate === userId ||
                        await fastify.verifyPartnerAccess(request, candidate).catch(() => false);
                    if (ok) workspaceId = candidate;
                }
            }
        }
        if (!workspaceId) return reply.status(400).send(buildErrorResponse({ code: 'MISSING_SCOPE', message: 'Missing workspace scope', requestId: request.id }));

        // Unwrap wizard auto-save envelope { actor, updates } → use updates as the patch body
        const rawBody: any = request.body;
        const patchFields: any = rawBody?.updates && typeof rawBody.updates === 'object' ? rawBody.updates : rawBody;

        // Self-heal: venue-creator events saved before venueId fallback fix had venueId=""
        if (existingEventSnap &&
            !existingEventSnap.venueId &&
            (existingEventSnap.creatorRole === 'venue' || existingEventSnap.creatorRole === 'club') &&
            existingEventSnap.creatorId) {
            patchFields.venueId = patchFields.venueId || existingEventSnap.creatorId;
        }

        try {
            const event = await fastify.eventService.updateEvent(id, patchFields, userId, workspaceId);
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
            await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, { type: 'event', id: event.id });

            await fastify.invalidatePublicDiscovery('all');
            await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch((err: any) => {
                fastify.log.error({ eventId: event.id, error: err?.message || String(err) }, '[syncEventReadModels] Failed to sync event card index after update');
            });
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
     * POST /api/v1/events/:id/repair
     * Re-saves an event to fix data issues (e.g. missing venueId) and re-syncs discovery index.
     */
    fastify.post('/events/:id/repair', {
        preHandler: [fastify.requireAuth, fastify.validate({ params: EventParamId })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const snap = await fastify.db.collection('events').doc(id).get().catch(() => null);
        if (!snap?.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));

        const d = snap.data() as any;
        const candidate: string = d.workspaceId || d.creatorId || d.hostId || '';
        if (!candidate) return reply.status(400).send(buildErrorResponse({ code: 'MISSING_SCOPE', message: 'Cannot determine event owner', requestId: request.id }));

        const ok = candidate === userId || await fastify.verifyPartnerAccess(request, candidate).catch(() => false);
        if (!ok) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Access denied', requestId: request.id }));

        const repairs: Record<string, any> = {};
        if (!d.venueId && (d.creatorRole === 'venue' || d.creatorRole === 'club')) {
            // Resolve the actual venue Firestore doc ID via partner context (uid may differ from venueDocId)
            const partnerCtx = await resolvePartnerContext(fastify.db, request).catch(() => null);
            const correctVenueId = partnerCtx?.type === 'venue' ? partnerCtx.partnerId : (d.creatorId || null);
            if (correctVenueId) repairs.venueId = correctVenueId;
        }

        if (Object.keys(repairs).length > 0) {
            await fastify.db.collection('events').doc(id).update({ ...repairs, updatedAt: new Date().toISOString() });
        }
        await fastify.publicDiscoveryService.syncEventReadModels(id).catch(() => undefined);
        await fastify.invalidatePublicDiscovery('all').catch(() => undefined);

        return reply.send({ success: true, repaired: repairs });
    });

    /**
     * DELETE /api/v1/events/:id
     */
    /**
     * POST /api/v1/partner/events/create
     * Partner-specific event creation with pre-flight checks:
     *   - slot availability on the venue calendar
     *   - active host–venue partnership enforcement
     *   - lifecycle enforcement by creator role
     *   - slot request creation after event is saved
     *
     * Does NOT require x-workspace-id — derives actor from auth token.
     */
    fastify.post('/partner/events/create', {
        preHandler: [fastify.validate({ body: PartnerEventCreateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const body: Record<string, any> = { ...request.body };

        let hostId: string = body.creatorId || body.hostId || userId;
        const isDraft: boolean = body.lifecycle === 'draft';
        if (body.creatorRole === 'host') {
            body.creatorId = hostId;
            body.hostId = hostId;
        }

        // Verify the authenticated user has access to the claimed partner identity.
        // Skip when creatorId === userId (solo user whose Firebase UID is the partner doc ID).
        if (hostId !== userId) {
            const hasAccess = await fastify.verifyPartnerAccess(request, hostId).catch(() => false);
            if (!hasAccess) {
                return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'You do not have access to this partner account', requestId: request.id }));
            }
        }

        // --- Normalize image fields ---
        const normalizedPoster = body.coverImage || body.coverPhoto || body.poster || body.image || body.images?.[0] || '';
        if (normalizedPoster) {
            body.coverImage = body.coverImage || normalizedPoster;
            body.coverPhoto = body.coverPhoto || normalizedPoster;
            body.poster     = body.poster     || normalizedPoster;
            body.image      = body.image      || normalizedPoster;
        }

        // For venue/club creators, ensure venueId is the actual venue Firestore doc ID.
        // When activeMembership is null on the client, the wizard sends creatorId=uid which
        // can differ from the venue's Firestore document ID. resolvePartnerContext gives the truth.
        if ((body.creatorRole === 'venue' || body.creatorRole === 'club') && !body.venueId) {
            const partnerCtx = await resolvePartnerContext(fastify.db, request).catch(() => null);
            if (partnerCtx?.type === 'venue' && partnerCtx.partnerId) {
                body.venueId = partnerCtx.partnerId;
                body.creatorId = partnerCtx.partnerId;
                hostId = partnerCtx.partnerId; // update so buildEvent uses the venue doc ID, not uid
            }
        }

        // --- Resolve host–venue selection ---
        if (body.creatorRole === 'host' && body.venueId) {
            const activeSnap = await fastify.db.collection('partnerships')
                .where('hostId', '==', hostId)
                .where('status', '==', 'active')
                .get();
            const partnerships = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const exact = partnerships.find((p: any) => p.venueId === body.venueId);
            if (exact) {
                body.venueId   = exact.venueId;
                body.venueName = exact.venueName || body.venueName || body.venue || '';
                body.venue     = body.venueName;
            }
        }

        // --- Scheduling availability checks (single source: availability_slots) ---
        if (!isDraft && body.venueId && body.startDate) {
            const slotsSnap = await fastify.db.collection('availability_slots')
                .where('venueId', '==', body.venueId)
                .where('date', '==', body.startDate)
                .limit(50)
                .get();

            if (hasSchedulingConflict(slotsSnap.docs, { startTime: body.startTime, endTime: body.endTime })) {
                return reply.status(409).send(buildErrorResponse({ code: 'CONFLICT', message: 'The selected venue time slot is unavailable', requestId: request.id }));
            }
        }

        // --- Active partnership enforcement ---
        if (body.creatorRole === 'host' && body.venueId && !isDraft) {
            const partnershipSnap = await fastify.db.collection('partnerships')
                .where('hostId', '==', hostId)
                .where('venueId', '==', body.venueId)
                .where('status', '==', 'active')
                .limit(1)
                .get();
            if (partnershipSnap.empty) {
                return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No active partnership with this venue. Access denied.', requestId: request.id }));
            }
        }

        // --- Lifecycle enforcement ---
        if (!isDraft) {
            if (body.creatorRole === 'host') {
                body.lifecycle = 'submitted';
                // visibility stays as-is (will be set to 'public' when venue approves)
            } else if (body.creatorRole === 'venue' || body.creatorRole === 'club') {
                body.lifecycle = 'scheduled';
                body.visibility = 'public'; // Venue events self-approve — stamp public immediately
            }
        }

        try {
            const event = buildEvent({
                ...body,
                creatorId: hostId,
                workspaceId: hostId,
            }) as Record<string, any>;
            event.workspaceId = hostId;
            const eventRecord = await enrichPartnerSnapshots(fastify.db, event);

            const slotRecord = body.creatorRole === 'host' && body.venueId && !isDraft
                ? {
                    eventId: event.id,
                    hostId,
                    creatorId: hostId,
                    hostName: body.host || '',
                    venueId: body.venueId,
                    venueName: body.venueName || body.venue || '',
                    date: body.startDate,
                    startTime: body.startTime || null,
                    endTime: body.endTime || null,
                    requestedDate: body.startDate,
                    requestedStartTime: body.startTime || null,
                    requestedEndTime: body.endTime || null,
                    requestedBy: hostId,
                    notes: `Event creation request: ${body.title}`,
                    source: 'host_event_request',
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: userId,
                }
                : null;

            await fastify.db.runTransaction(async (transaction: any) => {
                if (slotRecord) {
                    const conflictingSlots = await transaction.get(
                        fastify.db.collection('availability_slots')
                            .where('venueId', '==', body.venueId)
                            .where('date', '==', body.startDate)
                            .limit(50)
                    );

                    if (hasSchedulingConflict(conflictingSlots.docs, { startTime: body.startTime, endTime: body.endTime }, event.id)) {
                        const conflictError: any = new Error('The selected venue time slot is unavailable');
                        conflictError.statusCode = 409;
                        conflictError.code = 'CONFLICT';
                        throw conflictError;
                    }

                    transaction.create(fastify.db.collection('availability_slots').doc(event.id), slotRecord);
                }

                transaction.create(fastify.db.collection('events').doc(event.id), eventRecord);
            });

            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            await fastify.publicDiscoveryService.syncEventReadModels(event.id);
            await fastify.invalidatePublicDiscovery('all');

            return reply.status(201).send({ success: true, event: { id: event.id } });
        } catch (error: any) {
            fastify.log.error(`[partner/events/create] ${error.message}`);
            const statusCode = Number(error?.statusCode) || 500;
            return reply.status(statusCode).send(buildErrorResponse({
                code: error?.code || (statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR'),
                message: error?.message || 'Failed to create event',
                requestId: request.id,
            }));
        }
    });

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
            await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, { type: 'event', id: id });
            await fastify.invalidatePublicDiscovery('all');
            await fastify.publicDiscoveryService.syncEventReadModels(id).catch(() => undefined);
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

    /**
     * POST /api/v1/events/wizard/preview-breakdown
     * Computes revenue projection for event creation wizard.
     * Accepts the raw wizard formData and returns commission/discount/net metrics.
     * Frontend must call this and render the result — never compute projections locally.
     */
    const WizardPreviewSchema = z.object({
        isRSVP: z.boolean().optional(),
        promotersEnabled: z.boolean().optional(),
        buyerDiscountsEnabled: z.boolean().optional(),
        commission: z.number().optional(),
        commissionType: z.string().optional(),
        discount: z.number().optional(),
        discountType: z.string().optional(),
        tickets: z.array(z.object({
            name: z.string().optional(),
            price: z.number(),
            quantity: z.number(),
            overrideCommission: z.boolean().optional(),
            promoterCommission: z.number().optional(),
            promoterCommissionType: z.string().optional(),
            overrideDiscount: z.boolean().optional(),
            promoterDiscount: z.number().optional(),
            promoterDiscountType: z.string().optional(),
        })).optional().default([]),
        tables: z.array(z.object({
            name: z.string().optional(),
            price: z.number(),
            quantity: z.number(),
            capacity: z.number().optional(),
            buyerDiscountEnabled: z.boolean().optional(),
            promoterDiscount: z.number().optional(),
            promoterDiscountType: z.string().optional(),
        })).optional().default([]),
    });

    fastify.post('/events/wizard/preview-breakdown', {
        preHandler: [fastify.validate({ body: WizardPreviewSchema })]
    }, async (request: any, reply) => {
        const fd = request.body;
        const isRSVP = fd.isRSVP === true;
        const promotersEnabled = fd.promotersEnabled === true;
        const buyerDiscountsEnabled = fd.buyerDiscountsEnabled === true;

        const computeTier = (tier: any, type: 'ticket' | 'table') => {
            const price = Number(tier.price) || 0;
            const quantity = Number(tier.quantity) || 0;
            const value = price * quantity;
            const isFree = price === 0;

            let commTotal = 0, commRate = 0, commType = 'percent';
            if (promotersEnabled && !isFree) {
                commRate = tier.overrideCommission ? (Number(tier.promoterCommission) || 0) : (Number(fd.commission) || 15);
                commType = tier.overrideCommission ? (tier.promoterCommissionType || 'percent') : (fd.commissionType || 'percent');
                commTotal = commType === 'percent' ? (value * commRate / 100) : (commRate * quantity);
            }

            let discTotal = 0, discRate = 0, discType = 'percent';
            if (promotersEnabled && buyerDiscountsEnabled && !isFree && !isRSVP) {
                if (type === 'ticket') {
                    discRate = tier.overrideDiscount ? (Number(tier.promoterDiscount) || 0) : (Number(fd.discount) || 10);
                    discType = tier.overrideDiscount ? (tier.promoterDiscountType || 'percent') : (fd.discountType || 'percent');
                } else if (tier.buyerDiscountEnabled) {
                    discRate = Number(tier.promoterDiscount) || 0;
                    discType = tier.promoterDiscountType || 'percent';
                }
                discTotal = discType === 'percent' ? (value * discRate / 100) : (discRate * quantity);
            }

            return { name: tier.name, price, quantity, value, commRate, commType, commTotal, discRate, discType, discTotal, net: value - discTotal - commTotal };
        };

        const ticketMetrics = (fd.tickets || []).map((t: any) => computeTier(t, 'ticket'));
        const tableMetrics = (fd.tables || []).map((t: any) => computeTier(t, 'table'));

        const sum = (items: any[]) => items.reduce((a, m) => ({
            quantity: a.quantity + m.quantity, value: a.value + m.value,
            discTotal: a.discTotal + m.discTotal, commTotal: a.commTotal + m.commTotal, net: a.net + m.net,
        }), { quantity: 0, value: 0, discTotal: 0, commTotal: 0, net: 0 });

        const ticketSubtotal = sum(ticketMetrics);
        const tableSubtotal = sum(tableMetrics);
        const grandTotal = sum([ticketSubtotal, tableSubtotal]);
        const revenueBase = grandTotal.net + grandTotal.commTotal;

        return {
            ticketMetrics,
            tableMetrics,
            ticketSubtotal,
            tableSubtotal,
            grandTotal,
            venueSharePct: revenueBase > 0 ? (grandTotal.net / revenueBase) * 100 : 100,
            promoterSharePct: revenueBase > 0 ? (grandTotal.commTotal / revenueBase) * 100 : 0,
        };
    });

    /**
     * GET /api/v1/debug/venue-events
     * Temporary debug endpoint — shows partner context + raw query results.
     * Remove after event visibility is confirmed working.
     */
    fastify.get('/debug/venue-events', async (request: any, reply) => {
        // Accept uid from query param for easy browser testing when no auth header
        const uid: string = request.user?.uid || (request.query as any)?.uid || '';
        if (!uid) return reply.status(400).send({ error: 'Pass ?uid=YOUR_FIREBASE_UID or an Authorization header' });

        const ctx = await resolvePartnerContext(fastify.db, request).catch(() => null);

        const [byVenueId, byCreatorIdDoc, byCreatorIdUid, eventCardIndex] = await Promise.all([
            ctx ? fastify.db.collection('events').where('venueId', '==', ctx.partnerId).limit(10).get().catch(() => null) : null,
            ctx ? fastify.db.collection('events').where('creatorId', '==', ctx.partnerId).limit(10).get().catch(() => null) : null,
            fastify.db.collection('events').where('creatorId', '==', uid).limit(10).get().catch(() => null),
            fastify.db.collection('event_card_index').where('visibility', '==', 'public').limit(10).get().catch(() => null),
        ]);

        return reply.send({
            uid,
            partnerContext: ctx ? { partnerId: ctx.partnerId, uid: ctx.uid, type: ctx.type } : null,
            queries: {
                byVenueId: (byVenueId as any)?.docs?.map((d: any) => ({ id: d.id, venueId: d.data().venueId, creatorId: d.data().creatorId, lifecycle: d.data().lifecycle, workspaceId: d.data().workspaceId, title: d.data().title })) ?? [],
                byCreatorIdDocId: (byCreatorIdDoc as any)?.docs?.map((d: any) => ({ id: d.id, venueId: d.data().venueId, creatorId: d.data().creatorId, lifecycle: d.data().lifecycle, title: d.data().title })) ?? [],
                byCreatorIdUid: (byCreatorIdUid as any)?.docs?.map((d: any) => ({ id: d.id, venueId: d.data().venueId, creatorId: d.data().creatorId, lifecycle: d.data().lifecycle, title: d.data().title })) ?? [],
            },
            eventCardIndex: (eventCardIndex as any)?.docs?.map((d: any) => ({ id: d.id, visibility: d.data().visibility, startAt: d.data().startAt, title: d.data().title })) ?? [],
        });
    });
}

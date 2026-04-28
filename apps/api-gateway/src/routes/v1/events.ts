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
            await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch(() => undefined);
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
            await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, { type: 'event', id: event.id });

            await fastify.invalidatePublicDiscovery('all');
            await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch(() => undefined);
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
        preHandler: [fastify.validate({ body: EventCreateBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        const body: Record<string, any> = { ...request.body };

        const hostId: string = body.creatorId || body.hostId || userId;
        const isDraft: boolean = body.lifecycle === 'draft';

        // --- Normalize image fields ---
        const normalizedPoster = body.coverImage || body.coverPhoto || body.poster || body.image || body.images?.[0] || '';
        if (normalizedPoster) {
            body.coverImage = body.coverImage || normalizedPoster;
            body.coverPhoto = body.coverPhoto || normalizedPoster;
            body.poster     = body.poster     || normalizedPoster;
            body.image      = body.image      || normalizedPoster;
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

        // --- Calendar and slot availability checks ---
        if (!isDraft && body.venueId && body.startDate) {
            const calSnap = await fastify.db.collection('venue_calendar')
                .where('venueId', '==', body.venueId)
                .where('date', '==', body.startDate)
                .limit(1)
                .get();

            const calDay = calSnap.empty ? null : calSnap.docs[0].data();
            if (calDay?.status === 'blocked') {
                return reply.status(409).send(buildErrorResponse({ code: 'CONFLICT', message: 'This date is blocked on the venue calendar', requestId: request.id }));
            }

            if (body.startTime && body.endTime && calDay) {
                const slots: any[] = calDay.slots || [];
                function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
                    return aStart < bEnd && bStart < aEnd;
                }
                const slotConflict = slots.some((s: any) =>
                    s && s.status !== 'available' && rangesOverlap(s.startTime, s.endTime, body.startTime, body.endTime)
                );
                if (slotConflict) {
                    return reply.status(409).send(buildErrorResponse({ code: 'CONFLICT', message: 'The selected venue time slot is unavailable', requestId: request.id }));
                }
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
            } else if (body.creatorRole === 'venue' || body.creatorRole === 'club') {
                body.lifecycle = 'scheduled';
            }
        }

        try {
            const event = await fastify.eventService.createEvent(body, hostId, hostId);

            await fastify.cache.invalidateNamespace('events:list');
            await fastify.cache.invalidateNamespace('events:nearby');
            await fastify.publicDiscoveryService.syncEventReadModels(event.id);
            await fastify.invalidatePublicDiscovery('all');

            // Create slot request for non-draft host events at a venue
            if (body.creatorRole === 'host' && body.venueId && !isDraft) {
                try {
                    const slotRequestId = `${event.id}_${Date.now()}`;
                    await fastify.db.collection('slot_requests').doc(slotRequestId).set({
                        eventId:            event.id,
                        hostId,
                        hostName:           body.host || '',
                        venueId:            body.venueId,
                        venueName:          body.venueName || body.venue || '',
                        requestedDate:      body.startDate,
                        requestedStartTime: body.startTime,
                        requestedEndTime:   body.endTime,
                        notes:              `Event creation request: ${body.title}`,
                        status:             'pending',
                        createdAt:          new Date().toISOString(),
                        createdBy:          userId,
                    });
                } catch (slotErr: any) {
                    fastify.log.warn(`[partner/events/create] slot request failed: ${slotErr.message}`);
                }
            }

            return reply.status(201).send({ success: true, event: { id: event.id } });
        } catch (error: any) {
            fastify.log.error(`[partner/events/create] ${error.message}`);
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to create event', requestId: request.id }));
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
        preHandler: [fastify.requireAuth, fastify.validate({ body: WizardPreviewSchema })]
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
}

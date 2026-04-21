import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import validatePlugin from '../../plugins/validate';
import eventRoutes from './events';
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

vi.mock('@c1rcle/core/guest-event-conversion', () => ({
    getEventQueueStatus: vi.fn(async () => ({ id: 'queue_1', status: 'waiting', lanePosition: 2 })),
    getEventSurgeStatus: vi.fn(async () => ({ status: 'surge' })),
    joinEventQueue: vi.fn(async () => ({ id: 'queue_1', eventId: 'event_1', userId: 'user_1', status: 'waiting' })),
    joinEventWaitlist: vi.fn(async () => ({ id: 'wl_1', eventId: 'event_1', tierId: 'tier_1', ticketId: 'tier_1', email: 'guest@example.com', status: 'waiting', createdAt: 'now' })),
    toggleEventRsvp: vi.fn(async () => ({ success: true })),
    trackGuestEventInteraction: vi.fn(async () => ({ ok: true })),
    trackGuestEventView: vi.fn(async () => ({ ok: true })),
    verifyEventWaitlistAccess: vi.fn(async () => ({ id: 'wl_1', eventId: 'event_1', email: 'guest@example.com', status: 'notified' })),
}));

async function buildServer({ authenticated = false } = {}) {
    const server = Fastify({ logger: false });
    server.decorate('db', {} as any);
    server.decorate('cache', {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        invalidateNamespace: vi.fn(async () => undefined),
    } as any);
    server.decorate('eventService', {
        listEvents: vi.fn(),
        listNearby: vi.fn(),
        getEventByIdOrSlug: vi.fn(),
    } as any);
    server.decorate('publicDiscoveryService', { syncEventReadModels: vi.fn(async () => undefined) } as any);
    server.decorate('invalidatePublicDiscovery', vi.fn(async () => undefined) as any);
    server.decorateRequest('user', null);
    server.addHook('onRequest', async (request: any) => {
        request.user = authenticated ? { uid: 'user_1', email: 'guest@example.com' } : null;
    });
    await server.register(validatePlugin);
    await server.register(eventRoutes, { prefix: '/api/v1' });
    return server;
}

describe('event routes GP-3 conversion contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /events/:id/view and /track are non-blocking analytics endpoints', async () => {
        const server = await buildServer();

        const view = await server.inject({ method: 'POST', url: '/api/v1/events/event_1/view', headers: { 'user-agent': 'test-agent' } });
        const track = await server.inject({ method: 'POST', url: '/api/v1/events/event_1/track', payload: { type: 'impression', ref: 'PROMO1' } });

        expect(view.statusCode).toBe(200);
        expect(view.json()).toEqual({ ok: true });
        expect(track.statusCode).toBe(200);
        expect(track.json()).toEqual({ ok: true });
        expect(trackGuestEventView).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: 'event_1' }));
        expect(trackGuestEventInteraction).toHaveBeenCalledWith(expect.anything(), { eventId: 'event_1', type: 'impression', ref: 'PROMO1' });

        await server.close();
    });

    it('POST /events/:id/rsvp requires auth and delegates authenticated toggles', async () => {
        const unauthenticated = await buildServer();
        const rejected = await unauthenticated.inject({ method: 'POST', url: '/api/v1/events/event_1/rsvp', payload: { shouldInclude: true } });
        expect(rejected.statusCode).toBe(401);
        await unauthenticated.close();

        const authenticated = await buildServer({ authenticated: true });
        const accepted = await authenticated.inject({ method: 'POST', url: '/api/v1/events/event_1/rsvp', payload: { shouldInclude: true } });
        expect(accepted.statusCode).toBe(200);
        expect(accepted.json()).toEqual({ success: true });
        expect(toggleEventRsvp).toHaveBeenCalledWith(expect.anything(), { eventId: 'event_1', userId: 'user_1', shouldInclude: true });

        await authenticated.close();
    });

    it('GET/POST /events/:id/queue preserve surge and waiting room shapes', async () => {
        const server = await buildServer({ authenticated: true });

        const surge = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/queue' });
        const joined = await server.inject({ method: 'POST', url: '/api/v1/events/event_1/queue', payload: { userId: 'client_user' } });
        const status = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/queue?queueId=queue_1' });

        expect(surge.statusCode).toBe(200);
        expect(surge.json()).toEqual({ surgeActive: true });
        expect(joined.json()).toMatchObject({ id: 'queue_1', status: 'waiting' });
        expect(status.json()).toMatchObject({ id: 'queue_1', lanePosition: 2 });
        expect(getEventSurgeStatus).toHaveBeenCalledWith(expect.anything(), 'event_1');
        expect(joinEventQueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: 'event_1', userId: 'user_1' }));
        expect(getEventQueueStatus).toHaveBeenCalledWith(expect.anything(), 'queue_1');

        await server.close();
    });

    it('GET/POST /events/:id/waitlist preserve legacy guest waitlist responses', async () => {
        const server = await buildServer({ authenticated: true });

        const joined = await server.inject({
            method: 'POST',
            url: '/api/v1/events/event_1/waitlist',
            payload: { ticketId: 'tier_1', email: 'body@example.com' },
        });
        const checked = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/waitlist?email=guest%40example.com' });

        expect(joined.statusCode).toBe(200);
        expect(joined.json()).toMatchObject({ success: true, message: 'Added to waitlist', entry: { id: 'wl_1' } });
        expect(checked.statusCode).toBe(200);
        expect(checked.json()).toMatchObject({ hasAccess: true, accessDetails: { id: 'wl_1' } });
        expect(joinEventWaitlist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            eventId: 'event_1',
            ticketId: 'tier_1',
            userId: 'user_1',
            email: 'guest@example.com',
        }));
        expect(verifyEventWaitlistAccess).toHaveBeenCalledWith(expect.anything(), { eventId: 'event_1', email: 'guest@example.com' });

        await server.close();
    });
});

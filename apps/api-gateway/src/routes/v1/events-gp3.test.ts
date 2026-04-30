import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import validatePlugin from '../../plugins/validate';
import eventRoutes from './events';
import {
    getEventQueueStatus,
    getEventSurgeStatus,
    joinEventQueue,
    toggleEventRsvp,
    trackGuestEventInteraction,
    trackGuestEventView,
} from '@c1rcle/core/guest-event-conversion';

vi.mock('@c1rcle/core/guest-event-conversion', () => ({
    getEventQueueStatus: vi.fn(async () => ({ id: 'queue_1', eventId: 'event_1', status: 'waiting', lanePosition: 2 })),
    getEventSurgeStatus: vi.fn(async () => ({ status: 'surge' })),
    joinEventQueue: vi.fn(async () => ({ id: 'queue_1', eventId: 'event_1', userId: 'user_1', status: 'waiting' })),
    toggleEventRsvp: vi.fn(async () => ({ success: true })),
    trackGuestEventInteraction: vi.fn(async () => ({ ok: true })),
    trackGuestEventView: vi.fn(async () => ({ ok: true })),
}));

async function buildServer({ authenticated = false } = {}) {
    const server = Fastify({ logger: false });
    server.decorate('db', {
        collection(name: string) {
            if (name === 'events') {
                return {
                    doc() {
                        return {
                            async get() {
                                return { exists: true, data: () => ({ id: 'event_1' }) };
                            },
                        };
                    },
                };
            }

            if (name === 'users') {
                return {
                    doc() {
                        return {
                            async get() {
                                return {
                                    exists: true,
                                    data: () => ({ attendedEvents: ['event_1'] }),
                                };
                            },
                        };
                    },
                };
            }

            if (name === 'event_queues') {
                return {
                    where() {
                        return this;
                    },
                    limit() {
                        return this;
                    },
                    async get() {
                        return {
                            empty: false,
                            docs: [{
                                id: 'queue_1',
                                data: () => ({ eventId: 'event_1', userId: 'user_1', status: 'waiting' }),
                            }],
                        };
                    },
                };
            }

            return {};
        },
    } as any);
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
    server.decorate('requireAuth', async (request: any, reply: any) => {
        if (!request.user?.uid) {
            return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
        }
    });
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
        const track = await server.inject({ method: 'POST', url: '/api/v1/events/event_1/track', payload: { type: 'click', ref: 'PROMO1' } });

        expect(view.statusCode).toBe(200);
        expect(view.json()).toEqual({ ok: true });
        expect(track.statusCode).toBe(200);
        expect(track.json()).toEqual({ ok: true });
        expect(trackGuestEventView).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: 'event_1' }));
        expect(trackGuestEventInteraction).toHaveBeenCalledWith(expect.anything(), { eventId: 'event_1', type: 'click', ref: 'PROMO1' });

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

    it('GET/POST /events/:id/queue preserve surge and waiting room shapes while enforcing authenticated joins', async () => {
        const unauthenticated = await buildServer();
        const rejected = await unauthenticated.inject({ method: 'POST', url: '/api/v1/events/event_1/queue', payload: {} });
        expect(rejected.statusCode).toBe(401);
        await unauthenticated.close();

        const server = await buildServer({ authenticated: true });

        const surge = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/queue' });
        const joined = await server.inject({ method: 'POST', url: '/api/v1/events/event_1/queue', payload: {} });
        const status = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/queue?queueId=queue_1' });

        expect(surge.statusCode).toBe(200);
        expect(surge.json()).toEqual({ surgeActive: true });
        expect(joined.json()).toMatchObject({ id: 'queue_1', status: 'waiting' });
        expect(status.json()).toMatchObject({ id: 'queue_1', lanePosition: 2 });
        expect(getEventSurgeStatus).toHaveBeenCalledWith(expect.anything(), 'event_1');
        expect(joinEventQueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: 'event_1', userId: 'user_1' }));
        expect(joinEventQueue).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'client_user' }));
        expect(getEventQueueStatus).toHaveBeenCalledWith(expect.anything(), 'queue_1');

        await server.close();
    });

    it('GET /events/:id/viewer-state returns canonical RSVP and queue state for the viewer', async () => {
        const server = await buildServer({ authenticated: true });
        const response = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/viewer-state' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            data: {
                hasRsvped: true,
                queue: { id: 'queue_1', eventId: 'event_1', status: 'waiting', lanePosition: 2 },
                surgeActive: true,
            },
            hasRsvped: true,
            queue: { id: 'queue_1', eventId: 'event_1', status: 'waiting', lanePosition: 2 },
            surgeActive: true,
        });
        expect(getEventSurgeStatus).toHaveBeenCalledWith(expect.anything(), 'event_1');
        expect(getEventQueueStatus).toHaveBeenCalledWith(expect.anything(), 'queue_1');

        await server.close();
    });
});

import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import validatePlugin from '../../plugins/validate';
import eventRoutes from './events';
import {
  getEventQueueStatus,
  getEventSurgeStatus,
  getEventWaitlistStatus,
  getEventInterested,
  joinEventQueue,
  joinEventWaitlist,
  toggleEventRsvp,
  trackGuestEventInteraction,
  trackGuestEventView,
} from '@c1rcle/core/guest-event-conversion';
import { InventoryUnavailableError, listAvailableTicketTiers } from '@c1rcle/core/inventory-engine';

vi.mock('@c1rcle/core/guest-event-conversion', () => ({
  getEventQueueStatus: vi.fn(async () => ({
    id: 'queue_1',
    eventId: 'event_1',
    status: 'waiting',
    lanePosition: 2,
  })),
  getEventSurgeStatus: vi.fn(async () => ({ status: 'surge' })),
  getEventWaitlistStatus: vi.fn(async () => ({
    joined: true,
    position: 3,
    totalWaiting: 10,
    entry: { id: 'wl_1', eventId: 'event_1', email: 'guest@example.com' },
  })),
  getEventInterested: vi.fn(async () => ({
    count: 1,
    users: [
      {
        userId: 'user_2',
        displayName: 'Interested Guest',
        photoURL: 'https://example.com/avatar.jpg',
        likedAt: '2026-06-23T00:00:00.000Z',
      },
    ],
  })),
  joinEventQueue: vi.fn(async () => ({
    id: 'queue_1',
    eventId: 'event_1',
    userId: 'user_1',
    status: 'waiting',
  })),
  joinEventWaitlist: vi.fn(async () => ({
    id: 'wl_1',
    eventId: 'event_1',
    userId: 'user_1',
    email: 'guest@example.com',
    status: 'waiting',
  })),
  toggleEventRsvp: vi.fn(async () => ({ success: true })),
  trackGuestEventInteraction: vi.fn(async () => ({ ok: true })),
  trackGuestEventView: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@c1rcle/core/inventory-engine', () => {
  class InventoryReadError extends Error {
    constructor(message = 'Inventory read failed') {
      super(message);
      this.name = 'InventoryReadError';
    }
  }

  class InventoryUnavailableError extends Error {
    constructor(message = 'Inventory unavailable') {
      super(message);
      this.name = 'InventoryUnavailableError';
    }
  }

  return {
    InventoryReadError,
    InventoryUnavailableError,
    listAvailableTicketTiers: vi.fn(async (db, eventId) => ({
      eventId,
      currency: 'INR',
      tiers: [
        {
          id: 'ga',
          tierId: 'ga',
          name: 'General Admission',
          price: 1500,
          formattedPrice: 'INR 1,500',
          remaining: 42,
          availableQuantity: 42,
          isAvailable: true,
          isSoldOut: false,
          saleStatus: 'active',
        },
        {
          id: 'vip',
          tierId: 'vip',
          name: 'VIP',
          price: 5000,
          formattedPrice: 'INR 5,000',
          remaining: 8,
          availableQuantity: 8,
          isAvailable: true,
          isSoldOut: false,
          saleStatus: 'active',
        },
      ],
      availableCount: 2,
      hasAvailableTickets: true,
      soldOut: false,
      generatedAt: '2026-06-17T00:00:00.000Z',
    })),
  };
});

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
              docs: [
                {
                  id: 'queue_1',
                  data: () => ({ eventId: 'event_1', userId: 'user_1', status: 'waiting' }),
                },
              ],
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
    createEvent: vi.fn(async (payload: any) => {
      if (
        (payload.status === 'published' || payload.lifecycle === 'scheduled') &&
        !payload.startDate
      ) {
        const error: any = new Error('startDate is required for public or submitted events');
        error.code = 'BAD_REQUEST';
        throw error;
      }
      return {
        id: 'event_created',
        title: payload.title,
        status: payload.status || 'draft',
        lifecycle: payload.lifecycle || (payload.status === 'published' ? 'scheduled' : 'draft'),
        slug: 'event-created',
      };
    }),
  } as any);
  server.decorate('publicDiscoveryService', {
    listEvents: vi.fn(async (query) => ({
      items: [{ id: 'event_1' }],
      nextCursor: null,
      hasMore: false,
      appliedFilters: query,
    })),
    listFeaturedEvents: vi.fn(async (query) => ({
      items: [{ id: 'event_featured' }],
      nextCursor: null,
      hasMore: false,
      appliedFilters: query,
    })),
    getEventDetail: vi.fn(async (idOrSlug) => ({
      event: {
        id: idOrSlug,
        title: 'Neon District',
        description: 'Full event description',
        lineup: ['DJ Mira'],
        location: 'Lower Parel, Mumbai',
        rules: ['21+ entry'],
      },
      interestedData: { count: 2, users: [] },
    })),
    syncEventReadModels: vi.fn(async () => undefined),
  } as any);
  server.decorate('invalidatePublicDiscovery', vi.fn(async () => undefined) as any);
  server.decorate('sendInngestEvent', vi.fn(async () => undefined) as any);
  server.decorate('InngestEvents', { PUBLIC_DISCOVERY_SYNC: 'public/discovery.sync' } as any);
  server.decorate('broadcast', vi.fn(() => undefined) as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user?.uid) {
      return reply
        .status(401)
        .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }
  });
  server.decorateRequest('user', null);
  server.addHook('onRequest', async (request: any) => {
    request.user = authenticated ? { uid: 'user_1', email: 'guest@example.com' } : null;
    request.workspaceId = authenticated ? 'workspace_1' : null;
  });
  await server.register(validatePlugin);
  await server.register(eventRoutes, { prefix: '/api/v1' });
  return server;
}

describe('event routes GP-3 conversion contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /events serves the public Explore feed through public discovery filters', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events?limit=12&city=mumbai&category=club&date=tonight&sort=popular',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [{ id: 'event_1' }], hasMore: false });
    expect((server as any).publicDiscoveryService.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 12,
        cityKey: 'mumbai-in',
        category: 'club',
        eventType: 'club',
        datePreset: 'tonight',
        sort: 'heat',
      }),
    );
    expect((server as any).eventService.listEvents).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events rejects invalid Explore feed query params', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events?limit=999',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect((server as any).publicDiscoveryService.listEvents).not.toHaveBeenCalled();

    await server.close();
  });

  it('POST /events rejects published events without startDate', async () => {
    const server = await buildServer({ authenticated: true });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: {
        title: 'No Date Launch',
        status: 'published',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'startDate is required for public or submitted events',
      },
    });

    await server.close();
  });

  it('POST /events allows draft without startDate and passes finite coordinates', async () => {
    const server = await buildServer({ authenticated: true });

    const draft = await server.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: {
        title: 'Draft Event',
        status: 'draft',
      },
    });

    const scheduled = await server.inject({
      method: 'POST',
      url: '/api/v1/events',
      payload: {
        title: 'Equator Launch',
        status: 'published',
        startDate: '2099-01-01T20:00:00.000Z',
        coordinates: { latitude: 0, longitude: 0 },
      },
    });

    expect(draft.statusCode).toBe(200);
    expect(scheduled.statusCode).toBe(200);
    expect((server as any).eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Equator Launch',
        coordinates: { latitude: 0, longitude: 0 },
      }),
      'user_1',
      'workspace_1',
    );

    await server.close();
  });

  it('GET /events/featured serves hero carousel events through public discovery', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/featured?limit=6&city=mumbai&category=club&date=tonight&sort=trending',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ items: [{ id: 'event_featured' }], hasMore: false });
    expect((server as any).publicDiscoveryService.listFeaturedEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 6,
        cityKey: 'mumbai-in',
        category: 'club',
        eventType: 'club',
        datePreset: 'tonight',
        sort: 'heat',
      }),
    );
    expect((server as any).publicDiscoveryService.listEvents).not.toHaveBeenCalled();
    expect((server as any).eventService.listEvents).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events/featured caps hero carousel page size', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/featured?limit=24',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect((server as any).publicDiscoveryService.listFeaturedEvents).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events/:id serves full public event detail through public discovery', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      event: {
        id: 'event_1',
        title: 'Neon District',
        description: 'Full event description',
        lineup: ['DJ Mira'],
        location: 'Lower Parel, Mumbai',
        rules: ['21+ entry'],
      },
      interestedData: { count: 2, users: [] },
    });
    expect((server as any).publicDiscoveryService.getEventDetail).toHaveBeenCalledWith('event_1');
    expect((server as any).eventService.getEventByIdOrSlug).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events/:id returns 404 for missing or private events', async () => {
    const server = await buildServer();
    (server as any).publicDiscoveryService.getEventDetail.mockResolvedValueOnce(null);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/private_event',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect((server as any).eventService.getEventByIdOrSlug).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events/:id/tickets returns live public ticket tiers from core inventory', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/tickets',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        eventId: 'event_1',
        currency: 'INR',
        tiers: [
          { tierId: 'ga', name: 'General Admission', price: 1500, remaining: 42 },
          { tierId: 'vip', name: 'VIP', price: 5000, remaining: 8 },
        ],
        hasAvailableTickets: true,
      },
    });
    expect(listAvailableTicketTiers).toHaveBeenCalledWith((server as any).db, 'event_1');
    expect((server as any).publicDiscoveryService.getEventDetail).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /events/:id/tickets returns 404 when the core inventory read hides the event', async () => {
    const server = await buildServer();
    vi.mocked(listAvailableTicketTiers).mockResolvedValueOnce(null);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/private_event/tickets',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');

    await server.close();
  });

  it('GET /events/:id/tickets returns 503 when live inventory is unavailable', async () => {
    const server = await buildServer();
    vi.mocked(listAvailableTicketTiers).mockRejectedValueOnce(
      new InventoryUnavailableError('Redis unavailable'),
    );

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/tickets',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('INVENTORY_UNAVAILABLE');

    await server.close();
  });

  it('POST /events/:id/view and /track are non-blocking analytics endpoints', async () => {
    const server = await buildServer();

    const view = await server.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/view',
      headers: { 'user-agent': 'test-agent' },
    });
    const track = await server.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/track',
      payload: { type: 'click', ref: 'PROMO1' },
    });

    expect(view.statusCode).toBe(200);
    expect(view.json()).toEqual({ ok: true });
    expect(track.statusCode).toBe(200);
    expect(track.json()).toEqual({ ok: true });
    expect(trackGuestEventView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'event_1' }),
    );
    expect(trackGuestEventInteraction).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      type: 'click',
      ref: 'PROMO1',
    });

    await server.close();
  });

  it('POST /events/:id/rsvp requires auth and delegates authenticated toggles', async () => {
    const unauthenticated = await buildServer();
    const rejected = await unauthenticated.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/rsvp',
      payload: { shouldInclude: true },
    });
    expect(rejected.statusCode).toBe(401);
    await unauthenticated.close();

    const authenticated = await buildServer({ authenticated: true });
    const accepted = await authenticated.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/rsvp',
      payload: { shouldInclude: true },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ success: true });
    expect(toggleEventRsvp).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      userId: 'user_1',
      shouldInclude: true,
    });

    await authenticated.close();
  });

  it('GET /events/:id/interested returns hearted user profiles without using attendees', async () => {
    const unauthenticated = await buildServer();
    const rejected = await unauthenticated.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/interested?limit=24',
    });
    expect(rejected.statusCode).toBe(401);
    await unauthenticated.close();

    const authenticated = await buildServer({ authenticated: true });
    const accepted = await authenticated.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/interested?limit=24',
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      success: true,
      data: {
        count: 1,
        users: [
          {
            userId: 'user_2',
            displayName: 'Interested Guest',
          },
        ],
      },
    });
    expect(getEventInterested).toHaveBeenCalledWith(expect.anything(), 'event_1', 24);

    await authenticated.close();
  });

  it('GET/POST /events/:id/queue preserve surge and waiting room shapes while enforcing authenticated joins', async () => {
    const unauthenticated = await buildServer();
    const rejected = await unauthenticated.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/queue',
      payload: {},
    });
    expect(rejected.statusCode).toBe(401);
    await unauthenticated.close();

    const server = await buildServer({ authenticated: true });

    const surge = await server.inject({ method: 'GET', url: '/api/v1/events/event_1/queue' });
    const joined = await server.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/queue',
      payload: {},
    });
    const status = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/queue?queueId=queue_1',
    });

    expect(surge.statusCode).toBe(200);
    expect(surge.json()).toEqual({ surgeActive: true });
    expect(joined.json()).toMatchObject({ id: 'queue_1', status: 'waiting' });
    expect(status.json()).toMatchObject({ id: 'queue_1', lanePosition: 2 });
    expect(getEventSurgeStatus).toHaveBeenCalledWith(expect.anything(), 'event_1');
    expect(joinEventQueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'event_1', userId: 'user_1' }),
    );
    expect(joinEventQueue).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'client_user' }),
    );
    expect(getEventQueueStatus).toHaveBeenCalledWith(expect.anything(), 'queue_1');

    await server.close();
  });

  it('POST /events/:id/waitlist uses authenticated identity and returns queue position', async () => {
    const unauthenticated = await buildServer();
    const rejected = await unauthenticated.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/waitlist',
      payload: { tierId: 'tier_1' },
    });
    expect(rejected.statusCode).toBe(401);
    await unauthenticated.close();

    const server = await buildServer({ authenticated: true });
    const accepted = await server.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/waitlist',
      payload: {
        tierId: 'tier_1',
        email: 'client-controlled@example.com',
        phone: '+919999999999',
      },
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      success: true,
      joined: true,
      position: 3,
      totalWaiting: 10,
      data: {
        joined: true,
        position: 3,
        totalWaiting: 10,
      },
    });
    expect(joinEventWaitlist).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      ticketId: undefined,
      tierId: 'tier_1',
      userId: 'user_1',
      email: 'guest@example.com',
      phone: '+919999999999',
    });
    expect(joinEventWaitlist).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'client-controlled@example.com' }),
    );
    expect(getEventWaitlistStatus).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      email: 'guest@example.com',
    });

    await server.close();
  });

  it('GET /events/:id/viewer-state returns canonical RSVP and queue state for the viewer', async () => {
    const server = await buildServer({ authenticated: true });
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/viewer-state',
    });

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

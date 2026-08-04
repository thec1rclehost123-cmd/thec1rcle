import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import validatePlugin from '../../plugins/validate';
import eventRoutes from './events';
import {
  getEventQueueStatus,
  getEventSurgeStatus,
  getEventInterested,
  getEventWaitlistStatus,
  joinEventQueue,
  joinEventWaitlist,
  toggleEventRsvp,
  trackGuestEventInteraction,
  trackGuestEventView,
} from '@c1rcle/core/guest-event-conversion';
import { InventoryUnavailableError, listAvailableTicketTiers } from '@c1rcle/core/inventory-engine';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

vi.mock('@c1rcle/core/guest-event-conversion', () => ({
  getEventInterested: vi.fn(async () => ({
    count: 1,
    users: [{ id: 'guest_1', name: 'QA Guest', photoURL: null }],
  })),
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

async function buildServer({
  authenticated = false,
  customDb,
  partnerMembership,
}: { authenticated?: boolean; customDb?: any; partnerMembership?: any | null } = {}) {
  const server = Fastify({ logger: false });
  server.decorate(
    'db',
    customDb ??
      ({
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
      } as any),
  );
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
  server.decorate('revalidateGuestEvent', vi.fn(async () => undefined) as any);
  server.decorate('verifyPartnerAccess', vi.fn(async () => true) as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (!request.user?.uid) {
      return reply
        .status(401)
        .send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }
  });
  server.decorateRequest('user', null);
  server.decorateRequest('authContext', null);
  server.addHook('onRequest', async (request: any) => {
    const activeMembership =
      partnerMembership === undefined
        ? {
            uid: 'user_1',
            partnerId: 'host_123',
            partnerType: 'host',
            role: 'owner',
            status: 'active',
            isActive: true,
          }
        : partnerMembership;
    request.user = authenticated
      ? { uid: 'user_1', email: 'guest@example.com', activeMembership }
      : null;
    request.authContext = authenticated
      ? {
          memberships: activeMembership ? [activeMembership] : [],
          activeMembership,
          scopes: {
            partnerIds: activeMembership ? [activeMembership.partnerId] : [],
            partnerTypes: activeMembership ? [activeMembership.partnerType] : [],
            roles: activeMembership ? [activeMembership.role] : [],
          },
        }
      : null;
  });
  await server.register(validatePlugin);
  await server.register(eventRoutes, { prefix: '/api/v1' });
  return server;
}

describe('event routes GP-3 conversion contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /events/:id/interested returns the authenticated public profile projection', async () => {
    const server = await buildServer({ authenticated: true });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/event_1/interested?limit=24',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        count: 1,
        users: [{ id: 'guest_1', name: 'QA Guest', photoURL: null }],
      },
    });
    expect(getEventInterested).toHaveBeenCalledWith(expect.any(Object), 'event_1', 24);

    await server.close();
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

  it('GET /events paginates a partner event list without an unbounded fallback', async () => {
    const db = new MockFirestore();
    for (let index = 1; index <= 5; index += 1) {
      db.seed(`events/event_${index}`, {
        creatorId: 'host_123',
        lifecycle: 'draft',
        title: `Event ${index}`,
        startDate: `2026-08-${String(index).padStart(2, '0')}`,
      });
    }
    const server = await buildServer({ authenticated: true, customDb: db as any });

    const first = await server.inject({
      method: 'GET',
      url: '/api/v1/events?creatorId=host_123&lifecycle=draft&limit=2',
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().events.map((event: any) => event.id)).toEqual(['event_5', 'event_4']);
    expect(first.json()).toMatchObject({ hasMore: true, nextCursor: 'event_4' });

    const second = await server.inject({
      method: 'GET',
      url: `/api/v1/events?creatorId=host_123&lifecycle=draft&limit=2&cursor=${first.json().nextCursor}`,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().events.map((event: any) => event.id)).toEqual(['event_3', 'event_2']);
    expect(second.json()).toMatchObject({ hasMore: true, nextCursor: 'event_2' });
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
    const impression = await server.inject({
      method: 'POST',
      url: '/api/v1/events/event_1/track',
      payload: { type: 'impression' },
    });

    expect(view.statusCode).toBe(200);
    expect(view.json()).toEqual({ ok: true });
    expect(track.statusCode).toBe(200);
    expect(track.json()).toEqual({ ok: true });
    expect(impression.statusCode).toBe(200);
    expect(impression.json()).toEqual({ ok: true });
    expect(trackGuestEventView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'event_1' }),
    );
    expect(trackGuestEventInteraction).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      type: 'click',
      ref: 'PROMO1',
    });
    expect(trackGuestEventInteraction).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'event_1',
      type: 'impression',
      ref: undefined,
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

describe('promoterCompensation V2 schema', () => {
  /** Builds a fresh mockDb + a way to read back whatever gets `create`d into the events collection. */
  function buildPromoterCreateMockDb() {
    let savedEventRecord: any = null;
    const txCreateSpy = vi.fn((ref: any, record: any) => {
      if (String(ref.path || '').startsWith('events/')) {
        savedEventRecord = record;
      }
    });

    const mockDb = {
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id: string) => ({
          path: `${name}/${id}`,
          get: vi.fn(async () => {
            if (name === 'promoters') {
              return {
                exists: true,
                data: () => ({
                  displayName: `Promoter ${id}`,
                  email: `${id}@example.com`,
                  phoneNumber: '+918888888888',
                  role: 'promoter_owner',
                }),
              };
            }
            return { exists: false, data: () => ({}) };
          }),
          set: vi.fn(),
          update: vi.fn(),
        })),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn(async () => ({ empty: true, docs: [] })),
        add: vi.fn(async () => ({ id: 'notif_1' })),
      })),
      runTransaction: vi.fn(async (cb: any) => {
        const tx = {
          get: vi.fn(async () => ({ empty: true, docs: [] })),
          create: txCreateSpy,
          set: vi.fn(),
          update: vi.fn(),
        };
        return cb(tx);
      }),
    };

    return { mockDb, txCreateSpy, getSavedEventRecord: () => savedEventRecord };
  }

  const basePayload = {
    creatorRole: 'host',
    creatorId: 'host_123',
    hostId: 'host_123',
    venueId: 'venue_456',
    venueName: 'The Palace Club',
    startDate: '2026-08-15',
    startTime: '22:00',
    endTime: '04:00',
    lifecycle: 'draft',
    promotersEnabled: true,
  };

  it('rejects an invalid Cover Charge tier before publishing an event', async () => {
    const { mockDb, txCreateSpy } = buildPromoterCreateMockDb();
    const server = await buildServer({
      authenticated: true,
      customDb: mockDb,
      partnerMembership: {
        uid: 'user_1',
        partnerId: 'venue_456',
        partnerType: 'venue',
        role: 'owner',
        status: 'active',
        isActive: true,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload: {
        ...basePayload,
        creatorRole: 'venue',
        creatorId: 'venue_456',
        lifecycle: 'scheduled',
        title: 'Invalid Cover Wallet Event',
        promotersEnabled: false,
        tickets: [
          {
            id: 'cover',
            name: 'Cover Entry',
            price: 1_500,
            quantity: 20,
            coverChargeConfig: {
              enabled: true,
              walletAmountPaise: 50_000.5,
              terminationHour: 5,
              terminationPolicy: 'forfeit',
              presetItems: [],
            },
          },
        ],
      },
    });

    expect(response.statusCode, response.body).toBe(400);
    expect(response.json().code || response.json().error?.code, response.body).toBe(
      'COVER_CHARGE_CONFIG_INVALID',
    );
    expect(txCreateSpy).not.toHaveBeenCalled();
    await server.close();
  });

  it('allows an incomplete Cover Charge panel to remain in a draft without normalizing it', async () => {
    const { mockDb, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({
      authenticated: true,
      customDb: mockDb,
      partnerMembership: {
        uid: 'user_1',
        partnerId: 'venue_456',
        partnerType: 'venue',
        role: 'owner',
        status: 'active',
        isActive: true,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload: {
        ...basePayload,
        creatorRole: 'venue',
        creatorId: 'venue_456',
        hostId: 'venue_456',
        lifecycle: 'draft',
        title: 'Incomplete Cover Wallet Draft',
        promotersEnabled: false,
        tickets: [
          {
            id: 'cover',
            name: 'Cover Entry',
            price: 1_500,
            quantity: 20,
            coverChargeConfig: {
              enabled: true,
              walletAmountPaise: 0,
              terminationPolicy: 'partial_refund',
              presetItems: [],
            },
          },
        ],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(getSavedEventRecord().tickets[0].coverChargeConfig).toEqual({
      enabled: true,
      walletAmountPaise: 0,
      terminationPolicy: 'partial_refund',
      presetItems: [],
    });
    await server.close();
  });

  it('normalizes a published refund-policy Cover Charge tier to a full unspent-balance refund', async () => {
    const { mockDb, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({
      authenticated: true,
      customDb: mockDb,
      partnerMembership: {
        uid: 'user_1',
        partnerId: 'venue_456',
        partnerType: 'venue',
        role: 'owner',
        status: 'active',
        isActive: true,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload: {
        ...basePayload,
        creatorRole: 'venue',
        creatorId: 'venue_456',
        lifecycle: 'scheduled',
        title: 'Validated Cover Wallet Event',
        host: 'Venue 456',
        location: 'The Palace Club, Mumbai',
        promotersEnabled: false,
        tickets: [
          {
            id: 'cover',
            name: 'Cover Entry',
            price: 1_500,
            quantity: 20,
            coverChargeConfig: {
              enabled: true,
              walletAmountPaise: 50_000,
              terminationHour: 5,
              terminationPolicy: 'partial_refund',
              presetItems: [
                {
                  id: 'water',
                  name: 'Water',
                  amountPaise: 5_000,
                  isAvailable: true,
                },
              ],
            },
          },
        ],
      },
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(getSavedEventRecord().tickets[0].coverChargeConfig).toMatchObject({
      enabled: true,
      walletAmountPaise: 50_000,
      terminationPolicy: 'partial_refund',
      partialRefundPercent: 100,
      maxDebitsPerMinutePerDevice: 3,
    });
    await server.close();
  });

  it('POST /partner/events/create stores V2 promoterCompensation structure', async () => {
    const { mockDb, txCreateSpy, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({ authenticated: true, customDb: mockDb });

    const payload = {
      ...basePayload,
      title: 'V2 Schema Test Night',
      compensationModel: 'standard',
      commission: 12,
      commissionType: 'percent',
      promoters: ['promoter_1'],
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(mockDb.runTransaction).toHaveBeenCalled();
    expect(txCreateSpy).toHaveBeenCalled();

    const savedEventRecord = getSavedEventRecord();
    expect(savedEventRecord).toBeDefined();
    expect(savedEventRecord.promoterCompensation).toBeDefined();

    const pc = savedEventRecord.promoterCompensation;

    // V2 schema fields
    expect(pc.schemaVersion).toBe(2);
    expect(pc.model).toBe('standard');
    expect(pc.enabled).toBe(true);

    // defaults block
    expect(pc.defaults).toBeDefined();
    expect(pc.defaults.ticketCommission).toEqual({ type: 'percentage', value: 12 });

    // overrides block — empty (no per-promoter overrides in payload)
    expect(pc.overrides).toBeDefined();
    expect(typeof pc.overrides).toBe('object');

    // revenueSummary computed
    expect(pc.revenueSummary).toBeDefined();

    // No legacy V1 sub-objects
    expect(pc.standard).toBeUndefined();
    expect(pc.custom).toBeUndefined();
    expect(pc.salary).toBeUndefined();
    expect(pc.promoters).toBeUndefined();

    // Top-level promoters array is the clean { promoterId, status } shape
    expect(savedEventRecord.promoters).toEqual([{ promoterId: 'promoter_1', status: 'accepted' }]);
    expect(savedEventRecord.commission).toBeUndefined();
    expect(savedEventRecord.compensationModel).toBeUndefined();

    await server.close();
  });

  it('POST /partner/events/create stores V2 custom-model promoterCompensation with per-tier commissions', async () => {
    const { mockDb, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({ authenticated: true, customDb: mockDb });

    const payload = {
      ...basePayload,
      title: 'Custom Model Night',
      compensationModel: 'custom',
      tickets: [
        {
          id: 'ga',
          name: 'GA',
          price: 500,
          quantity: 100,
          commissionType: 'percent',
          commissionValue: 10,
        },
        {
          id: 'vip',
          name: 'VIP',
          price: 2000,
          quantity: 20,
          commissionType: 'percent',
          commissionValue: 20,
        },
      ],
      promoters: ['promoter_1'],
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload,
    });

    expect(response.statusCode).toBe(201);

    const pc = getSavedEventRecord().promoterCompensation;
    expect(pc.schemaVersion).toBe(2);
    expect(pc.model).toBe('custom');
    expect(pc.defaults.ticketCommissions).toEqual([
      { ticketTierId: 'ga', type: 'percentage', value: 10 },
      { ticketTierId: 'vip', type: 'percentage', value: 20 },
    ]);

    await server.close();
  });

  it('POST /partner/events/create stores V2 salary-model promoterCompensation with table incentive', async () => {
    const { mockDb, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({ authenticated: true, customDb: mockDb });

    const payload = {
      ...basePayload,
      title: 'Salary Model Night',
      compensationModel: 'salary',
      salaryTableIncentivesEnabled: true,
      salaryTableIncentiveType: 'percent',
      salaryTableIncentiveValue: 8,
      salaryNotes: 'Promoters are paid a fixed monthly salary.',
      promoters: ['promoter_1'],
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload,
    });

    expect(response.statusCode).toBe(201);

    const pc = getSavedEventRecord().promoterCompensation;
    expect(pc.schemaVersion).toBe(2);
    expect(pc.model).toBe('salary');
    expect(pc.defaults.notes).toBe('Promoters are paid a fixed monthly salary.');
    expect(pc.defaults.tableIncentive).toEqual({ enabled: true, type: 'percentage', value: 8 });
    expect(pc.overrides).toEqual({});

    await server.close();
  });

  it('POST /partner/events/create stores per-promoter commission overrides', async () => {
    const { mockDb, getSavedEventRecord } = buildPromoterCreateMockDb();
    const server = await buildServer({ authenticated: true, customDb: mockDb });

    const payload = {
      ...basePayload,
      title: 'Overrides Night',
      compensationModel: 'standard',
      commission: 15,
      commissionType: 'percent',
      promoterCommissionOverrides: {
        promoter_1: { hasCustomCommission: true, globalRate: 20, globalRateType: 'percent' },
      },
      promoters: ['promoter_1', 'promoter_2'],
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/partner/events/create',
      payload,
    });

    expect(response.statusCode).toBe(201);

    const pc = getSavedEventRecord().promoterCompensation;
    expect(pc.defaults.ticketCommission).toEqual({ type: 'percentage', value: 15 });
    expect(pc.overrides.promoter_1).toEqual({
      ticketCommission: { type: 'percentage', value: 20 },
    });
    expect(pc.overrides.promoter_2).toBeUndefined();

    await server.close();
  });

  it('GET /events/:id normalises a stored v1-shaped promoterCompensation to V2 (backward-compat read shim)', async () => {
    const server = await buildServer();
    (server as any).publicDiscoveryService.getEventDetail.mockResolvedValueOnce({
      event: {
        id: 'legacy_event',
        title: 'Legacy Shape Event',
        promoterCompensation: {
          model: 'standard',
          enabled: true,
          standard: {
            commissionValue: 18,
            commissionType: 'percent',
          },
          promoters: [],
        },
      },
      interestedData: { count: 0, users: [] },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/events/legacy_event',
    });

    expect(response.statusCode).toBe(200);
    const pc = response.json().event.promoterCompensation;

    expect(pc.schemaVersion).toBe(2);
    expect(pc.model).toBe('standard');
    expect(pc.defaults.ticketCommission).toEqual({ type: 'percentage', value: 18 });
    expect(pc.standard).toBeUndefined();

    await server.close();
  });
});

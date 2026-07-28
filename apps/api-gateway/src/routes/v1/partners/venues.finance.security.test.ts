import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../../plugins/validate.js';
import { MockFirestore } from '../../../test-utils/mock-firestore.js';
import partnersVenueRoutes from './venues.js';

async function buildServer(role: string) {
  const server = Fastify({ logger: false });
  server.decorate('db', new MockFirestore() as any);
  server.decorate('redis', null as any);
  server.decorate('cache', { get: async () => null, set: async () => undefined } as any);
  server.decorate('enrichAuthContext', async () => {});
  server.decorate('requireAuth', async () => {});
  server.addHook('onRequest', (request: any, _reply, done) => {
    const activeMembership = {
      partnerId: 'venue-1',
      partnerType: 'venue',
      role,
      status: 'active',
      isActive: true,
    };
    request.user = {
      uid: 'venue-user-1',
      activeMembership,
    };
    request.authContext = {
      memberships: [activeMembership],
      activeMembership,
    };
    done();
  });
  await server.register(validatePlugin);
  await server.register(partnersVenueRoutes);
  return server;
}

describe('venue wildcard finance permissions', () => {
  it.each(['door', 'security', 'staff'])(
    'denies %s access to venue finance reads',
    async (role) => {
      const server = await buildServer(role);
      const response = await server.inject({
        method: 'GET',
        url: '/partners/venues/finance/cover-recon',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('PERMISSION_REQUIRED');
      await server.close();
    },
  );

  it('allows a venue owner to read venue finance data', async () => {
    const server = await buildServer('owner');
    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/finance/cover-recon',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ events: [], reconciliation: null });
    await server.close();
  });

  it('requires MANAGE_PAYOUTS for venue finance mutations', async () => {
    const server = await buildServer('manager');
    const response = await server.inject({
      method: 'POST',
      url: '/partners/venues/finance/bank-accounts',
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('PERMISSION_REQUIRED');
    await server.close();
  });

  it('serves a cursor-ready ledger contract from canonical paise entries', async () => {
    const server = await buildServer('owner');
    (server as any).db.seed('partner_ledger/ledger-1', {
      eventId: 'event-1',
      orderId: 'order-1',
      referenceId: 'order-1',
      type: 'venue_share',
      amountPaise: 49_900,
      currency: 'INR',
      toPartnerId: 'venue-1',
      fromPartnerId: 'host-1',
      status: 'pending',
      createdAt: '2026-07-28T00:00:00.000Z',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/finance/ledger?limit=50',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      transactions: [
        expect.objectContaining({
          id: 'ledger-1',
          amount: 499,
          amountPaise: 49_900,
          category: 'ticket_sale',
          status: 'pending',
          currency: 'INR',
        }),
      ],
      pagination: {
        limit: 50,
        hasMore: false,
        nextCursor: null,
      },
      fromCache: false,
    });
    await server.close();
  });

  it('bounds Venue order reads to one cursor page', async () => {
    const server = await buildServer('owner');
    for (let index = 0; index < 25; index += 1) {
      const orderId = `order-${String(index).padStart(2, '0')}`;
      (server as any).db.seed(`orders/${orderId}`, {
        venueId: 'venue-1',
        eventId: 'event-1',
        status: 'confirmed',
        buyerName: `Guest ${index}`,
        ticketCount: 1,
        createdAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      });
      (server as any).db.seed(`partner_ledger/${orderId}-revenue`, {
        orderId,
        type: 'ticket_revenue',
        amountPaise: 49_900,
        status: 'pending',
      });
    }

    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/orders?limit=20',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().orders).toHaveLength(20);
    expect(response.json().pagination).toEqual({
      limit: 20,
      hasMore: true,
      nextCursor: expect.any(String),
    });
    await server.close();
  });

  it('bounds scanner device oversight payloads', async () => {
    const server = await buildServer('owner');
    (server as any).db.seed('events/event-1', { venueId: 'venue-1' });
    for (let index = 0; index < 125; index += 1) {
      (server as any).db.seed(`scanner_devices/device-${index}`, {
        venueId: 'venue-1',
        eventId: 'event-1',
        isOnline: true,
      });
    }

    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/guest-ops/event-1/scanner/devices',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().devices).toHaveLength(100);
    await server.close();
  });

  it('honors the bounded live scanner stream limit', async () => {
    const server = await buildServer('owner');
    (server as any).db.seed('events/event-1', { venueId: 'venue-1' });
    for (let index = 0; index < 25; index += 1) {
      (server as any).db.seed(`ticket_scans/scan-${index}`, {
        eventId: 'event-1',
        result: 'valid',
        scannedAt: `2026-07-28T00:${String(index).padStart(2, '0')}:00.000Z`,
      });
    }

    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/guest-ops/event-1/scanner/stream?limit=7',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().scans).toHaveLength(7);
    await server.close();
  });

  it('uses one bounded authoritative query for today Venue events', async () => {
    const server = await buildServer('owner');
    const todayKey = new Date().toISOString().slice(0, 10);
    (server as any).db.seed('events/past-event', {
      venueId: 'venue-1',
      title: 'Past Event',
      startDate: '2020-01-01T20:00:00.000Z',
    });
    (server as any).db.seed('events/today-event', {
      venueId: 'venue-1',
      title: 'Tonight Event',
      startDate: `${todayKey}T20:00:00.000Z`,
    });
    (server as any).db.seed('events/other-venue-event', {
      venueId: 'venue-2',
      title: 'Other Venue',
      startDate: `${todayKey}T21:00:00.000Z`,
    });

    let eventCollectionCalls = 0;
    const originalCollection = (server as any).db.collection.bind((server as any).db);
    (server as any).db.collection = (path: string) => {
      if (path === 'events') eventCollectionCalls += 1;
      return originalCollection(path);
    };

    const response = await server.inject({
      method: 'GET',
      url: '/partners/venues/events?date=today&limit=1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual([
      expect.objectContaining({
        id: 'today-event',
        eventId: 'today-event',
        title: 'Tonight Event',
      }),
    ]);
    expect(eventCollectionCalls).toBe(1);
    await server.close();
  });
});

import { describe, expect, it } from 'vitest';
import { HostService } from './host-service.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

describe('HostService.getEvent', () => {
  it('returns null when the requesting host does not own the event', async () => {
    const db = new MockFirestore();
    db.seed('events/event_1', {
      title: 'Private Event',
      creatorId: 'host_owner',
      hostId: 'host_owner',
    });

    const service = new HostService(db as any);
    const event = await service.getEvent(
      {
        partnerId: 'host_other',
        uid: 'user_1',
        type: 'host',
        roles: ['host_owner'],
        venueIds: [],
        displayName: 'Other Host',
      },
      'event_1',
    );

    expect(event).toBeNull();
  });

  it('normalizes wizard ticket rows into the canonical event-detail contract', async () => {
    const db = new MockFirestore();
    db.seed('events/event_2', {
      title: 'Wizard Event',
      creatorId: 'host_1',
      hostId: 'host_1',
      tickets: [{ id: 'early-bird', name: 'Early Bird', price: 499, quantity: 100, sold: 2 }],
    });
    const service = new HostService(db as any);

    const event = await service.getEvent(
      {
        partnerId: 'host_1',
        uid: 'user_1',
        type: 'host',
        roles: ['host_owner'],
        venueIds: [],
        displayName: 'QA Host',
      },
      'event_2',
    );

    expect(event?.ticketTiers).toEqual([
      {
        tierId: 'early-bird',
        name: 'Early Bird',
        price: 499,
        capacity: 100,
        sold: 2,
      },
    ]);
  });
});

describe('HostService.getPerformance', () => {
  const context = {
    partnerId: 'host_1',
    uid: 'user_1',
    type: 'host' as const,
    roles: ['host_owner' as const],
    venueIds: [],
    displayName: 'QA Host',
  };

  it('builds revenue and ticket series only from bounded ledger projections', async () => {
    const db = new MockFirestore();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    db.seed(`partner_finance_aggregates/host_1/daily/${today}`, {
      date: today,
      grossRevenue: 49_900,
      ticketsSold: 2,
    });
    db.seed('orders/raw_order_that_must_not_drive_graphs', {
      hostId: 'host_1',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      totalPaise: 99_999_900,
      ticketCount: 999,
    });

    const service = new HostService(db as any);
    const revenue = await service.getPerformance(context, '1w', 'revenue');
    const tickets = await service.getPerformance(context, '1w', 'tickets');

    expect(revenue.total).toBe(499);
    expect(tickets.total).toBe(2);
    expect(revenue.series).toHaveLength(7);
    expect(revenue.series.some((point) => point.revenue === 499)).toBe(true);
    expect(tickets.series.some((point) => point.ticketsSold === 2)).toBe(true);
  });

  it('fails closed when the canonical projection cannot be read', async () => {
    const query: any = {
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      get: async () => {
        throw new Error('Firestore unavailable');
      },
    };
    const service = new HostService({
      db: {
        collection: () => ({
          doc: () => ({
            collection: () => query,
          }),
        }),
      } as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    await expect(service.getPerformance(context, '1m', 'tickets')).rejects.toMatchObject({
      code: 'ANALYTICS_DATA_UNAVAILABLE',
      statusCode: 503,
    });
  });
});

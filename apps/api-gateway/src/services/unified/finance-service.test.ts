import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from './finance-service.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

describe('FinanceService.recordTicketSale', () => {
  it('rejects direct ticket-sale writes outside atomic payment finalization', async () => {
    const db = new MockFirestore();
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const participants = {
      venueId: 'venue_1',
      hostId: 'host_1',
      promoterId: 'promoter_1',
      promoterLinkId: 'link_1',
      platformFeeRate: 0.1,
      venueShareRate: 0.2,
      promoterCommissionRate: 0.15,
    };

    await expect(
      service.recordTicketSale('event_1', 'order_1', 1000, participants),
    ).rejects.toThrow('DIRECT_TICKET_LEDGER_WRITE_DISABLED');
    expect(db.listCollection('partner_ledger')).toHaveLength(0);
    expect(db.getDoc('partner_ledger_idempotency/order_1')).toBeUndefined();
  });

  it('exposes display rupees separately from canonical integer paise', async () => {
    const db = new MockFirestore();
    db.seed('partner_finance_aggregates/host_1', {
      balances: { pending: 12345, settled: 67890, disputed: 0, reversed: 0 },
    });
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const balances = await service.getBalances({
      partnerId: 'host_1',
      uid: 'host_1',
      type: 'host',
      roles: [],
      venueIds: [],
      displayName: 'Host',
    });

    expect(balances).toEqual({
      available: 678.9,
      pending: 123.45,
      availablePaise: 67890,
      pendingPaise: 12345,
      currency: 'INR',
    });
  });

  it('caches canonical balances for only the 15-second launch window', async () => {
    const db = new MockFirestore();
    db.seed('partner_finance_aggregates/host_1', {
      balances: { pending: 12345, settled: 67890, disputed: 0, reversed: 0 },
    });
    const set = vi.fn().mockResolvedValue('OK');
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: {
        status: 'ready',
        get: vi.fn().mockResolvedValue(null),
        set,
      },
    } as any);

    await service.getBalances({
      partnerId: 'host_1',
      uid: 'host_1',
      type: 'host',
      roles: [],
      venueIds: [],
      displayName: 'Host',
    });

    expect(set).toHaveBeenCalledWith('finance:balance:v2:host_1', expect.any(String), 'EX', 15);
  });

  it('fails closed instead of scanning the full ledger when the paginated index is unavailable', async () => {
    const query: any = {
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      get: vi.fn().mockRejectedValue(new Error('FAILED_PRECONDITION: missing index')),
    };
    const collection = vi.fn(() => query);
    const service = new FinanceService({
      db: { collection } as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    await expect(
      service.getLedger(
        {
          partnerId: 'venue_1',
          uid: 'venue_owner',
          type: 'venue',
          roles: [],
          venueIds: ['venue_1'],
          displayName: 'QA Venue',
        },
        { limit: 50 },
      ),
    ).rejects.toMatchObject({
      code: 'FINANCE_DATA_UNAVAILABLE',
      statusCode: 503,
    });
    expect(collection).toHaveBeenCalledTimes(1);
    expect(query.get).toHaveBeenCalledTimes(1);
  });

  it('rebuilds malformed dotted-field projections from canonical ledger rows', async () => {
    const db = new MockFirestore();
    db.seed('partner_finance_aggregates/venue_1', {
      partnerId: 'venue_1',
      balances: { pending: 0, settled: 0, disputed: 0, reversed: 0 },
      totalsByType: {},
      'balances.pending': 99800,
      'totalsByType.venue_share': 99800,
    });
    db.seed('partner_ledger/entry_1', {
      eventId: 'event_1',
      type: 'venue_share',
      amountPaise: 99800,
      toPartnerId: 'venue_1',
      status: 'pending',
      createdAt: '2026-07-27T21:18:33.489Z',
    });
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const balances = await service.getBalances({
      partnerId: 'venue_1',
      uid: 'venue_owner',
      type: 'venue',
      roles: [],
      venueIds: ['venue_1'],
      displayName: 'QA Venue',
    });

    expect(balances).toEqual({
      available: 0,
      pending: 998,
      availablePaise: 0,
      pendingPaise: 99800,
      currency: 'INR',
    });
    expect(db.getDoc('partner_finance_aggregates/venue_1')).toMatchObject({
      balances: { pending: 99800, settled: 0, disputed: 0, reversed: 0 },
      totalsByType: { venue_share: 99800 },
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        db.getDoc('partner_finance_aggregates/venue_1') || {},
        'balances.pending',
      ),
    ).toBe(false);
  });
});

describe('FinanceService.getDisputes', () => {
  it('uses a bounded single-index query and preserves deterministic newest-first ordering', async () => {
    const db = new MockFirestore();
    db.seed('disputes/dispute_old', {
      partnerId: 'host_1',
      orderId: 'order_old',
      amountPaise: 1000,
      status: 'open',
      createdAt: '2026-07-25T10:00:00.000Z',
    });
    db.seed('disputes/dispute_new', {
      partnerId: 'host_1',
      orderId: 'order_new',
      amountPaise: 2500,
      status: 'open',
      createdAt: '2026-07-26T10:00:00.000Z',
    });
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const result = await service.getDisputes({
      partnerId: 'host_1',
      uid: 'host_owner',
      type: 'host',
      roles: [],
      venueIds: [],
      displayName: 'QA Host',
    });

    expect(result.data.map((item) => item.disputeId)).toEqual(['dispute_new', 'dispute_old']);
    expect(result.data.map((item) => item.amount)).toEqual([25, 10]);
  });
});

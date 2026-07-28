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

  it('paginates an indexed status query with a document cursor', async () => {
    const db = new MockFirestore();
    for (let index = 1; index <= 6; index += 1) {
      db.seed(`disputes/dispute_${index}`, {
        partnerId: 'host_1',
        orderId: `order_${index}`,
        amountPaise: index * 100,
        status: index === 4 ? 'closed' : 'open',
        createdAt: `2026-07-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
      });
    }
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);
    const ctx = {
      partnerId: 'host_1',
      uid: 'host_owner',
      type: 'host' as const,
      roles: [],
      venueIds: [],
      displayName: 'QA Host',
    };

    const first = await service.getDisputes(ctx, { status: 'open', limit: 2 });
    expect(first.data.map((item) => item.disputeId)).toEqual(['dispute_6', 'dispute_5']);
    expect(first).toMatchObject({ hasMore: true, nextCursor: 'dispute_5' });

    const second = await service.getDisputes(ctx, {
      status: 'open',
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.data.map((item) => item.disputeId)).toEqual(['dispute_3', 'dispute_2']);
    expect(second).toMatchObject({ hasMore: true, nextCursor: 'dispute_2' });
  });
});

describe('FinanceService.getPayouts', () => {
  it('applies status, ordering, limit, and cursor in Firestore', async () => {
    const db = new MockFirestore();
    for (let index = 1; index <= 6; index += 1) {
      db.seed(`payouts/payout_${index}`, {
        partnerId: 'host_1',
        status: index === 4 ? 'failed' : 'completed',
        amountPaise: index * 100,
        requestedAt: `2026-07-${String(20 + index).padStart(2, '0')}T10:00:00.000Z`,
      });
    }
    db.seed('payouts/other_partner', {
      partnerId: 'host_2',
      status: 'completed',
      amountPaise: 99900,
      requestedAt: '2026-07-28T10:00:00.000Z',
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
    const ctx = {
      partnerId: 'host_1',
      uid: 'host_owner',
      type: 'host' as const,
      roles: [],
      venueIds: [],
      displayName: 'QA Host',
    };

    const first = await service.getPayouts(ctx, { status: 'completed', limit: 2 });
    expect(first.data.map((item) => item.payoutId)).toEqual(['payout_6', 'payout_5']);
    expect(first).toMatchObject({ hasMore: true, nextCursor: 'payout_5' });

    const second = await service.getPayouts(ctx, {
      status: 'completed',
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    expect(second.data.map((item) => item.payoutId)).toEqual(['payout_3', 'payout_2']);
    expect(second).toMatchObject({ hasMore: true, nextCursor: 'payout_2' });
  });

  it('fails closed after one indexed query failure', async () => {
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
      service.getPayouts(
        {
          partnerId: 'host_1',
          uid: 'host_owner',
          type: 'host',
          roles: [],
          venueIds: [],
          displayName: 'QA Host',
        },
        { limit: 20 },
      ),
    ).rejects.toMatchObject({
      code: 'FINANCE_DATA_UNAVAILABLE',
      statusCode: 503,
    });
    expect(query.get).toHaveBeenCalledTimes(1);
  });
});

describe('FinanceService.getFinanceSummary', () => {
  it('uses server-side sum and count aggregates for payouts, refunds, and tickets', async () => {
    const db = new MockFirestore();
    db.seed('partner_finance_aggregates/host_1', {
      currency: 'INR',
      balances: { pending: 5000, settled: 7000, disputed: 0, reversed: 0 },
      totalsByType: {},
    });
    db.seed('payouts/payout_1', {
      partnerId: 'host_1',
      status: 'completed',
      amountPaise: 2500,
    });
    db.seed('payouts/payout_2', {
      partnerId: 'host_1',
      status: 'paid',
      amountPaise: 1500,
    });
    db.seed('partner_ledger/refund_1', {
      toPartnerId: 'host_1',
      type: 'refund',
      status: 'pending',
      amountPaise: -600,
    });
    for (const [id, status] of [
      ['ticket_1', 'active'],
      ['ticket_2', 'used'],
      ['ticket_3', 'transferred'],
      ['ticket_4', 'refunded'],
    ]) {
      db.seed(`tickets/${id}`, { hostId: 'host_1', status });
    }
    const service = new FinanceService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const summary = await service.getFinanceSummary({
      partnerId: 'host_1',
      uid: 'host_owner',
      type: 'host',
      roles: [],
      venueIds: [],
      displayName: 'QA Host',
    });

    expect(summary).toMatchObject({
      netRevenuePaise: 12000,
      paidOutPaise: 4000,
      refundPendingPaise: 600,
      totalTicketsSold: 3,
    });
  });
});

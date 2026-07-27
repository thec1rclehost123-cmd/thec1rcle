import { describe, expect, it } from 'vitest';
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
});

describe('FinanceService.getDisputes', () => {
  it('keeps canonical dispute reads available when the composite index is not deployed yet', async () => {
    const docs = [
      {
        id: 'dispute_old',
        data: () => ({
          partnerId: 'host_1',
          orderId: 'order_old',
          amountPaise: 1000,
          status: 'open',
          createdAt: '2026-07-25T10:00:00.000Z',
        }),
      },
      {
        id: 'dispute_new',
        data: () => ({
          partnerId: 'host_1',
          orderId: 'order_new',
          amountPaise: 2500,
          status: 'open',
          createdAt: '2026-07-26T10:00:00.000Z',
        }),
      },
    ];
    let collectionCalls = 0;
    const indexedQuery: any = {
      orderBy: () => indexedQuery,
      limit: () => indexedQuery,
      where: () => indexedQuery,
      get: async () => {
        throw new Error('FAILED_PRECONDITION: missing index');
      },
    };
    const fallbackQuery: any = {
      get: async () => ({ docs }),
    };
    const service = new FinanceService({
      db: {
        collection: () => {
          collectionCalls += 1;
          return {
            where: () => (collectionCalls === 1 ? indexedQuery : fallbackQuery),
          };
        },
      } as any,
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
    expect(collectionCalls).toBe(2);
  });
});

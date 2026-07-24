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

import { describe, expect, it } from 'vitest';
import { FinanceService } from './finance-service.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

describe('FinanceService.recordTicketSale', () => {
  it('is idempotent for repeated order writes', async () => {
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

    await service.recordTicketSale('event_1', 'order_1', 1000, participants);
    await service.recordTicketSale('event_1', 'order_1', 1000, participants);

    expect(db.listCollection('partner_ledger')).toHaveLength(5);
    expect(db.getDoc('partner_ledger_idempotency/order_1')).toMatchObject({
      orderId: 'order_1',
      eventId: 'event_1',
      entryCount: 5,
    });
  });
});

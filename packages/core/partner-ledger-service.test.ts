import { describe, expect, it, vi } from 'vitest';
import {
  buildPartnerLedgerEntries,
  writePartnerLedgerInTransaction,
  writePartnerRefundInTransaction,
} from './partner-ledger-service.js';

const order = {
  id: 'order_1',
  eventId: 'event_1',
  hostId: 'host_1',
  venueId: 'venue_1',
  promoterId: 'promoter_1',
  promoterLinkId: 'link_1',
  currency: 'INR',
  totalPaise: 100_00,
  platformFeePaise: 10_00,
  venueSharePaise: 20_00,
  promoterCommissionPaise: 15_00,
  hostPayoutPaise: 55_00,
};

describe('partner ledger atomic posting', () => {
  it('reconciles every allocation to integer gross paise', () => {
    const posting = buildPartnerLedgerEntries({
      order,
      event: { id: 'event_1' },
      paymentId: 'pay_1',
      createdAt: '2026-07-24T00:00:00.000Z',
    });

    expect(posting.allocation).toEqual({
      platformFeePaise: 10_00,
      venueSharePaise: 20_00,
      promoterCommissionPaise: 15_00,
      hostPayoutPaise: 55_00,
    });
    expect(Object.values(posting.allocation).reduce((sum, value) => sum + value, 0)).toBe(
      order.totalPaise,
    );
    expect(posting.entries.map((entry) => entry.type)).toEqual([
      'ticket_revenue',
      'platform_fee',
      'host_payout',
      'venue_share',
      'promoter_commission',
    ]);
  });

  it('fails closed when an existing marker belongs to a different payment', () => {
    const doc = (path: string) => ({
      path,
      collection: (name: string) => ({
        doc: (id: string) => doc(`${path}/${name}/${id}`),
      }),
    });
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => doc(`${name}/${id}`),
      }),
    };
    const transaction = {
      create: vi.fn(),
      set: vi.fn(),
    };

    expect(() =>
      writePartnerLedgerInTransaction({
        db,
        transaction,
        order,
        event: { id: 'event_1' },
        paymentId: 'pay_1',
        createdAt: '2026-07-24T00:00:00.000Z',
        markerSnapshot: {
          exists: true,
          data: () => ({
            orderId: 'order_1',
            eventId: 'event_1',
            paymentId: 'pay_other',
          }),
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'LEDGER_IDEMPOTENCY_CONFLICT',
      }),
    );
    expect(transaction.create).not.toHaveBeenCalled();
  });

  it('posts a venue-owned event to the venue without a zero-value host row', () => {
    const posting = buildPartnerLedgerEntries({
      order: {
        ...order,
        hostId: 'venue_1',
        promoterId: null,
        promoterLinkId: null,
        platformFeePaise: 10_00,
        venueSharePaise: 90_00,
        promoterCommissionPaise: 0,
        hostPayoutPaise: 0,
      },
      event: { id: 'event_1', creatorRole: 'venue' },
      paymentId: 'pay_1',
      createdAt: '2026-07-24T00:00:00.000Z',
    });

    expect(posting.entries.map((entry) => entry.type)).toEqual([
      'ticket_revenue',
      'platform_fee',
      'venue_share',
    ]);
    expect(posting.entries.find((entry) => entry.type === 'venue_share')).toMatchObject({
      toPartnerId: 'venue_1',
      amountPaise: 90_00,
    });
  });

  it('allocates a partial refund exactly across the original sale rows', () => {
    const sale = buildPartnerLedgerEntries({
      order,
      event: { id: 'event_1' },
      paymentId: 'pay_1',
      createdAt: '2026-07-24T00:00:00.000Z',
    });
    const doc = (path: string) => ({
      path,
      collection: (name: string) => ({
        doc: (id: string) => doc(`${path}/${name}/${id}`),
      }),
    });
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => doc(`${name}/${id}`),
      }),
    };
    const transaction = {
      create: vi.fn(),
      set: vi.fn(),
    };

    const refund = writePartnerRefundInTransaction({
      db,
      transaction,
      order,
      refundId: 'refund_1',
      providerRefundId: 'rfnd_1',
      amountPaise: 33_33,
      createdAt: '2026-07-24T01:00:00.000Z',
      markerSnapshot: { exists: false },
      saleEntries: sale.entries,
    });

    expect(refund.entries.reduce((sum, entry) => sum + Math.abs(entry.amountPaise), 0)).toBe(33_33);
    expect(refund.entries.every((entry) => entry.type === 'refund' && entry.amountPaise < 0)).toBe(
      true,
    );
    expect(refund.markerId).toBe('refund_refund_1');
  });
});

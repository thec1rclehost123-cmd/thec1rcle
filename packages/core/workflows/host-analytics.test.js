import { describe, expect, it } from 'vitest';
import { buildHostTicketPurchaseStats } from './host-analytics.js';

describe('ledger-backed host ticket purchase statistics', () => {
  const order = {
    id: 'order_1',
    status: 'confirmed',
    hostId: 'host_1',
    entitlementIds: ['ent_1', 'ent_2'],
  };
  const marker = {
    orderId: 'order_1',
    entryCount: 2,
    entryIds: ['revenue_1', 'fee_1'],
  };
  const ledgerRows = [
    { id: 'revenue_1', orderId: 'order_1', type: 'ticket_revenue', amountPaise: 108632 },
    { id: 'fee_1', orderId: 'order_1', type: 'platform_fee', amountPaise: 8832 },
  ];

  it('derives ticket and revenue projections from committed artifacts', () => {
    expect(buildHostTicketPurchaseStats({ order, marker, ledgerRows })).toEqual({
      hostId: 'host_1',
      orderId: 'order_1',
      ticketCount: 2,
      grossPaise: 108632,
      phaseBreakdown: {},
    });
  });

  it('fails closed when a marker row or entitlement set is incomplete', () => {
    expect(() =>
      buildHostTicketPurchaseStats({ order, marker, ledgerRows: ledgerRows.slice(0, 1) }),
    ).toThrow('Complete canonical ledger posting is required');
    expect(() =>
      buildHostTicketPurchaseStats({
        order: { ...order, entitlementIds: [] },
        marker,
        ledgerRows,
      }),
    ).toThrow('Confirmed order entitlements are required');
  });
});

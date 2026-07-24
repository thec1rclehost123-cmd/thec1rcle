import { describe, expect, it } from 'vitest';
import { MockFirestore } from '../test-utils/mock-firestore.js';
import { finalizeProcessedRefund } from './refundLedger.js';

describe('finalizeProcessedRefund', () => {
  it('commits refund state, admission revocation, ledger rows, and marker together', async () => {
    const db = new MockFirestore();
    db.seed('orders/order_1', {
      id: 'order_1',
      eventId: 'event_1',
      hostId: 'host_1',
      currency: 'INR',
      status: 'refund_requested',
    });
    db.seed('refund_requests/refund_1', {
      orderId: 'order_1',
      eventId: 'event_1',
      amount: 25,
      amountPaise: 2500,
      fullyRefunded: true,
      previousStatus: 'confirmed',
      status: 'approved',
    });
    db.seed('partner_ledger/order_1__platform_fee__platform', {
      id: 'order_1__platform_fee__platform',
      orderId: 'order_1',
      eventId: 'event_1',
      type: 'platform_fee',
      amountPaise: 500,
      toPartnerId: 'platform',
      currency: 'INR',
      status: 'pending',
    });
    db.seed('partner_ledger/order_1__host_payout__host_1', {
      id: 'order_1__host_payout__host_1',
      orderId: 'order_1',
      eventId: 'event_1',
      type: 'host_payout',
      amountPaise: 9500,
      toPartnerId: 'host_1',
      currency: 'INR',
      status: 'pending',
    });
    db.seed('tickets/ticket_1', {
      orderId: 'order_1',
      eventId: 'event_1',
      status: 'active',
    });
    db.seed('entitlements/entitlement_1', {
      orderId: 'order_1',
      eventId: 'event_1',
      state: 'ACTIVE',
    });

    const result = await finalizeProcessedRefund({
      db: db as any,
      refundId: 'refund_1',
      providerRefundId: 'rfnd_1',
      processedAt: '2026-07-24T20:00:00.000Z',
    });

    expect(result).toMatchObject({
      orderId: 'order_1',
      refundId: 'refund_1',
      providerRefundId: 'rfnd_1',
      ledgerMarkerId: 'refund_refund_1',
      alreadyFinalized: false,
      ticketIds: ['ticket_1'],
      entitlementIds: ['entitlement_1'],
    });
    expect(db.getDoc('orders/order_1')).toMatchObject({
      status: 'refunded',
      refundStatus: 'completed',
      refundLedgerMarkerId: 'refund_refund_1',
    });
    expect(db.getDoc('refund_requests/refund_1')).toMatchObject({
      status: 'completed',
      razorpayRefundId: 'rfnd_1',
      ledgerMarkerId: 'refund_refund_1',
    });
    expect(db.getDoc('tickets/ticket_1')).toMatchObject({ status: 'refunded' });
    expect(db.getDoc('entitlements/entitlement_1')).toMatchObject({ state: 'REVOKED' });
    expect(db.getDoc('partner_ledger_idempotency/refund_refund_1')).toMatchObject({
      orderId: 'order_1',
      providerRefundId: 'rfnd_1',
      refundPaise: 2500,
    });
    const refundRows = db
      .listCollection('partner_ledger')
      .filter((row) => row.data.type === 'refund');
    expect(refundRows).toHaveLength(2);
    expect(refundRows.reduce((sum, row) => sum + Math.abs(row.data.amountPaise), 0)).toBe(2500);
  });
});

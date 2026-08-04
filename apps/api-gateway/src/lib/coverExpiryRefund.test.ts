import { describe, expect, it, vi } from 'vitest';
import { MockFirestore } from '../test-utils/mock-firestore.js';
import { processCoverExpiryRefundOutbox } from './coverExpiryRefund.js';

function seedExpiryRefund(db: MockFirestore) {
  db.seed('orders/order_1', {
    id: 'order_1',
    eventId: 'event_1',
    userId: 'user_1',
    hostId: 'host_1',
    status: 'confirmed',
    paymentId: 'pay_1',
    totalPaise: 10_000,
  });
  db.seed('cover_wallets/CW-1', {
    id: 'CW-1',
    orderId: 'order_1',
    eventId: 'event_1',
    venueId: 'venue_1',
    userId: 'user_1',
    state: 'EXPIRED',
  });
  db.seed('cover_wallets/CW-1/txns/EXPIRY-REFUND-CW-1', {
    id: 'EXPIRY-REFUND-CW-1',
    type: 'EXPIRY_REFUND',
    amountPaise: 2500,
  });
  db.seed('domain_event_outbox/cover-wallet-expiry-refund-CW-1', {
    id: 'cover-wallet-expiry-refund-CW-1',
    type: 'cover.wallet.expiry_refund.required',
    walletId: 'CW-1',
    orderId: 'order_1',
    eventId: 'event_1',
    venueId: 'venue_1',
    userId: 'user_1',
    amountPaise: 2500,
    status: 'pending',
    attempts: 0,
  });
}

function buildFastify(db: MockFirestore) {
  return {
    db,
    checkoutService: {},
    writeAuditLog: vi.fn(async () => undefined),
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as any;
}

describe('processCoverExpiryRefundOutbox', () => {
  it('creates one deterministic no-admission refund and dispatches the outbox', async () => {
    const db = new MockFirestore();
    seedExpiryRefund(db);
    const settle = vi.fn(async () => ({
      ok: true as const,
      status: 'completed',
      razorpayRefundId: 'rfnd_1',
    }));

    const result = await processCoverExpiryRefundOutbox(buildFastify(db), { settle });

    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    expect(settle).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        refundId: 'cover_expiry_CW-1',
        orderId: 'order_1',
        amountPaise: 2500,
        razorpayPaymentId: 'pay_1',
        fullyRefunded: false,
        previousStatus: 'confirmed',
      }),
    );
    expect(db.getDoc('refund_requests/cover_expiry_CW-1')).toMatchObject({
      refundKind: 'cover_wallet_expiry',
      amountPaise: 2500,
      revokeAdmission: false,
      status: 'approved',
      idempotencyKey: 'cover-expiry-refund:CW-1',
    });
    expect(db.getDoc('domain_event_outbox/cover-wallet-expiry-refund-CW-1')).toMatchObject({
      status: 'dispatched',
      providerRefundId: 'rfnd_1',
      attempts: 1,
    });
  });

  it('does not call the provider twice after a completed deterministic refund', async () => {
    const db = new MockFirestore();
    seedExpiryRefund(db);
    db.seed('refund_requests/cover_expiry_CW-1', {
      orderId: 'order_1',
      amountPaise: 2500,
      status: 'completed',
      razorpayRefundId: 'rfnd_existing',
      completedAt: '2026-07-27T12:00:00.000Z',
    });
    const settle = vi.fn();

    const result = await processCoverExpiryRefundOutbox(buildFastify(db), { settle });

    expect(result).toMatchObject({ processed: 1, succeeded: 0, skipped: 1, failed: 0 });
    expect(settle).not.toHaveBeenCalled();
    expect(db.getDoc('domain_event_outbox/cover-wallet-expiry-refund-CW-1')).toMatchObject({
      status: 'dispatched',
      providerRefundId: 'rfnd_existing',
    });
  });

  it('moves an ambiguous provider failure to operator review instead of auto-retrying', async () => {
    const db = new MockFirestore();
    seedExpiryRefund(db);
    const settle = vi.fn(async () => ({
      ok: false as const,
      error: 'Provider connection ended before confirmation',
    }));

    const result = await processCoverExpiryRefundOutbox(buildFastify(db), { settle });

    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    expect(result.results[0]).toMatchObject({ operatorReviewRequired: true });
    expect(db.getDoc('domain_event_outbox/cover-wallet-expiry-refund-CW-1')).toMatchObject({
      status: 'operator_review',
      attempts: 1,
    });

    const replay = await processCoverExpiryRefundOutbox(buildFastify(db), { settle });
    expect(replay.processed).toBe(0);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the expiry amount and outbox amount do not reconcile', async () => {
    const db = new MockFirestore();
    seedExpiryRefund(db);
    db.seed('cover_wallets/CW-1/txns/EXPIRY-REFUND-CW-1', {
      type: 'EXPIRY_REFUND',
      amountPaise: 2400,
    });
    const settle = vi.fn();

    const result = await processCoverExpiryRefundOutbox(buildFastify(db), { settle });

    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    expect(settle).not.toHaveBeenCalled();
    expect(db.getDoc('domain_event_outbox/cover-wallet-expiry-refund-CW-1')).toMatchObject({
      status: 'operator_review',
    });
  });
});

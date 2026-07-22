import { describe, expect, it } from 'vitest';
import {
  buildPaymentFinalizationKey,
  classifyRazorpayWebhookDelivery,
  decidePaymentTruth,
  decideRefundEffects,
  decideRefundTransition,
  validateRefundRequest,
} from './src/domain/payment-refund-contract.js';

describe('payment finalization contract', () => {
  it('converges callback, webhook, and reconciler on one deterministic key', () => {
    const identity = {
      provider: 'razorpay' as const,
      providerOrderId: 'order_live_1',
      providerPaymentId: 'pay_live_1',
    };
    const keys = (['app_callback', 'webhook', 'reconciler'] as const).map((source) =>
      buildPaymentFinalizationKey({ ...identity, source }),
    );

    expect(new Set(keys)).toEqual(new Set(['payment-finalization:razorpay:order_live_1:pay_live_1']));
  });

  it.each(['captured', 'order_paid'] as const)(
    'permits fulfillment only for verified %s provider truth',
    (truth) => {
      expect(decidePaymentTruth({ truth, providerTruthVerified: true })).toMatchObject({
        action: 'fulfill',
        permitsFulfillment: true,
        permitsReservationRelease: false,
      });
      expect(decidePaymentTruth({ truth, providerTruthVerified: false })).toMatchObject({
        action: 'hold',
        permitsFulfillment: false,
        permitsReservationRelease: false,
      });
    },
  );

  it.each(['authorized', 'pending'] as const)(
    'blocks service and release while payment is %s',
    (truth) => {
      expect(decidePaymentTruth({ truth, providerTruthVerified: true })).toMatchObject({
        action: 'hold',
        permitsFulfillment: false,
        permitsReservationRelease: false,
        requiresReconciliation: true,
      });
    },
  );

  it('blocks both effects while the provider is unavailable', () => {
    expect(
      decidePaymentTruth({ truth: 'provider_unavailable', providerTruthVerified: false }),
    ).toMatchObject({
      action: 'hold',
      permitsFulfillment: false,
      permitsReservationRelease: false,
      requiresReconciliation: true,
    });
  });

  it.each(['failed', 'expired'] as const)(
    'releases only after verified provider %s truth',
    (truth) => {
      expect(decidePaymentTruth({ truth, providerTruthVerified: false })).toMatchObject({
        action: 'hold',
        permitsReservationRelease: false,
      });
      expect(decidePaymentTruth({ truth, providerTruthVerified: true })).toMatchObject({
        action: 'release',
        permitsFulfillment: false,
        permitsReservationRelease: true,
      });
    },
  );

  it('rejects missing event ids and unauthenticated webhook deliveries', () => {
    expect(
      classifyRazorpayWebhookDelivery({
        eventId: 'evt_1',
        signatureVerified: false,
        processedEventIds: [],
      }),
    ).toEqual({ action: 'reject', code: 'INVALID_SIGNATURE', acknowledge: false });
    expect(
      classifyRazorpayWebhookDelivery({
        eventId: ' ',
        signatureVerified: true,
        processedEventIds: [],
      }),
    ).toEqual({ action: 'reject', code: 'MISSING_EVENT_ID', acknowledge: false });
  });

  it('acknowledges duplicate x-razorpay-event-id deliveries without replaying effects', () => {
    const first = classifyRazorpayWebhookDelivery({
      eventId: 'event_razorpay_1',
      signatureVerified: true,
      processedEventIds: [],
    });
    const duplicate = classifyRazorpayWebhookDelivery({
      eventId: 'event_razorpay_1',
      signatureVerified: true,
      processedEventIds: new Set(['event_razorpay_1']),
    });

    expect(first).toMatchObject({ action: 'process', acknowledge: false });
    expect(duplicate).toMatchObject({
      action: 'acknowledge_duplicate',
      acknowledge: true,
      deduplicationKey: 'razorpay-webhook-event:event_razorpay_1',
    });
  });
});

describe('refund contract', () => {
  it('allows requested -> approved -> processing -> processed|failed or terminal rejection', () => {
    expect(decideRefundTransition('requested', 'approved').allowed).toBe(true);
    expect(decideRefundTransition('requested', 'rejected').allowed).toBe(true);
    expect(decideRefundTransition('approved', 'processing').allowed).toBe(true);
    expect(decideRefundTransition('processing', 'processed').allowed).toBe(true);
    expect(decideRefundTransition('processing', 'failed').allowed).toBe(true);

    expect(decideRefundTransition('requested', 'processing')).toMatchObject({
      allowed: false,
      code: 'ILLEGAL_REFUND_TRANSITION',
    });
    expect(decideRefundTransition('approved', 'processed').allowed).toBe(false);
    expect(decideRefundTransition('processed', 'processing').allowed).toBe(false);
    expect(decideRefundTransition('failed', 'processing').allowed).toBe(false);
    expect(decideRefundTransition('rejected', 'approved').allowed).toBe(false);
  });

  it('rejects a user requesting a refund for another owner order', () => {
    expect(
      validateRefundRequest({
        actor: { uid: 'attacker' },
        order: { userId: 'owner', capturedAmountMinor: 149_900 },
      }),
    ).toEqual({ valid: false, code: 'REFUND_NOT_OWNER' });
  });

  it('allows an owner or authorized administrator and defaults to remaining captured value', () => {
    expect(
      validateRefundRequest({
        actor: { uid: 'owner' },
        order: {
          userId: 'owner',
          capturedAmountMinor: 149_900,
          processedRefundAmountMinor: 20_000,
        },
      }),
    ).toEqual({
      valid: true,
      amountMinor: 129_900,
      remainingRefundableAmountMinor: 129_900,
      authorizedAs: 'owner',
    });

    expect(
      validateRefundRequest({
        actor: { uid: 'ops', role: 'super_admin' },
        order: { userId: 'owner', capturedAmountMinor: 149_900 },
        requestedAmountMinor: 10_000,
      }),
    ).toMatchObject({ valid: true, authorizedAs: 'administrator', amountMinor: 10_000 });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid exact-minor-unit refund amount %s',
    (requestedAmountMinor) => {
      expect(
        validateRefundRequest({
          actor: { uid: 'owner' },
          order: { userId: 'owner', capturedAmountMinor: 149_900 },
          requestedAmountMinor,
        }),
      ).toEqual({ valid: false, code: 'INVALID_REFUND_AMOUNT' });
    },
  );

  it('rejects a refund amount above the remaining captured value', () => {
    expect(
      validateRefundRequest({
        actor: { uid: 'owner' },
        order: {
          userId: 'owner',
          capturedAmountMinor: 149_900,
          processedRefundAmountMinor: 50_000,
        },
        requestedAmountMinor: 100_000,
      }),
    ).toEqual({ valid: false, code: 'REFUND_AMOUNT_EXCEEDS_AVAILABLE' });
  });

  it.each(['requested', 'approved', 'processing', 'failed', 'rejected'] as const)(
    'blocks order, ticket, and inventory effects while refund is %s',
    (status) => {
      expect(
        decideRefundEffects({
          status,
          capturedAmountMinor: 149_900,
          refundAmountMinor: 149_900,
        }),
      ).toEqual({
        recordsProcessedRefund: false,
        permitsOrderTerminalization: false,
        permitsTicketInvalidation: false,
        permitsInventoryRestore: false,
        orderDisposition: 'unchanged',
      });
    },
  );

  it('permits destructive full-order effects only after a processed refund', () => {
    expect(
      decideRefundEffects({
        status: 'processed',
        capturedAmountMinor: 149_900,
        refundAmountMinor: 149_900,
      }),
    ).toEqual({
      recordsProcessedRefund: true,
      permitsOrderTerminalization: true,
      permitsTicketInvalidation: true,
      permitsInventoryRestore: true,
      orderDisposition: 'refunded',
    });
  });

  it('records a processed partial refund without terminalizing or restoring the full order', () => {
    expect(
      decideRefundEffects({
        status: 'processed',
        capturedAmountMinor: 149_900,
        processedRefundAmountMinorBefore: 20_000,
        refundAmountMinor: 10_000,
      }),
    ).toEqual({
      recordsProcessedRefund: true,
      permitsOrderTerminalization: false,
      permitsTicketInvalidation: false,
      permitsInventoryRestore: false,
      orderDisposition: 'partial_refund',
    });
  });
});

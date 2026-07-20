import { describe, expect, it, vi } from 'vitest';
import {
  RazorpayRefundProviderInputError,
  buildRazorpayRefundIdempotencyKey,
  buildRazorpayRefundRequestFingerprint,
  createRazorpayRefundProviderClient,
  mapRazorpayRefundWebhook,
} from './razorpay-refund-provider.js';

const paymentId = 'pay_test_123456';
const refundId = 'rfnd_test_123456';
const idempotencyKey = 'refund_test_123456';
const verifiedAt = '2026-07-19T12:00:00.000Z';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    entity: 'payment',
    status: 'captured',
    captured: true,
    amount: 50_000,
    amount_refunded: 0,
    currency: 'INR',
    ...overrides,
  };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    id: refundId,
    entity: 'refund',
    payment_id: paymentId,
    amount: 12_345,
    currency: 'INR',
    status: 'processed',
    ...overrides,
  };
}

function client(fetchImpl: typeof fetch) {
  return createRazorpayRefundProviderClient({
    keyId: 'rzp_test_key',
    keySecret: 'test_secret_123',
    baseUrl: 'https://razorpay.test',
    fetchImpl,
  });
}

describe('Razorpay refund provider', () => {
  it('builds deterministic, scoped idempotency material and rejects unsafe input', () => {
    expect(buildRazorpayRefundIdempotencyKey('refund_internal_1')).toBe(
      buildRazorpayRefundIdempotencyKey('refund_internal_1'),
    );
    expect(buildRazorpayRefundIdempotencyKey('refund_internal_1')).not.toBe(
      buildRazorpayRefundIdempotencyKey('refund_internal_2'),
    );
    expect(() => buildRazorpayRefundIdempotencyKey('../refund')).toThrow(
      RazorpayRefundProviderInputError,
    );
    expect(
      buildRazorpayRefundRequestFingerprint({
        paymentId,
        amountMinor: 12_345,
        currency: 'inr',
        idempotencyKey,
      }),
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it('looks up provider truth before creating an exact-minor-unit refund', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(payment()))
      .mockResolvedValueOnce(response(refund({ status: 'pending' })));

    const result = await client(fetchImpl).createRefund({
      paymentId,
      amountMinor: 12_345,
      currency: 'INR',
      idempotencyKey,
      now: verifiedAt,
    });

    expect(result).toMatchObject({
      kind: 'accepted',
      refund: { id: refundId, amountMinor: 12_345, status: 'pending' },
      capturedPaymentProof: {
        paymentId,
        paymentAmountMinor: 50_000,
        alreadyRefundedAmountMinor: 0,
        verifiedAt,
      },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `https://razorpay.test/v1/payments/${paymentId}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://razorpay.test/v1/payments/${paymentId}/refund`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: 12_345 }),
        headers: expect.objectContaining({ 'X-Refund-Idempotency': idempotencyKey }),
      }),
    );
  });

  it.each([
    ['uncaptured payment', payment({ status: 'authorized', captured: false }), 'PAYMENT_NOT_CAPTURED'],
    ['exhausted balance', payment({ amount_refunded: 45_000 }), 'AMOUNT_EXCEEDS_CAPTURED_BALANCE'],
    ['currency mismatch', payment({ currency: 'USD' }), 'PAYMENT_MISMATCH'],
  ])('rejects %s without calling refund creation', async (_label, providerPayment, code) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(providerPayment));
    const result = await client(fetchImpl).createRefund({
      paymentId,
      amountMinor: 12_345,
      currency: 'INR',
      idempotencyKey,
      now: verifiedAt,
    });
    expect(result).toMatchObject({ kind: 'rejected', stage: 'payment_lookup', code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats an ambiguous create failure as uncertain and preserves captured proof', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(payment()))
      .mockRejectedValueOnce(new TypeError('connection reset'));

    const result = await client(fetchImpl).createRefund({
      paymentId,
      amountMinor: 12_345,
      currency: 'INR',
      idempotencyKey,
      now: verifiedAt,
    });

    expect(result).toMatchObject({
      kind: 'uncertain',
      stage: 'refund_create',
      reason: 'network',
      capturedPaymentProof: { paymentId, verifiedAt },
    });
  });

  it('does not accept a provider refund whose identity or amount differs', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(payment()))
      .mockResolvedValueOnce(response(refund({ amount: 12_344 })));
    const result = await client(fetchImpl).createRefund({
      paymentId,
      amountMinor: 12_345,
      currency: 'INR',
      idempotencyKey,
      now: verifiedAt,
    });
    expect(result).toMatchObject({
      kind: 'uncertain',
      stage: 'refund_create',
      reason: 'invalid_response',
    });
  });

  it('reconciles only an exact refund entity using the retained captured proof', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(refund()));
    const result = await client(fetchImpl).fetchRefund({
      refundId,
      paymentId,
      amountMinor: 12_345,
      currency: 'INR',
      capturedPaymentProof: {
        paymentId,
        paymentAmountMinor: 50_000,
        alreadyRefundedAmountMinor: 0,
        currency: 'INR',
        verifiedAt,
      },
    });
    expect(result).toMatchObject({ kind: 'accepted', refund: { id: refundId, status: 'processed' } });
  });

  it('accepts an exact processed webhook and rejects mismatched payment truth', () => {
    const payload = {
      event: 'refund.processed',
      payload: {
        refund: { entity: refund() },
        payment: { entity: payment() },
      },
    };
    const expected = { refundId, paymentId, amountMinor: 12_345, currency: 'INR' };

    expect(mapRazorpayRefundWebhook({ payload, expected })).toMatchObject({
      event: 'refund.processed',
      refund: { id: refundId, status: 'processed' },
    });
    expect(
      mapRazorpayRefundWebhook({
        payload: {
          ...payload,
          payload: { ...payload.payload, payment: { entity: payment({ id: 'pay_other_123' }) } },
        },
        expected,
      }),
    ).toBeNull();
  });
});

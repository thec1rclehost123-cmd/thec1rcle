import { createHash } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://api.razorpay.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const REFUND_IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

export interface CapturedPaymentProof {
  paymentId: string;
  paymentAmountMinor: number;
  alreadyRefundedAmountMinor: number;
  currency: string;
  verifiedAt: string;
}

export interface RazorpayRefundEntity {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
}

export type RazorpayRefundProviderOutcome =
  | {
      kind: 'accepted';
      refund: RazorpayRefundEntity;
      capturedPaymentProof: CapturedPaymentProof;
    }
  | {
      kind: 'uncertain';
      stage: 'payment_lookup' | 'refund_create' | 'refund_lookup';
      reason: 'network' | 'timeout' | 'retryable_http' | 'invalid_response';
      statusCode?: number;
      capturedPaymentProof?: CapturedPaymentProof;
      message: string;
    }
  | {
      kind: 'rejected';
      stage: 'payment_lookup' | 'refund_create' | 'refund_lookup';
      code:
        | 'PAYMENT_NOT_CAPTURED'
        | 'PAYMENT_MISMATCH'
        | 'AMOUNT_EXCEEDS_CAPTURED_BALANCE'
        | 'PROVIDER_REJECTED';
      statusCode?: number;
      capturedPaymentProof?: CapturedPaymentProof;
      message: string;
    };

export interface RazorpayRefundProviderClient {
  createRefund(input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    capturedPaymentProof?: CapturedPaymentProof;
    now?: Date | string;
  }): Promise<RazorpayRefundProviderOutcome>;
  fetchRefund(input: {
    refundId: string;
    paymentId: string;
    amountMinor: number;
    currency: string;
    capturedPaymentProof: CapturedPaymentProof;
  }): Promise<RazorpayRefundProviderOutcome>;
}

export class RazorpayRefundProviderInputError extends Error {
  readonly code = 'RAZORPAY_REFUND_PROVIDER_INVALID_INPUT';

  constructor(message: string) {
    super(message);
    this.name = 'RazorpayRefundProviderInputError';
  }
}

function invalid(message: string): never {
  throw new RazorpayRefundProviderInputError(message);
}

function identifier(value: unknown, field: string, prefix?: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized ||
    normalized.includes('/') ||
    Buffer.byteLength(normalized, 'utf8') > 256 ||
    (prefix && !normalized.startsWith(prefix))
  ) {
    return invalid(`${field} is invalid`);
  }
  return normalized;
}

function amountMinor(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    return invalid('amountMinor must be a positive safe integer');
  }
  return Number(value);
}

function currency(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(normalized)) return invalid('currency must be an ISO currency code');
  return normalized;
}

export function validateRazorpayRefundIdempotencyKey(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!REFUND_IDEMPOTENCY_PATTERN.test(normalized) || normalized.length > 256) {
    return invalid(
      'idempotencyKey must be at least 10 characters and contain only letters, numbers, hyphens, or underscores',
    );
  }
  return normalized;
}

export function buildRazorpayRefundIdempotencyKey(refundId: string): string {
  const normalized = identifier(refundId, 'refundId');
  return `refund_${createHash('sha256').update(normalized).digest('hex').slice(0, 40)}`;
}

export function buildRazorpayRefundRequestFingerprint(input: {
  paymentId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}): string {
  const normalized = {
    paymentId: identifier(input.paymentId, 'paymentId', 'pay_'),
    amount: amountMinor(input.amountMinor),
    currency: currency(input.currency),
    idempotencyKey: validateRazorpayRefundIdempotencyKey(input.idempotencyKey),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function normalizeNow(value?: Date | string): string {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return invalid('now must be a valid date');
  return date.toISOString();
}

function validateCapturedProof(
  proof: CapturedPaymentProof,
  expected: { paymentId: string; amountMinor: number; currency: string },
): CapturedPaymentProof {
  if (
    proof.paymentId !== expected.paymentId ||
    proof.currency !== expected.currency ||
    !Number.isSafeInteger(proof.paymentAmountMinor) ||
    proof.paymentAmountMinor <= 0 ||
    !Number.isSafeInteger(proof.alreadyRefundedAmountMinor) ||
    proof.alreadyRefundedAmountMinor < 0 ||
    proof.alreadyRefundedAmountMinor > proof.paymentAmountMinor ||
    expected.amountMinor > proof.paymentAmountMinor - proof.alreadyRefundedAmountMinor ||
    Number.isNaN(Date.parse(proof.verifiedAt))
  ) {
    return invalid('capturedPaymentProof does not match the refund request');
  }
  return proof;
}

function retryableStatus(status: number) {
  return status === 409 || status === 408 || status === 425 || status === 429 || status >= 500;
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

function providerMessage(payload: unknown, fallback: string) {
  const candidate = payload && typeof payload === 'object' ? (payload as any) : {};
  return String(candidate.error?.description || candidate.error?.reason || fallback).slice(0, 1_000);
}

function validateRefundEntity(
  payload: unknown,
  expected: { refundId?: string; paymentId: string; amountMinor: number; currency: string },
): RazorpayRefundEntity | null {
  const entity = payload && typeof payload === 'object' ? (payload as any) : null;
  if (
    !entity ||
    entity.entity !== 'refund' ||
    typeof entity.id !== 'string' ||
    !entity.id.startsWith('rfnd_') ||
    (expected.refundId && entity.id !== expected.refundId) ||
    entity.payment_id !== expected.paymentId ||
    entity.amount !== expected.amountMinor ||
    String(entity.currency || '').toUpperCase() !== expected.currency ||
    !['pending', 'processed', 'failed'].includes(entity.status)
  ) {
    return null;
  }
  return {
    id: entity.id,
    paymentId: entity.payment_id,
    amountMinor: entity.amount,
    currency: String(entity.currency).toUpperCase(),
    status: entity.status,
  };
}

export function createRazorpayRefundProviderClient(config: {
  keyId: string;
  keySecret: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}): RazorpayRefundProviderClient {
  const keyId = identifier(config.keyId, 'keyId');
  const keySecret = identifier(config.keySecret, 'keySecret');
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return invalid('fetch implementation is required');
  const baseUrl = String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeoutMs = Number(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    return invalid('timeoutMs is invalid');
  }
  const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  async function request(
    stage: RazorpayRefundProviderOutcome extends infer _T
      ? 'payment_lookup' | 'refund_create' | 'refund_lookup'
      : never,
    url: string,
    init: RequestInit,
  ): Promise<
    | { kind: 'response'; response: Response; payload: unknown }
    | Extract<RazorpayRefundProviderOutcome, { kind: 'uncertain' }>
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      let payload: unknown;
      try {
        payload = await responseJson(response);
      } catch {
        return {
          kind: 'uncertain',
          stage,
          reason: 'invalid_response',
          statusCode: response.status,
          message: 'Razorpay returned invalid JSON',
        };
      }
      if (!response.ok) {
        if (retryableStatus(response.status)) {
          return {
            kind: 'uncertain',
            stage,
            reason: 'retryable_http',
            statusCode: response.status,
            message: providerMessage(payload, `Razorpay returned ${response.status}`),
          };
        }
        return {
          kind: 'response',
          response,
          payload,
        };
      }
      return { kind: 'response', response, payload };
    } catch (error: any) {
      const timedOut = error?.name === 'AbortError';
      return {
        kind: 'uncertain',
        stage,
        reason: timedOut ? 'timeout' : 'network',
        message: timedOut ? 'Razorpay request timed out' : 'Razorpay network request failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchCapturedPayment(input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    now?: Date | string;
  }): Promise<CapturedPaymentProof | RazorpayRefundProviderOutcome> {
    const result = await request('payment_lookup', `${baseUrl}/v1/payments/${input.paymentId}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authorization },
    });
    if (result.kind === 'uncertain') return result;
    if (!result.response.ok) {
      return {
        kind: 'rejected',
        stage: 'payment_lookup',
        code: 'PROVIDER_REJECTED',
        statusCode: result.response.status,
        message: providerMessage(result.payload, 'Razorpay rejected payment lookup'),
      };
    }
    const payment = result.payload as any;
    if (payment?.id !== input.paymentId || payment?.entity !== 'payment') {
      return {
        kind: 'rejected',
        stage: 'payment_lookup',
        code: 'PAYMENT_MISMATCH',
        message: 'Razorpay payment identity does not match',
      };
    }
    if (payment.status !== 'captured' || payment.captured !== true) {
      return {
        kind: 'rejected',
        stage: 'payment_lookup',
        code: 'PAYMENT_NOT_CAPTURED',
        message: 'Only captured payments can be refunded',
      };
    }
    const paymentAmount = payment.amount;
    const alreadyRefunded = payment.amount_refunded ?? 0;
    if (
      !Number.isSafeInteger(paymentAmount) ||
      paymentAmount <= 0 ||
      !Number.isSafeInteger(alreadyRefunded) ||
      alreadyRefunded < 0 ||
      alreadyRefunded > paymentAmount ||
      String(payment.currency || '').toUpperCase() !== input.currency
    ) {
      return {
        kind: 'rejected',
        stage: 'payment_lookup',
        code: 'PAYMENT_MISMATCH',
        message: 'Razorpay payment amount or currency does not match',
      };
    }
    if (input.amountMinor > paymentAmount - alreadyRefunded) {
      return {
        kind: 'rejected',
        stage: 'payment_lookup',
        code: 'AMOUNT_EXCEEDS_CAPTURED_BALANCE',
        message: 'Refund amount exceeds the captured refundable balance',
      };
    }
    return {
      paymentId: input.paymentId,
      paymentAmountMinor: paymentAmount,
      alreadyRefundedAmountMinor: alreadyRefunded,
      currency: input.currency,
      verifiedAt: normalizeNow(input.now),
    };
  }

  return {
    async createRefund(input) {
      const normalized = {
        paymentId: identifier(input.paymentId, 'paymentId', 'pay_'),
        amountMinor: amountMinor(input.amountMinor),
        currency: currency(input.currency),
        idempotencyKey: validateRazorpayRefundIdempotencyKey(input.idempotencyKey),
      };
      let proof = input.capturedPaymentProof;
      if (proof) {
        proof = validateCapturedProof(proof, normalized);
      } else {
        const lookup = await fetchCapturedPayment({ ...normalized, now: input.now });
        if ('kind' in lookup) return lookup;
        proof = lookup;
      }

      const result = await request(
        'refund_create',
        `${baseUrl}/v1/payments/${normalized.paymentId}/refund`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: authorization,
            'Content-Type': 'application/json',
            'X-Refund-Idempotency': normalized.idempotencyKey,
          },
          body: JSON.stringify({ amount: normalized.amountMinor }),
        },
      );
      if (result.kind === 'uncertain') return { ...result, capturedPaymentProof: proof };
      if (!result.response.ok) {
        return {
          kind: 'rejected',
          stage: 'refund_create',
          code: 'PROVIDER_REJECTED',
          statusCode: result.response.status,
          capturedPaymentProof: proof,
          message: providerMessage(result.payload, 'Razorpay rejected refund creation'),
        };
      }
      const refund = validateRefundEntity(result.payload, normalized);
      if (!refund) {
        return {
          kind: 'uncertain',
          stage: 'refund_create',
          reason: 'invalid_response',
          capturedPaymentProof: proof,
          message: 'Razorpay refund response does not match the request',
        };
      }
      return { kind: 'accepted', refund, capturedPaymentProof: proof };
    },

    async fetchRefund(input) {
      const normalized = {
        refundId: identifier(input.refundId, 'refundId', 'rfnd_'),
        paymentId: identifier(input.paymentId, 'paymentId', 'pay_'),
        amountMinor: amountMinor(input.amountMinor),
        currency: currency(input.currency),
      };
      const proof = validateCapturedProof(input.capturedPaymentProof, normalized);
      const result = await request(
        'refund_lookup',
        `${baseUrl}/v1/refunds/${normalized.refundId}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: authorization },
        },
      );
      if (result.kind === 'uncertain') return { ...result, capturedPaymentProof: proof };
      if (!result.response.ok) {
        return {
          kind: 'rejected',
          stage: 'refund_lookup',
          code: 'PROVIDER_REJECTED',
          statusCode: result.response.status,
          capturedPaymentProof: proof,
          message: providerMessage(result.payload, 'Razorpay rejected refund lookup'),
        };
      }
      const refund = validateRefundEntity(result.payload, normalized);
      if (!refund) {
        return {
          kind: 'uncertain',
          stage: 'refund_lookup',
          reason: 'invalid_response',
          capturedPaymentProof: proof,
          message: 'Razorpay refund lookup does not match the request',
        };
      }
      return { kind: 'accepted', refund, capturedPaymentProof: proof };
    },
  };
}

export function mapRazorpayRefundWebhook(input: {
  payload: unknown;
  expected: {
    refundId: string;
    paymentId: string;
    amountMinor: number;
    currency: string;
  };
}): { event: 'refund.processed' | 'refund.failed'; refund: RazorpayRefundEntity } | null {
  const payload = input.payload && typeof input.payload === 'object' ? (input.payload as any) : null;
  if (!payload || !['refund.processed', 'refund.failed'].includes(payload.event)) return null;
  const expected = {
    refundId: identifier(input.expected.refundId, 'refundId', 'rfnd_'),
    paymentId: identifier(input.expected.paymentId, 'paymentId', 'pay_'),
    amountMinor: amountMinor(input.expected.amountMinor),
    currency: currency(input.expected.currency),
  };
  const refundPayload = payload.payload?.refund?.entity;
  const refund = validateRefundEntity(refundPayload, expected);
  if (!refund) return null;
  const expectedStatus = payload.event === 'refund.processed' ? 'processed' : 'failed';
  const payment = payload.payload?.payment?.entity;
  if (
    refund.status !== expectedStatus ||
    payment?.id !== expected.paymentId ||
    payment?.status !== 'captured' ||
    payment?.captured !== true
  ) {
    return null;
  }
  return { event: payload.event, refund };
}

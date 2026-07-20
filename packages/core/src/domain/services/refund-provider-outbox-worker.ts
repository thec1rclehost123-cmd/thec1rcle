import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { decideRefundTransition } from '../payment-refund-contract.js';
import {
  buildRazorpayRefundRequestFingerprint,
  validateRazorpayRefundIdempotencyKey,
  type CapturedPaymentProof,
  type RazorpayRefundProviderClient,
  type RazorpayRefundProviderOutcome,
} from './razorpay-refund-provider.js';

export const REFUND_PROVIDER_COLLECTIONS = Object.freeze({
  jobs: 'refund_provider_outbox',
  refunds: 'refund_requests',
  orders: 'orders',
  effects: 'refund_effects_outbox',
});

export const REFUND_PROVIDER_JOB_STATUS = Object.freeze({
  PENDING: 'pending',
  RETRY: 'retry',
  PROCESSING: 'processing',
  RECONCILIATION_PENDING: 'reconciliation_pending',
  PROCESSED: 'processed',
  DEAD_LETTER: 'dead_letter',
});

export interface RefundProviderWorkerPolicy {
  leaseDurationMs?: number;
  maxAttempts?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  reconciliationDelayMs?: number;
}

interface Policy {
  leaseDurationMs: number;
  maxAttempts: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  reconciliationDelayMs: number;
}

interface ClaimedJob {
  id: string;
  refundId: string;
  orderId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  requestFingerprint: string;
  providerRefundId?: string;
  capturedPaymentProof?: CapturedPaymentProof;
  mode: 'create' | 'reconcile';
  attempt: number;
  leaseOwner: string;
  leaseToken: string;
}

export type RefundProviderRunResult =
  | { status: 'processed'; jobId: string; providerRefundId: string; effectsJobId: string }
  | { status: 'provider_failed'; jobId: string; providerRefundId: string; orderRestored: boolean }
  | { status: 'reconciliation_scheduled'; jobId: string; availableAt: string }
  | { status: 'retry_scheduled'; jobId: string; availableAt: string; attempt: number }
  | { status: 'dead_lettered'; jobId: string; reason: string; attempt?: number }
  | { status: 'stale_completion'; jobId: string }
  | {
      status: 'not_run';
      jobId: string;
      reason: 'not_found' | 'already_processed' | 'already_dead_lettered' | 'active_lease' | 'not_due';
    };

const DEFAULT_POLICY: Policy = {
  leaseDurationMs: 60_000,
  maxAttempts: 8,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 5 * 60_000,
  reconciliationDelayMs: 15_000,
};

function integer(value: unknown, fallback: number, min: number, max: number) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new RangeError('Invalid refund provider worker policy');
  }
  return result;
}

function policy(value: RefundProviderWorkerPolicy = {}): Policy {
  const baseRetryDelayMs = integer(value.baseRetryDelayMs, DEFAULT_POLICY.baseRetryDelayMs, 100, 86_400_000);
  return {
    leaseDurationMs: integer(value.leaseDurationMs, DEFAULT_POLICY.leaseDurationMs, 1_000, 900_000),
    maxAttempts: integer(value.maxAttempts, DEFAULT_POLICY.maxAttempts, 1, 100),
    baseRetryDelayMs,
    maxRetryDelayMs: integer(value.maxRetryDelayMs, DEFAULT_POLICY.maxRetryDelayMs, baseRetryDelayMs, 604_800_000),
    reconciliationDelayMs: integer(value.reconciliationDelayMs, DEFAULT_POLICY.reconciliationDelayMs, 1_000, 86_400_000),
  };
}

function now(value?: Date | string) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new RangeError('now must be a valid date');
  return { iso: date.toISOString(), ms: date.getTime() };
}

function storedTime(value: unknown): number | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    const parsed = (value as any).toDate()?.getTime?.();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function id(value: unknown, field: string, prefix?: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.includes('/') || result.length > 256 || (prefix && !result.startsWith(prefix))) {
    throw new RangeError(`${field} is invalid`);
  }
  return result;
}

function validProof(value: unknown, expected: ClaimedJob): CapturedPaymentProof | undefined {
  if (value === undefined || value === null) return undefined;
  const proof = value as CapturedPaymentProof;
  if (
    proof.paymentId !== expected.paymentId ||
    proof.currency !== expected.currency ||
    !Number.isSafeInteger(proof.paymentAmountMinor) ||
    !Number.isSafeInteger(proof.alreadyRefundedAmountMinor) ||
    proof.alreadyRefundedAmountMinor < 0 ||
    expected.amountMinor > proof.paymentAmountMinor - proof.alreadyRefundedAmountMinor ||
    Number.isNaN(Date.parse(proof.verifiedAt))
  ) throw new RangeError('capturedPaymentProof is invalid');
  return proof;
}

function validateJob(jobId: string, data: any): Omit<ClaimedJob, 'attempt' | 'leaseOwner' | 'leaseToken'> {
  if (data.version !== 1 || data.type !== 'razorpay_refund_process') throw new RangeError('job version or type is invalid');
  const base = {
    id: jobId,
    refundId: id(data.refundId, 'refundId', 'refund_'),
    orderId: id(data.orderId, 'orderId'),
    paymentId: id(data.paymentId, 'paymentId', 'pay_'),
    amountMinor: Number(data.amountMinor ?? data.amountPaise),
    currency: String(data.currency || '').toUpperCase(),
    idempotencyKey: validateRazorpayRefundIdempotencyKey(data.providerIdempotencyKey),
    requestFingerprint: String(data.requestFingerprint || ''),
    providerRefundId: data.providerRefundId ? id(data.providerRefundId, 'providerRefundId', 'rfnd_') : undefined,
    mode: data.providerRefundId ? ('reconcile' as const) : ('create' as const),
  };
  if (!Number.isSafeInteger(base.amountMinor) || base.amountMinor <= 0 || !/^[A-Z]{3}$/.test(base.currency)) {
    throw new RangeError('job amount or currency is invalid');
  }
  const expected = buildRazorpayRefundRequestFingerprint({
    paymentId: base.paymentId,
    amountMinor: base.amountMinor,
    currency: base.currency,
    idempotencyKey: base.idempotencyKey,
  });
  if (base.requestFingerprint !== expected) throw new RangeError('requestFingerprint is invalid');
  const claimed = base as Omit<ClaimedJob, 'attempt' | 'leaseOwner' | 'leaseToken'>;
  claimed.capturedPaymentProof = validProof(data.capturedPaymentProof, claimed as ClaimedJob);
  if (claimed.mode === 'reconcile' && !claimed.capturedPaymentProof) throw new RangeError('reconciliation proof is missing');
  return claimed;
}

function deadLetter(transaction: any, ref: any, at: string, reason: string, details?: unknown) {
  transaction.update(ref, {
    status: REFUND_PROVIDER_JOB_STATUS.DEAD_LETTER,
    deadLetterReason: reason,
    deadLetteredAt: at,
    lastError: details || null,
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    updatedAt: at,
  });
}

async function claim(
  db: Firestore,
  input: { jobId: string; workerId: string; leaseToken: string; at: { iso: string; ms: number }; policy: Policy },
): Promise<{ kind: 'claimed'; job: ClaimedJob } | { kind: 'result'; result: RefundProviderRunResult }> {
  const jobRef = db.collection(REFUND_PROVIDER_COLLECTIONS.jobs).doc(input.jobId);
  return db.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    if (!jobDoc.exists) return { kind: 'result', result: { status: 'not_run', jobId: input.jobId, reason: 'not_found' } } as const;
    const data = jobDoc.data() as any;
    if (data.status === REFUND_PROVIDER_JOB_STATUS.PROCESSED) return { kind: 'result', result: { status: 'not_run', jobId: input.jobId, reason: 'already_processed' } } as const;
    if (data.status === REFUND_PROVIDER_JOB_STATUS.DEAD_LETTER) return { kind: 'result', result: { status: 'not_run', jobId: input.jobId, reason: 'already_dead_lettered' } } as const;
    let parsed: Omit<ClaimedJob, 'attempt' | 'leaseOwner' | 'leaseToken'>;
    try { parsed = validateJob(input.jobId, data); } catch (error) {
      deadLetter(transaction, jobRef, input.at.iso, 'malformed_job', { message: error instanceof Error ? error.message : 'invalid job' });
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'malformed_job' } } as const;
    }
    const status = String(data.status || '');
    const leaseExpiry = storedTime(data.leaseExpiresAt);
    if (status === REFUND_PROVIDER_JOB_STATUS.PROCESSING && leaseExpiry !== null && leaseExpiry > input.at.ms) {
      return { kind: 'result', result: { status: 'not_run', jobId: input.jobId, reason: 'active_lease' } } as const;
    }
    const claimable =
      status === REFUND_PROVIDER_JOB_STATUS.PENDING ||
      status === REFUND_PROVIDER_JOB_STATUS.RETRY ||
      status === REFUND_PROVIDER_JOB_STATUS.RECONCILIATION_PENDING ||
      (status === REFUND_PROVIDER_JOB_STATUS.PROCESSING &&
        leaseExpiry !== null &&
        leaseExpiry <= input.at.ms);
    if (!claimable) {
      deadLetter(transaction, jobRef, input.at.iso, 'malformed_job', { message: 'invalid job status' });
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'malformed_job' } } as const;
    }
    const availableAt = storedTime(data.availableAt);
    if (status !== REFUND_PROVIDER_JOB_STATUS.PROCESSING && availableAt !== null && availableAt > input.at.ms) {
      return { kind: 'result', result: { status: 'not_run', jobId: input.jobId, reason: 'not_due' } } as const;
    }
    const attempts = Number(data.attempts || 0);
    if (!Number.isSafeInteger(attempts) || attempts < 0) {
      deadLetter(transaction, jobRef, input.at.iso, 'malformed_job');
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'malformed_job' } } as const;
    }
    if (attempts >= input.policy.maxAttempts) {
      deadLetter(transaction, jobRef, input.at.iso, 'max_attempts_exhausted');
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'max_attempts_exhausted', attempt: attempts } } as const;
    }
    const refundRef = db.collection(REFUND_PROVIDER_COLLECTIONS.refunds).doc(parsed.refundId);
    const orderRef = db.collection(REFUND_PROVIDER_COLLECTIONS.orders).doc(parsed.orderId);
    const [refundDoc, orderDoc] = await Promise.all([transaction.get(refundRef), transaction.get(orderRef)]);
    const refund = refundDoc.data() as any;
    const order = orderDoc.data() as any;
    if (!refundDoc.exists || !orderDoc.exists || refund.providerOutboxJobId !== input.jobId || refund.orderId !== parsed.orderId || refund.amountPaise !== parsed.amountMinor || String(refund.paymentDetails?.originalPaymentId || '') !== parsed.paymentId || order.status !== 'refund_requested' || order.refundRequestId !== parsed.refundId) {
      deadLetter(transaction, jobRef, input.at.iso, 'aggregate_mismatch');
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'aggregate_mismatch' } } as const;
    }
    if (refund.status === 'approved') {
      const transition = decideRefundTransition('approved', 'processing');
      if (!transition.allowed) throw new Error('Refund transition contract rejected approved -> processing');
      transaction.update(refundRef, { status: transition.to, providerStatus: 'processing', providerStartedAt: input.at.iso, updatedAt: input.at.iso });
    } else if (refund.status !== 'processing') {
      deadLetter(transaction, jobRef, input.at.iso, 'refund_state_mismatch');
      return { kind: 'result', result: { status: 'dead_lettered', jobId: input.jobId, reason: 'refund_state_mismatch' } } as const;
    }
    const attempt = attempts + 1;
    transaction.update(jobRef, {
      status: REFUND_PROVIDER_JOB_STATUS.PROCESSING,
      attempts: attempt,
      leaseOwner: input.workerId,
      leaseToken: input.leaseToken,
      leaseAcquiredAt: input.at.iso,
      leaseExpiresAt: new Date(input.at.ms + input.policy.leaseDurationMs).toISOString(),
      updatedAt: input.at.iso,
    });
    return { kind: 'claimed', job: { ...parsed, attempt, leaseOwner: input.workerId, leaseToken: input.leaseToken } } as const;
  });
}

function exactLease(data: any, job: ClaimedJob) {
  return data?.status === REFUND_PROVIDER_JOB_STATUS.PROCESSING && data.leaseOwner === job.leaseOwner && data.leaseToken === job.leaseToken;
}

function retryDelay(attempt: number, config: Policy) {
  return Math.min(config.maxRetryDelayMs, config.baseRetryDelayMs * 2 ** Math.max(0, attempt - 1));
}

async function recordUncertain(db: Firestore, job: ClaimedJob, outcome: Extract<RazorpayRefundProviderOutcome, { kind: 'uncertain' }>, at: { iso: string; ms: number }, config: Policy): Promise<RefundProviderRunResult> {
  const ref = db.collection(REFUND_PROVIDER_COLLECTIONS.jobs).doc(job.id);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!exactLease(doc.data(), job)) return { status: 'stale_completion', jobId: job.id } as const;
    if (job.attempt >= config.maxAttempts) {
      deadLetter(transaction, ref, at.iso, 'provider_truth_unresolved', outcome);
      return { status: 'dead_lettered', jobId: job.id, reason: 'provider_truth_unresolved', attempt: job.attempt } as const;
    }
    const availableAt = new Date(at.ms + retryDelay(job.attempt, config)).toISOString();
    transaction.update(ref, { status: REFUND_PROVIDER_JOB_STATUS.RETRY, availableAt, capturedPaymentProof: outcome.capturedPaymentProof || job.capturedPaymentProof || null, lastError: outcome, leaseOwner: null, leaseToken: null, leaseExpiresAt: null, updatedAt: at.iso });
    return { status: 'retry_scheduled', jobId: job.id, availableAt, attempt: job.attempt } as const;
  });
}

async function recordRejected(db: Firestore, job: ClaimedJob, outcome: Extract<RazorpayRefundProviderOutcome, { kind: 'rejected' }>, at: { iso: string }): Promise<RefundProviderRunResult> {
  const ref = db.collection(REFUND_PROVIDER_COLLECTIONS.jobs).doc(job.id);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!exactLease(doc.data(), job)) return { status: 'stale_completion', jobId: job.id } as const;
    deadLetter(transaction, ref, at.iso, 'provider_rejected_or_invalid_truth', outcome);
    return { status: 'dead_lettered', jobId: job.id, reason: 'provider_rejected_or_invalid_truth', attempt: job.attempt } as const;
  });
}

async function recordAccepted(db: Firestore, job: ClaimedJob, outcome: Extract<RazorpayRefundProviderOutcome, { kind: 'accepted' }>, at: { iso: string; ms: number }, config: Policy): Promise<RefundProviderRunResult> {
  const jobRef = db.collection(REFUND_PROVIDER_COLLECTIONS.jobs).doc(job.id);
  const refundRef = db.collection(REFUND_PROVIDER_COLLECTIONS.refunds).doc(job.refundId);
  const orderRef = db.collection(REFUND_PROVIDER_COLLECTIONS.orders).doc(job.orderId);
  return db.runTransaction(async (transaction) => {
    const [jobDoc, refundDoc, orderDoc] = await Promise.all([transaction.get(jobRef), transaction.get(refundRef), transaction.get(orderRef)]);
    if (!exactLease(jobDoc.data(), job)) return { status: 'stale_completion', jobId: job.id } as const;
    const refund = refundDoc.data() as any;
    if (!refundDoc.exists || refund.status !== 'processing' || refund.providerOutboxJobId !== job.id) {
      deadLetter(transaction, jobRef, at.iso, 'refund_state_mismatch');
      return { status: 'dead_lettered', jobId: job.id, reason: 'refund_state_mismatch', attempt: job.attempt } as const;
    }
    const provider = outcome.refund;
    const common = { providerRefundId: provider.id, providerPaymentId: provider.paymentId, providerAmountMinor: provider.amountMinor, providerCurrency: provider.currency, providerStatus: provider.status, providerVerifiedAt: at.iso, updatedAt: at.iso };
    if (provider.status === 'pending') {
      const availableAt = new Date(at.ms + config.reconciliationDelayMs).toISOString();
      transaction.update(jobRef, { ...common, status: REFUND_PROVIDER_JOB_STATUS.RECONCILIATION_PENDING, availableAt, capturedPaymentProof: outcome.capturedPaymentProof, leaseOwner: null, leaseToken: null, leaseExpiresAt: null });
      transaction.update(refundRef, common);
      return { status: 'reconciliation_scheduled', jobId: job.id, availableAt } as const;
    }
    if (provider.status === 'processed') {
      const transition = decideRefundTransition('processing', 'processed');
      if (!transition.allowed) throw new Error('Refund transition contract rejected processing -> processed');
      const effectsJobId = `refund_effects_${job.refundId}`;
      const effectsRef = db.collection(REFUND_PROVIDER_COLLECTIONS.effects).doc(effectsJobId);
      const effectsDoc = await transaction.get(effectsRef);
      if (effectsDoc.exists) {
        const effects = effectsDoc.data() as any;
        if (effects.refundId !== job.refundId || effects.providerRefundId !== provider.id || effects.amountMinor !== job.amountMinor || effects.currency !== job.currency) {
          deadLetter(transaction, jobRef, at.iso, 'effects_job_conflict');
          return { status: 'dead_lettered', jobId: job.id, reason: 'effects_job_conflict', attempt: job.attempt } as const;
        }
      } else {
        transaction.set(effectsRef, { id: effectsJobId, version: 1, type: 'refund_processed_effects', status: 'pending', refundId: job.refundId, orderId: job.orderId, paymentId: job.paymentId, providerRefundId: provider.id, amountMinor: job.amountMinor, currency: job.currency, attempts: 0, availableAt: at.iso, createdAt: at.iso, updatedAt: at.iso });
      }
      transaction.update(refundRef, { ...common, status: transition.to, processedAt: at.iso, effectsOutboxJobId: effectsJobId });
      transaction.update(jobRef, { ...common, status: REFUND_PROVIDER_JOB_STATUS.PROCESSED, processedAt: at.iso, effectsOutboxJobId: effectsJobId, capturedPaymentProof: outcome.capturedPaymentProof, leaseOwner: null, leaseToken: null, leaseExpiresAt: null });
      return { status: 'processed', jobId: job.id, providerRefundId: provider.id, effectsJobId } as const;
    }
    const transition = decideRefundTransition('processing', 'failed');
    if (!transition.allowed) throw new Error('Refund transition contract rejected processing -> failed');
    const order = orderDoc.data() as any;
    const canRestore = orderDoc.exists && order.status === 'refund_requested' && order.refundRequestId === job.refundId && ['confirmed', 'checked_in'].includes(refund.orderStatusBeforeRequest);
    if (canRestore) transaction.update(orderRef, { status: refund.orderStatusBeforeRequest, refundRequestId: null, refundRequestVersion: null, refundRequestGeneration: null, updatedAt: at.iso });
    transaction.update(refundRef, { ...common, status: transition.to, failedAt: at.iso, orderRestoreConflict: !canRestore });
    transaction.update(jobRef, { ...common, status: REFUND_PROVIDER_JOB_STATUS.PROCESSED, processedAt: at.iso, capturedPaymentProof: outcome.capturedPaymentProof, orderRestored: canRestore, orderRestoreConflict: !canRestore, leaseOwner: null, leaseToken: null, leaseExpiresAt: null });
    return { status: 'provider_failed', jobId: job.id, providerRefundId: provider.id, orderRestored: canRestore } as const;
  });
}

export async function runRefundProviderOutboxJob(
  db: Firestore,
  provider: RazorpayRefundProviderClient,
  input: { jobId: string; workerId: string; leaseToken?: string; now?: Date | string; policy?: RefundProviderWorkerPolicy },
): Promise<RefundProviderRunResult> {
  const at = now(input.now);
  const config = policy(input.policy);
  const jobId = id(input.jobId, 'jobId');
  const workerId = id(input.workerId, 'workerId');
  const leaseToken = id(input.leaseToken || randomUUID(), 'leaseToken');
  const claimed = await claim(db, { jobId, workerId, leaseToken, at, policy: config });
  if (claimed.kind === 'result') return claimed.result;
  const job = claimed.job;
  const outcome = job.mode === 'reconcile'
    ? await provider.fetchRefund({ refundId: job.providerRefundId as string, paymentId: job.paymentId, amountMinor: job.amountMinor, currency: job.currency, capturedPaymentProof: job.capturedPaymentProof as CapturedPaymentProof })
    : await provider.createRefund({ paymentId: job.paymentId, amountMinor: job.amountMinor, currency: job.currency, idempotencyKey: job.idempotencyKey, capturedPaymentProof: job.capturedPaymentProof, now: at.iso });
  if (outcome.kind === 'uncertain') return recordUncertain(db, job, outcome, at, config);
  if (outcome.kind === 'rejected') return recordRejected(db, job, outcome, at);
  return recordAccepted(db, job, outcome, at, config);
}

export async function listDueRefundProviderJobIds(db: Firestore, input: { now?: Date | string; limit?: number } = {}) {
  const at = now(input.now);
  const limit = integer(input.limit, 50, 1, 500);
  const snapshots = await db.collection(REFUND_PROVIDER_COLLECTIONS.jobs).where('status', 'in', [REFUND_PROVIDER_JOB_STATUS.PENDING, REFUND_PROVIDER_JOB_STATUS.RETRY, REFUND_PROVIDER_JOB_STATUS.RECONCILIATION_PENDING]).get();
  return snapshots.docs
    .filter((doc) => {
      const due = storedTime(doc.data()?.availableAt);
      return due !== null && due <= at.ms;
    })
    .sort((a, b) => String(a.data()?.availableAt).localeCompare(String(b.data()?.availableAt)))
    .slice(0, limit)
    .map((doc) => doc.id);
}

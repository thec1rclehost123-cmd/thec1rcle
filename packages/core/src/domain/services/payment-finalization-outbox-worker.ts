import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { PAYMENT_FINALIZATION_COLLECTIONS } from './payment-finalization-service.js';

/**
 * Transactional worker primitives for payment finalization intents.
 *
 * The injected action handler is always invoked after the claim transaction
 * commits. This module does not fulfill tickets, mutate inventory, release
 * Redis reservations, notify users, or register a scheduler.
 */

export const PAYMENT_OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  RETRY: 'retry',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  DEAD_LETTER: 'dead_letter',
});

export interface PaymentOutboxWorkerPolicy {
  leaseDurationMs?: number;
  maxAttempts?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface PaymentOutboxJob {
  id: string;
  version: 1;
  finalizationId: string;
  orderClaimId: string;
  orderId: string;
  provider: 'razorpay';
  providerOrderId: string;
  providerPaymentId: string;
  providerTruth: string;
  amountMinor: number;
  currency: string;
  eventId: string | null;
  reservationId: string | null;
  userId: string | null;
  action: 'fulfill' | 'release';
  attempt: number;
  leaseOwner: string;
  leaseToken: string;
  leaseAcquiredAt: string;
  leaseExpiresAt: string;
}

export interface PaymentOutboxHandlerContext {
  job: PaymentOutboxJob;
  /**
   * Consumers must use this stable key for their own idempotency record. The
   * worker cannot guarantee exactly-once external effects.
   */
  idempotencyKey: string;
}

export type PaymentOutboxActionHandler = (context: PaymentOutboxHandlerContext) => Promise<void>;

interface NormalizedPolicy {
  leaseDurationMs: number;
  maxAttempts: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

interface WorkerIdentity {
  jobId: string;
  workerId: string;
  leaseToken: string;
  nowIso: string;
  nowMs: number;
}

export type PaymentOutboxClaimResult =
  | {
      status: 'claimed';
      job: PaymentOutboxJob;
      reclaimedExpiredLease: boolean;
    }
  | { status: 'not_found' }
  | { status: 'already_processed' }
  | { status: 'already_dead_lettered' }
  | {
      status: 'not_claimable';
      reason: 'active_lease' | 'not_due';
      retryAt: string | null;
    }
  | {
      status: 'dead_lettered';
      reason: 'malformed_job' | 'unknown_action' | 'max_attempts_exhausted';
    };

export type PaymentOutboxCompletionResult =
  | { status: 'processed' }
  | { status: 'already_processed' }
  | { status: 'dead_lettered'; reason: 'malformed_job' | 'unknown_action' }
  | { status: 'stale_lease' }
  | { status: 'not_found' };

export type PaymentOutboxFailureResult =
  | { status: 'retry_scheduled'; availableAt: string; attempt: number }
  | {
      status: 'dead_lettered';
      attempt: number;
      reason?: 'malformed_job' | 'unknown_action';
    }
  | { status: 'already_processed' }
  | { status: 'stale_lease' }
  | { status: 'not_found' };

export type PaymentOutboxRunResult =
  | { status: 'processed'; jobId: string }
  | { status: 'retry_scheduled'; jobId: string; availableAt: string; attempt: number }
  | { status: 'dead_lettered'; jobId: string; attempt?: number; reason?: string }
  | { status: 'stale_completion'; jobId: string }
  | {
      status: 'not_run';
      jobId: string;
      reason:
        | 'not_found'
        | 'already_processed'
        | 'already_dead_lettered'
        | 'active_lease'
        | 'not_due';
    };

export class PaymentOutboxWorkerError extends Error {
  readonly code: 'PAYMENT_OUTBOX_INVALID_INPUT';
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PaymentOutboxWorkerError';
    this.code = 'PAYMENT_OUTBOX_INVALID_INPUT';
    this.details = Object.freeze({ ...details });
  }
}

const DEFAULT_POLICY: NormalizedPolicy = Object.freeze({
  leaseDurationMs: 60_000,
  maxAttempts: 5,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 5 * 60_000,
});

const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(PAYMENT_OUTBOX_STATUS));
const KNOWN_ACTIONS = new Set(['fulfill', 'release']);

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new PaymentOutboxWorkerError(message, details);
}

function identifier(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.includes('/') || Buffer.byteLength(normalized, 'utf8') > 256) {
    return invalid(`${field} must be a non-empty identifier without slashes`, { field });
  }
  return normalized;
}

function documentIdentifier(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.includes('/') || Buffer.byteLength(normalized, 'utf8') > 1_500) {
    return invalid(`${field} must be a valid Firestore document id`, { field });
  }
  return normalized;
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    return invalid(`${field} must be an integer between ${minimum} and ${maximum}`, {
      field,
      value,
    });
  }
  return number;
}

function normalizePolicy(policy: PaymentOutboxWorkerPolicy = {}): NormalizedPolicy {
  const leaseDurationMs = boundedInteger(
    policy.leaseDurationMs ?? DEFAULT_POLICY.leaseDurationMs,
    'leaseDurationMs',
    1_000,
    15 * 60_000,
  );
  const maxAttempts = boundedInteger(
    policy.maxAttempts ?? DEFAULT_POLICY.maxAttempts,
    'maxAttempts',
    1,
    100,
  );
  const baseRetryDelayMs = boundedInteger(
    policy.baseRetryDelayMs ?? DEFAULT_POLICY.baseRetryDelayMs,
    'baseRetryDelayMs',
    100,
    24 * 60 * 60_000,
  );
  const maxRetryDelayMs = boundedInteger(
    policy.maxRetryDelayMs ?? DEFAULT_POLICY.maxRetryDelayMs,
    'maxRetryDelayMs',
    baseRetryDelayMs,
    7 * 24 * 60 * 60_000,
  );
  return { leaseDurationMs, maxAttempts, baseRetryDelayMs, maxRetryDelayMs };
}

function normalizeNow(value?: Date | string): { nowIso: string; nowMs: number } {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const nowMs = date.getTime();
  if (Number.isNaN(nowMs)) return invalid('now must be a valid date');
  return { nowIso: date.toISOString(), nowMs };
}

function parseStoredTime(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
    }
  }
  return null;
}

function optionalStoredIdentifier(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.includes('/') || Buffer.byteLength(normalized, 'utf8') > 256) {
    return undefined;
  }
  return normalized;
}

function validateJob(
  data: Record<string, unknown>,
  jobId: string,
):
  | {
      valid: true;
      action: PaymentOutboxJob['action'];
      status: string;
      attempts: number;
      availableAtMs: number | null;
      leaseExpiresAtMs: number | null;
    }
  | { valid: false; reason: 'malformed_job' | 'unknown_action'; issues: string[] } {
  const issues: string[] = [];
  const action = typeof data.action === 'string' ? data.action : '';
  if (!KNOWN_ACTIONS.has(action)) {
    return { valid: false, reason: 'unknown_action', issues: ['action'] };
  }
  if (data.version !== 1) issues.push('version');
  for (const field of [
    'finalizationId',
    'orderClaimId',
    'orderId',
    'providerOrderId',
    'providerPaymentId',
  ]) {
    if (optionalStoredIdentifier(data[field]) === undefined || data[field] === null) {
      issues.push(field);
    }
  }
  for (const field of ['eventId', 'reservationId', 'userId']) {
    if (
      data[field] !== null &&
      data[field] !== undefined &&
      optionalStoredIdentifier(data[field]) === undefined
    ) {
      issues.push(field);
    }
  }
  if (data.provider !== 'razorpay') issues.push('provider');
  if (!Number.isSafeInteger(data.amountMinor) || Number(data.amountMinor) <= 0) {
    issues.push('amountMinor');
  }
  if (typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)) {
    issues.push('currency');
  }
  const truth = typeof data.providerTruth === 'string' ? data.providerTruth : '';
  if (
    (action === 'fulfill' && truth !== 'captured' && truth !== 'order_paid') ||
    (action === 'release' && truth !== 'failed' && truth !== 'expired')
  ) {
    issues.push('providerTruth');
  }

  const providerOrderId = optionalStoredIdentifier(data.providerOrderId);
  const providerPaymentId = optionalStoredIdentifier(data.providerPaymentId);
  if (providerOrderId && providerPaymentId) {
    const expectedFinalizationId = `payment-finalization:razorpay:${encodeURIComponent(providerOrderId)}:${encodeURIComponent(providerPaymentId)}`;
    const expectedOrderClaimId = `payment-order-claim:razorpay:${encodeURIComponent(providerOrderId)}`;
    if (data.finalizationId !== expectedFinalizationId) issues.push('finalizationId');
    if (data.orderClaimId !== expectedOrderClaimId) issues.push('orderClaimId');
    if (jobId !== `${expectedFinalizationId}:intent:${action}`) issues.push('jobId');
  }
  const status = typeof data.status === 'string' ? data.status : '';
  if (!KNOWN_STATUSES.has(status)) issues.push('status');
  const attempts = Number(data.attempts);
  if (!Number.isSafeInteger(attempts) || attempts < 0) issues.push('attempts');

  const availableAtMs = parseStoredTime(data.availableAt);
  if ((status === 'pending' || status === 'retry') && availableAtMs === null) {
    issues.push('availableAt');
  }
  const leaseExpiresAtMs = parseStoredTime(data.leaseExpiresAt);
  if (status === 'processing') {
    if (!optionalStoredIdentifier(data.leaseOwner)) issues.push('leaseOwner');
    if (!optionalStoredIdentifier(data.leaseToken)) issues.push('leaseToken');
    if (leaseExpiresAtMs === null) issues.push('leaseExpiresAt');
  }
  if (status === 'processed') {
    if (!optionalStoredIdentifier(data.processedBy)) issues.push('processedBy');
    if (!optionalStoredIdentifier(data.processedLeaseToken)) issues.push('processedLeaseToken');
    if (parseStoredTime(data.processedAt) === null) issues.push('processedAt');
  }

  if (issues.length > 0) return { valid: false, reason: 'malformed_job', issues };
  return {
    valid: true,
    action: action as PaymentOutboxJob['action'],
    status,
    attempts,
    availableAtMs,
    leaseExpiresAtMs,
  };
}

function errorMetadata(error: unknown, recordedAt: string) {
  const candidate = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Handler failed';
  const rawName = error instanceof Error ? error.name : 'Error';
  const rawCode = candidate.code;
  return {
    name: String(rawName || 'Error').slice(0, 100),
    message: String(rawMessage || 'Handler failed').slice(0, 1_000),
    code:
      typeof rawCode === 'string' || typeof rawCode === 'number'
        ? String(rawCode).slice(0, 100)
        : null,
    retryable: candidate.retryable !== false,
    recordedAt,
  };
}

function malformedError(reason: 'malformed_job' | 'unknown_action', issues: string[], at: string) {
  return {
    name: 'PaymentOutboxValidationError',
    message:
      reason === 'unknown_action'
        ? 'Payment finalization outbox action is unknown'
        : 'Payment finalization outbox job is malformed',
    code: reason === 'unknown_action' ? 'UNKNOWN_ACTION' : 'MALFORMED_JOB',
    retryable: false,
    fields: issues.slice(0, 25),
    recordedAt: at,
  };
}

function malformedDeadLetterUpdates(
  validation: Extract<ReturnType<typeof validateJob>, { valid: false }>,
  at: string,
) {
  return {
    status: PAYMENT_OUTBOX_STATUS.DEAD_LETTER,
    deadLetterReason: validation.reason,
    deadLetteredAt: at,
    lastError: malformedError(validation.reason, validation.issues, at),
    leaseOwner: null,
    leaseToken: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    updatedAt: at,
  };
}

function workerIdentity(input: {
  jobId: string;
  workerId: string;
  leaseToken?: string;
  now?: Date | string;
}): WorkerIdentity {
  const { nowIso, nowMs } = normalizeNow(input.now);
  return {
    jobId: documentIdentifier(input.jobId, 'jobId'),
    workerId: identifier(input.workerId, 'workerId'),
    leaseToken: identifier(input.leaseToken || randomUUID(), 'leaseToken'),
    nowIso,
    nowMs,
  };
}

function jobReference(db: Firestore, jobId: string) {
  return db.collection(PAYMENT_FINALIZATION_COLLECTIONS.outbox).doc(jobId);
}

function toClaimedJob(
  id: string,
  data: Record<string, unknown>,
  action: PaymentOutboxJob['action'],
  attempt: number,
  identity: WorkerIdentity,
  leaseExpiresAt: string,
): PaymentOutboxJob {
  return {
    id,
    version: 1,
    finalizationId: String(data.finalizationId),
    orderClaimId: String(data.orderClaimId),
    orderId: String(data.orderId),
    provider: 'razorpay',
    providerOrderId: String(data.providerOrderId),
    providerPaymentId: String(data.providerPaymentId),
    providerTruth: String(data.providerTruth || ''),
    amountMinor: Number(data.amountMinor),
    currency: String(data.currency),
    eventId: optionalStoredIdentifier(data.eventId) ?? null,
    reservationId: optionalStoredIdentifier(data.reservationId) ?? null,
    userId: optionalStoredIdentifier(data.userId) ?? null,
    action,
    attempt,
    leaseOwner: identity.workerId,
    leaseToken: identity.leaseToken,
    leaseAcquiredAt: identity.nowIso,
    leaseExpiresAt,
  };
}

/** Transactionally claims one specific candidate job. */
export async function claimPaymentOutboxJob(
  db: Firestore,
  input: {
    jobId: string;
    workerId: string;
    leaseToken?: string;
    now?: Date | string;
    policy?: PaymentOutboxWorkerPolicy;
  },
): Promise<PaymentOutboxClaimResult> {
  const identity = workerIdentity(input);
  const policy = normalizePolicy(input.policy);
  const ref = jobReference(db, identity.jobId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { status: 'not_found' } as const;
    const data = (snapshot.data() || {}) as Record<string, unknown>;

    if (data.status === PAYMENT_OUTBOX_STATUS.DEAD_LETTER) {
      return { status: 'already_dead_lettered' } as const;
    }

    const validation = validateJob(data, identity.jobId);
    if (!validation.valid) {
      transaction.update(ref, malformedDeadLetterUpdates(validation, identity.nowIso));
      return { status: 'dead_lettered', reason: validation.reason } as const;
    }

    if (validation.status === PAYMENT_OUTBOX_STATUS.PROCESSED) {
      return { status: 'already_processed' } as const;
    }

    const processing = validation.status === PAYMENT_OUTBOX_STATUS.PROCESSING;
    const leaseExpired =
      processing &&
      validation.leaseExpiresAtMs !== null &&
      validation.leaseExpiresAtMs <= identity.nowMs;
    if (processing && !leaseExpired) {
      return {
        status: 'not_claimable',
        reason: 'active_lease',
        retryAt: new Date(validation.leaseExpiresAtMs as number).toISOString(),
      } as const;
    }
    if (
      !processing &&
      validation.availableAtMs !== null &&
      validation.availableAtMs > identity.nowMs
    ) {
      return {
        status: 'not_claimable',
        reason: 'not_due',
        retryAt: new Date(validation.availableAtMs).toISOString(),
      } as const;
    }
    if (validation.attempts >= policy.maxAttempts) {
      transaction.update(ref, {
        status: PAYMENT_OUTBOX_STATUS.DEAD_LETTER,
        deadLetterReason: 'max_attempts_exhausted',
        deadLetteredAt: identity.nowIso,
        lastError: {
          name: 'PaymentOutboxAttemptsExhausted',
          message: 'Payment finalization outbox maximum attempts were exhausted',
          code: 'MAX_ATTEMPTS_EXHAUSTED',
          retryable: false,
          recordedAt: identity.nowIso,
        },
        leaseOwner: null,
        leaseToken: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        updatedAt: identity.nowIso,
      });
      return { status: 'dead_lettered', reason: 'max_attempts_exhausted' } as const;
    }

    const attempt = validation.attempts + 1;
    const leaseExpiresAt = new Date(identity.nowMs + policy.leaseDurationMs).toISOString();
    transaction.update(ref, {
      status: PAYMENT_OUTBOX_STATUS.PROCESSING,
      attempts: attempt,
      leaseOwner: identity.workerId,
      leaseToken: identity.leaseToken,
      leaseAcquiredAt: identity.nowIso,
      leaseExpiresAt,
      updatedAt: identity.nowIso,
    });

    return {
      status: 'claimed',
      job: toClaimedJob(identity.jobId, data, validation.action, attempt, identity, leaseExpiresAt),
      reclaimedExpiredLease: leaseExpired,
    } as const;
  });
}

function completionIdentity(input: {
  jobId: string;
  workerId: string;
  leaseToken: string;
  now?: Date | string;
}) {
  const { nowIso, nowMs } = normalizeNow(input.now);
  return {
    jobId: documentIdentifier(input.jobId, 'jobId'),
    workerId: identifier(input.workerId, 'workerId'),
    leaseToken: identifier(input.leaseToken, 'leaseToken'),
    nowIso,
    nowMs,
  };
}

function leaseStillOwned(
  data: Record<string, unknown>,
  identity: ReturnType<typeof completionIdentity>,
): boolean {
  const expiresAt = parseStoredTime(data.leaseExpiresAt);
  return (
    data.status === PAYMENT_OUTBOX_STATUS.PROCESSING &&
    data.leaseOwner === identity.workerId &&
    data.leaseToken === identity.leaseToken &&
    expiresAt !== null &&
    expiresAt > identity.nowMs
  );
}

/** Marks success only while the exact worker lease is still current. */
export async function completePaymentOutboxJob(
  db: Firestore,
  input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    now?: Date | string;
  },
): Promise<PaymentOutboxCompletionResult> {
  const identity = completionIdentity(input);
  const ref = jobReference(db, identity.jobId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { status: 'not_found' } as const;
    const data = (snapshot.data() || {}) as Record<string, unknown>;
    if (data.status === PAYMENT_OUTBOX_STATUS.PROCESSED) {
      const validation = validateJob(data, identity.jobId);
      if (!validation.valid) {
        transaction.update(ref, malformedDeadLetterUpdates(validation, identity.nowIso));
        return { status: 'dead_lettered', reason: validation.reason } as const;
      }
      return data.processedBy === identity.workerId &&
        data.processedLeaseToken === identity.leaseToken
        ? ({ status: 'already_processed' } as const)
        : ({ status: 'stale_lease' } as const);
    }
    if (!leaseStillOwned(data, identity)) return { status: 'stale_lease' } as const;

    const validation = validateJob(data, identity.jobId);
    if (!validation.valid) {
      transaction.update(ref, malformedDeadLetterUpdates(validation, identity.nowIso));
      return { status: 'dead_lettered', reason: validation.reason } as const;
    }

    transaction.update(ref, {
      status: PAYMENT_OUTBOX_STATUS.PROCESSED,
      processedAt: identity.nowIso,
      processedBy: identity.workerId,
      processedLeaseToken: identity.leaseToken,
      leaseOwner: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      leaseExpiresAt: null,
      updatedAt: identity.nowIso,
    });
    return { status: 'processed' } as const;
  });
}

function retryDelayMs(attempt: number, policy: NormalizedPolicy): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 30));
  return Math.min(policy.maxRetryDelayMs, policy.baseRetryDelayMs * 2 ** exponent);
}

/** Schedules retry/dead-letter only while the exact worker lease is current. */
export async function failPaymentOutboxJob(
  db: Firestore,
  input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    error: unknown;
    now?: Date | string;
    policy?: PaymentOutboxWorkerPolicy;
  },
): Promise<PaymentOutboxFailureResult> {
  const identity = completionIdentity(input);
  const policy = normalizePolicy(input.policy);
  const ref = jobReference(db, identity.jobId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { status: 'not_found' } as const;
    const data = (snapshot.data() || {}) as Record<string, unknown>;
    if (data.status === PAYMENT_OUTBOX_STATUS.PROCESSED) {
      const validation = validateJob(data, identity.jobId);
      if (!validation.valid) {
        transaction.update(ref, malformedDeadLetterUpdates(validation, identity.nowIso));
        return { status: 'dead_lettered', attempt: 0, reason: validation.reason } as const;
      }
      return data.processedBy === identity.workerId &&
        data.processedLeaseToken === identity.leaseToken
        ? ({ status: 'already_processed' } as const)
        : ({ status: 'stale_lease' } as const);
    }
    if (!leaseStillOwned(data, identity)) return { status: 'stale_lease' } as const;

    const validation = validateJob(data, identity.jobId);
    if (!validation.valid) {
      transaction.update(ref, malformedDeadLetterUpdates(validation, identity.nowIso));
      return { status: 'dead_lettered', attempt: 0, reason: validation.reason } as const;
    }

    const attempt = Number(data.attempts);
    const metadata = errorMetadata(input.error, identity.nowIso);
    if (!Number.isSafeInteger(attempt) || attempt <= 0) {
      transaction.update(ref, {
        status: PAYMENT_OUTBOX_STATUS.DEAD_LETTER,
        deadLetterReason: 'malformed_job',
        deadLetteredAt: identity.nowIso,
        lastError: malformedError('malformed_job', ['attempts'], identity.nowIso),
        leaseOwner: null,
        leaseToken: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        updatedAt: identity.nowIso,
      });
      return { status: 'dead_lettered', attempt: 0 } as const;
    }

    if (!metadata.retryable || attempt >= policy.maxAttempts) {
      transaction.update(ref, {
        status: PAYMENT_OUTBOX_STATUS.DEAD_LETTER,
        deadLetterReason: metadata.retryable ? 'max_attempts_exhausted' : 'non_retryable_error',
        deadLetteredAt: identity.nowIso,
        lastError: metadata,
        leaseOwner: null,
        leaseToken: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        updatedAt: identity.nowIso,
      });
      return { status: 'dead_lettered', attempt } as const;
    }

    const availableAt = new Date(identity.nowMs + retryDelayMs(attempt, policy)).toISOString();
    transaction.update(ref, {
      status: PAYMENT_OUTBOX_STATUS.RETRY,
      availableAt,
      lastError: metadata,
      leaseOwner: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      leaseExpiresAt: null,
      updatedAt: identity.nowIso,
    });
    return { status: 'retry_scheduled', availableAt, attempt } as const;
  });
}

/**
 * Claims, executes, and records one job. Handler execution is deliberately
 * outside every Firestore transaction.
 */
export async function runPaymentOutboxJob(
  db: Firestore,
  input: {
    jobId: string;
    workerId: string;
    handler: PaymentOutboxActionHandler;
    leaseToken?: string;
    now?: Date | string;
    /** Separate post-handler clock value; defaults to actual completion time. */
    completionNow?: Date | string;
    policy?: PaymentOutboxWorkerPolicy;
  },
): Promise<PaymentOutboxRunResult> {
  if (typeof input.handler !== 'function') return invalid('handler must be a function');
  const claim = await claimPaymentOutboxJob(db, input);
  if (claim.status === 'dead_lettered') {
    return { status: 'dead_lettered', jobId: input.jobId, reason: claim.reason };
  }
  if (claim.status !== 'claimed') {
    return {
      status: 'not_run',
      jobId: input.jobId,
      reason:
        claim.status === 'not_claimable'
          ? claim.reason
          : claim.status === 'not_found'
            ? 'not_found'
            : claim.status === 'already_processed'
              ? 'already_processed'
              : 'already_dead_lettered',
    };
  }

  try {
    await input.handler({ job: claim.job, idempotencyKey: claim.job.id });
    const completionNow = input.completionNow ?? new Date();
    const completion = await completePaymentOutboxJob(db, {
      jobId: claim.job.id,
      workerId: claim.job.leaseOwner,
      leaseToken: claim.job.leaseToken,
      now: completionNow,
    });
    if (completion.status === 'processed' || completion.status === 'already_processed') {
      return { status: 'processed', jobId: claim.job.id };
    }
    if (completion.status === 'dead_lettered') {
      return {
        status: 'dead_lettered',
        jobId: claim.job.id,
        reason: completion.reason,
      };
    }
    return { status: 'stale_completion', jobId: claim.job.id };
  } catch (error) {
    const completionNow = input.completionNow ?? new Date();
    const failure = await failPaymentOutboxJob(db, {
      jobId: claim.job.id,
      workerId: claim.job.leaseOwner,
      leaseToken: claim.job.leaseToken,
      error,
      now: completionNow,
      policy: input.policy,
    });
    if (failure.status === 'retry_scheduled') {
      return {
        status: 'retry_scheduled',
        jobId: claim.job.id,
        availableAt: failure.availableAt,
        attempt: failure.attempt,
      };
    }
    if (failure.status === 'dead_lettered') {
      const result: PaymentOutboxRunResult = {
        status: 'dead_lettered',
        jobId: claim.job.id,
        attempt: failure.attempt,
      };
      if (failure.reason) result.reason = failure.reason;
      return result;
    }
    if (failure.status === 'already_processed') {
      return { status: 'processed', jobId: claim.job.id };
    }
    return { status: 'stale_completion', jobId: claim.job.id };
  }
}

/**
 * Read-only discovery seam. Transactional claim remains authoritative when
 * multiple workers discover the same candidate.
 */
export async function listDuePaymentOutboxJobIds(
  db: Firestore,
  input: { now?: Date | string; limit?: number } = {},
): Promise<string[]> {
  const { nowIso } = normalizeNow(input.now);
  const limit = boundedInteger(input.limit ?? 10, 'limit', 1, 100);
  const collection = db.collection(PAYMENT_FINALIZATION_COLLECTIONS.outbox);
  const dueQuery = collection
    .where('status', 'in', [PAYMENT_OUTBOX_STATUS.PENDING, PAYMENT_OUTBOX_STATUS.RETRY])
    .where('availableAt', '<=', nowIso)
    .orderBy('availableAt', 'asc')
    .limit(limit);
  const expiredLeaseQuery = collection
    .where('status', '==', PAYMENT_OUTBOX_STATUS.PROCESSING)
    .where('leaseExpiresAt', '<=', nowIso)
    .orderBy('leaseExpiresAt', 'asc')
    .limit(limit);
  const [due, expired] = await Promise.all([dueQuery.get(), expiredLeaseQuery.get()]);
  const candidates = [
    ...due.docs.map((document) => ({
      id: document.id,
      dueAt: parseStoredTime(document.data().availableAt) ?? Number.POSITIVE_INFINITY,
    })),
    ...expired.docs.map((document) => ({
      id: document.id,
      dueAt: parseStoredTime(document.data().leaseExpiresAt) ?? Number.POSITIVE_INFINITY,
    })),
  ].sort((left, right) => left.dueAt - right.dueAt || left.id.localeCompare(right.id));
  return [...new Set(candidates.map((candidate) => candidate.id))].slice(0, limit);
}

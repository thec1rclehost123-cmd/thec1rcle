import { describe, expect, it, vi } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { PAYMENT_FINALIZATION_COLLECTIONS } from './src/domain/services/payment-finalization-service.js';
import {
  claimPaymentOutboxJob,
  completePaymentOutboxJob,
  failPaymentOutboxJob,
  listDuePaymentOutboxJobIds,
  runPaymentOutboxJob,
} from './src/domain/services/payment-finalization-outbox-worker.js';

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

interface QueryState {
  path: string;
  filters: Array<{ field: string; operator: string; value: unknown }>;
  orderField: string | null;
  limit: number | null;
}

function buildHarness(initial: Record<string, Record<string, unknown>> = {}) {
  const documents = new Map(Object.entries(initial).map(([path, value]) => [path, clone(value)]));
  const writes: Array<{ type: 'update'; path: string; data: Record<string, unknown> }> = [];
  let transactionQueue: Promise<unknown> = Promise.resolve();
  let transactionDepth = 0;

  function docRef(path: string) {
    return { path, id: path.split('/').at(-1) };
  }

  function queryRef(state: QueryState): any {
    return {
      where(field: string, operator: string, value: unknown) {
        return queryRef({
          ...state,
          filters: [...state.filters, { field, operator, value }],
        });
      },
      orderBy(field: string) {
        return queryRef({ ...state, orderField: field });
      },
      limit(limit: number) {
        return queryRef({ ...state, limit });
      },
      async get() {
        const prefix = `${state.path}/`;
        const candidates = [...documents.entries()]
          .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .filter(([, data]) =>
            state.filters.every(({ field, operator, value }) => {
              if (operator === '==') return data[field] === value;
              if (operator === 'in') return (value as unknown[]).includes(data[field]);
              if (operator === '<=') return String(data[field]) <= String(value);
              throw new Error(`Unsupported operator: ${operator}`);
            }),
          )
          .sort((left, right) => {
            if (!state.orderField) return 0;
            return String(left[1][state.orderField]).localeCompare(
              String(right[1][state.orderField]),
            );
          })
          .slice(0, state.limit ?? undefined)
          .map(([path, data]) => ({
            id: path.split('/').at(-1),
            ref: docRef(path),
            data: () => clone(data),
          }));
        return { docs: candidates, empty: candidates.length === 0, size: candidates.length };
      },
    };
  }

  function collectionRef(path: string) {
    return {
      doc: (id: string) => docRef(`${path}/${id}`),
      ...queryRef({ path, filters: [], orderField: null, limit: null }),
    };
  }

  const transaction = {
    async get(ref: { path: string; id: string }) {
      const value = documents.get(ref.path);
      return {
        exists: value !== undefined,
        id: ref.id,
        ref,
        data: () => clone(value),
      };
    },
    update(ref: { path: string }, data: Record<string, unknown>) {
      const existing = documents.get(ref.path);
      if (!existing) throw new Error(`Document does not exist: ${ref.path}`);
      documents.set(ref.path, { ...clone(existing), ...clone(data) });
      writes.push({ type: 'update', path: ref.path, data: clone(data) });
      return this;
    },
  };

  const db = {
    collection: (name: string) => collectionRef(name),
    runTransaction<T>(work: (transaction: Transaction) => Promise<T>) {
      const pending = transactionQueue.then(
        async () => {
          transactionDepth += 1;
          try {
            return await work(transaction as unknown as Transaction);
          } finally {
            transactionDepth -= 1;
          }
        },
        async () => {
          transactionDepth += 1;
          try {
            return await work(transaction as unknown as Transaction);
          } finally {
            transactionDepth -= 1;
          }
        },
      );
      transactionQueue = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
  };

  return {
    db: db as unknown as Firestore,
    writes,
    get inTransaction() {
      return transactionDepth > 0;
    },
    read(path: string) {
      return clone(documents.get(path));
    },
    set(path: string, data: Record<string, unknown>) {
      documents.set(path, clone(data));
    },
  };
}

const now = '2026-07-18T12:00:00.000Z';
const jobId = 'payment-finalization:razorpay:order_1:pay_1:intent:fulfill';
const outboxPath = `${PAYMENT_FINALIZATION_COLLECTIONS.outbox}/${jobId}`;
const releaseJobId = 'payment-finalization:razorpay:order_1:pay_1:intent:release';
const releaseOutboxPath = `${PAYMENT_FINALIZATION_COLLECTIONS.outbox}/${releaseJobId}`;

function pendingJob(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    finalizationId: 'payment-finalization:razorpay:order_1:pay_1',
    orderClaimId: 'payment-order-claim:razorpay:order_1',
    orderId: 'internal-order-1',
    provider: 'razorpay',
    providerOrderId: 'order_1',
    providerPaymentId: 'pay_1',
    providerTruth: 'captured',
    amountMinor: 149_900,
    currency: 'INR',
    eventId: 'event-1',
    reservationId: 'reservation-1',
    userId: 'user-1',
    action: 'fulfill',
    status: 'pending',
    attempts: 0,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const policy = {
  leaseDurationMs: 10_000,
  maxAttempts: 3,
  baseRetryDelayMs: 1_000,
  maxRetryDelayMs: 1_500,
};

describe('payment finalization outbox claim', () => {
  it('claims a due pending job with an owner, unique lease, expiry, and incremented attempt', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });

    const result = await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      now,
      policy,
    });

    expect(result).toMatchObject({
      status: 'claimed',
      reclaimedExpiredLease: false,
      job: {
        id: jobId,
        action: 'fulfill',
        attempt: 1,
        leaseOwner: 'worker-a',
        leaseToken: 'lease-a',
        leaseExpiresAt: '2026-07-18T12:00:10.000Z',
      },
    });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'processing',
      attempts: 1,
      leaseOwner: 'worker-a',
      leaseToken: 'lease-a',
    });
  });

  it('serializes concurrent claims so only one worker owns the live lease', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });

    const [first, second] = await Promise.all([
      claimPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-a',
        leaseToken: 'lease-a',
        now,
        policy,
      }),
      claimPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-b',
        leaseToken: 'lease-b',
        now,
        policy,
      }),
    ]);

    expect(first).toMatchObject({ status: 'claimed' });
    expect(second).toEqual({
      status: 'not_claimable',
      reason: 'active_lease',
      retryAt: '2026-07-18T12:00:10.000Z',
    });
    expect(harness.writes).toHaveLength(1);
  });

  it('reclaims an expired lease and increments the attempt without trusting its old owner', async () => {
    const harness = buildHarness({
      [outboxPath]: pendingJob({
        status: 'processing',
        attempts: 1,
        leaseOwner: 'worker-old',
        leaseToken: 'lease-old',
        leaseAcquiredAt: '2026-07-18T11:59:40.000Z',
        leaseExpiresAt: '2026-07-18T11:59:50.000Z',
      }),
    });

    const result = await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-new',
      leaseToken: 'lease-new',
      now,
      policy,
    });

    expect(result).toMatchObject({
      status: 'claimed',
      reclaimedExpiredLease: true,
      job: { attempt: 2, leaseOwner: 'worker-new', leaseToken: 'lease-new' },
    });
  });

  it('claims a semantically valid verified-failure release intent', async () => {
    const harness = buildHarness({
      [releaseOutboxPath]: pendingJob({ action: 'release', providerTruth: 'failed' }),
    });

    const result = await claimPaymentOutboxJob(harness.db, {
      jobId: releaseJobId,
      workerId: 'worker-release',
      leaseToken: 'lease-release',
      now,
      policy,
    });

    expect(result).toMatchObject({
      status: 'claimed',
      job: { action: 'release', providerTruth: 'failed' },
    });
  });

  it('does not claim a future retry and dead-letters an exhausted abandoned lease', async () => {
    const futureHarness = buildHarness({
      [outboxPath]: pendingJob({
        status: 'retry',
        attempts: 1,
        availableAt: '2026-07-18T12:01:00.000Z',
      }),
    });
    expect(
      await claimPaymentOutboxJob(futureHarness.db, {
        jobId,
        workerId: 'worker-a',
        leaseToken: 'lease-a',
        now,
        policy,
      }),
    ).toEqual({
      status: 'not_claimable',
      reason: 'not_due',
      retryAt: '2026-07-18T12:01:00.000Z',
    });

    const exhaustedHarness = buildHarness({
      [outboxPath]: pendingJob({
        status: 'processing',
        attempts: 3,
        leaseOwner: 'worker-old',
        leaseToken: 'lease-old',
        leaseAcquiredAt: '2026-07-18T11:59:40.000Z',
        leaseExpiresAt: '2026-07-18T11:59:50.000Z',
      }),
    });
    expect(
      await claimPaymentOutboxJob(exhaustedHarness.db, {
        jobId,
        workerId: 'worker-new',
        leaseToken: 'lease-new',
        now,
        policy,
      }),
    ).toEqual({ status: 'dead_lettered', reason: 'max_attempts_exhausted' });
    expect(exhaustedHarness.read(outboxPath)).toMatchObject({
      status: 'dead_letter',
      deadLetterReason: 'max_attempts_exhausted',
      leaseOwner: null,
    });
  });
});

describe('payment finalization outbox completion ownership', () => {
  it('marks processed only for the same unexpired lease and makes its exact replay a no-op', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      now,
      policy,
    });
    const processed = await completePaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      now: '2026-07-18T12:00:01.000Z',
    });
    const writesAfterCompletion = harness.writes.length;
    const replay = await completePaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      now: '2026-07-18T12:00:02.000Z',
    });

    expect(processed).toEqual({ status: 'processed' });
    expect(replay).toEqual({ status: 'already_processed' });
    expect(harness.writes).toHaveLength(writesAfterCompletion);
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'processed',
      processedBy: 'worker-a',
      processedLeaseToken: 'lease-a',
      leaseOwner: null,
    });
  });

  it('prevents stale completion and failure from overwriting a reclaimed lease', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-old',
      leaseToken: 'lease-old',
      now: '2026-07-18T12:00:00.000Z',
      policy,
    });
    await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-new',
      leaseToken: 'lease-new',
      now: '2026-07-18T12:00:11.000Z',
      policy,
    });
    const writesBeforeStaleWorker = harness.writes.length;

    expect(
      await completePaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-old',
        leaseToken: 'lease-old',
        now: '2026-07-18T12:00:12.000Z',
      }),
    ).toEqual({ status: 'stale_lease' });
    expect(
      await failPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-old',
        leaseToken: 'lease-old',
        error: new Error('late failure'),
        now: '2026-07-18T12:00:12.000Z',
        policy,
      }),
    ).toEqual({ status: 'stale_lease' });
    expect(harness.writes).toHaveLength(writesBeforeStaleWorker);
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'processing',
      leaseOwner: 'worker-new',
      leaseToken: 'lease-new',
    });
  });
});

describe('payment finalization outbox failure policy', () => {
  it('uses bounded exponential retry and dead-letters after the configured maximum attempt', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });

    const expectedRetryTimes = ['2026-07-18T12:00:01.000Z', '2026-07-18T12:00:02.500Z'];
    const claimTimes = [now, expectedRetryTimes[0], expectedRetryTimes[1]];
    for (let index = 0; index < 3; index += 1) {
      const attempt = index + 1;
      const claim = await claimPaymentOutboxJob(harness.db, {
        jobId,
        workerId: `worker-${attempt}`,
        leaseToken: `lease-${attempt}`,
        now: claimTimes[index],
        policy,
      });
      expect(claim).toMatchObject({ status: 'claimed', job: { attempt } });

      const error = Object.assign(new Error(`temporary failure ${attempt}`), {
        code: 'TEMPORARY',
      });
      const failure = await failPaymentOutboxJob(harness.db, {
        jobId,
        workerId: `worker-${attempt}`,
        leaseToken: `lease-${attempt}`,
        error,
        now: claimTimes[index],
        policy,
      });
      if (attempt < 3) {
        expect(failure).toEqual({
          status: 'retry_scheduled',
          availableAt: expectedRetryTimes[index],
          attempt,
        });
      } else {
        expect(failure).toEqual({ status: 'dead_lettered', attempt: 3 });
      }
    }

    expect(harness.read(outboxPath)).toMatchObject({
      status: 'dead_letter',
      deadLetterReason: 'max_attempts_exhausted',
      lastError: {
        name: 'Error',
        message: 'temporary failure 3',
        code: 'TEMPORARY',
        retryable: true,
      },
    });
  });

  it('dead-letters a non-retryable handler error immediately with bounded metadata', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    await claimPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      now,
      policy,
    });
    const error = Object.assign(new Error('permanent contract failure'), {
      code: 'INVALID_FULFILLMENT',
      retryable: false,
    });

    expect(
      await failPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-a',
        leaseToken: 'lease-a',
        error,
        now,
        policy,
      }),
    ).toEqual({ status: 'dead_lettered', attempt: 1 });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'dead_letter',
      deadLetterReason: 'non_retryable_error',
      lastError: { code: 'INVALID_FULFILLMENT', retryable: false },
    });
  });
});

describe('payment finalization outbox runner and validation', () => {
  it('runs the injected handler outside the claim transaction and records success afterward', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    const handler = vi.fn(async ({ job, idempotencyKey }) => {
      expect(harness.inTransaction).toBe(false);
      expect(job.action).toBe('fulfill');
      expect(idempotencyKey).toBe(jobId);
    });

    const result = await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      handler,
      now,
      completionNow: '2026-07-18T12:00:01.000Z',
      policy,
    });

    expect(result).toEqual({ status: 'processed', jobId });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(harness.read(outboxPath)).toMatchObject({ status: 'processed' });
  });

  it('does not invoke the handler again for an exactly processed job', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    const handler = vi.fn(async () => undefined);
    await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      handler,
      now,
      completionNow: '2026-07-18T12:00:01.000Z',
      policy,
    });
    const writesAfterFirstRun = harness.writes.length;

    const replay = await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-b',
      leaseToken: 'lease-b',
      handler,
      now: '2026-07-18T12:01:00.000Z',
      policy,
    });

    expect(replay).toEqual({ status: 'not_run', jobId, reason: 'already_processed' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(harness.writes).toHaveLength(writesAfterFirstRun);
  });

  it('schedules handler failures through the same bounded retry transaction', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });
    const handler = vi.fn(async () => {
      expect(harness.inTransaction).toBe(false);
      throw Object.assign(new Error('temporary ticket service failure'), { code: 'TEMPORARY' });
    });

    const result = await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      handler,
      now,
      completionNow: now,
      policy,
    });

    expect(result).toEqual({
      status: 'retry_scheduled',
      jobId,
      availableAt: '2026-07-18T12:00:01.000Z',
      attempt: 1,
    });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'retry',
      leaseOwner: null,
      lastError: { code: 'TEMPORARY' },
    });
  });

  it('rejects completion after lease expiry instead of trusting a long-running handler', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });

    const result = await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-slow',
      leaseToken: 'lease-slow',
      handler: async () => undefined,
      now,
      completionNow: '2026-07-18T12:00:11.000Z',
      policy,
    });

    expect(result).toEqual({ status: 'stale_completion', jobId });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'processing',
      leaseOwner: 'worker-slow',
      leaseToken: 'lease-slow',
    });
  });

  it('dead-letters a job mutated to an unknown action before completion', async () => {
    const harness = buildHarness({ [outboxPath]: pendingJob() });

    const result = await runPaymentOutboxJob(harness.db, {
      jobId,
      workerId: 'worker-a',
      leaseToken: 'lease-a',
      handler: async () => {
        const leased = harness.read(outboxPath) as Record<string, unknown>;
        harness.set(outboxPath, { ...leased, action: 'charge_card' });
      },
      now,
      completionNow: '2026-07-18T12:00:01.000Z',
      policy,
    });

    expect(result).toEqual({ status: 'dead_lettered', jobId, reason: 'unknown_action' });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'dead_letter',
      deadLetterReason: 'unknown_action',
    });
  });

  it.each([
    ['unknown_action', { action: 'charge_card' }],
    ['malformed_job', { amountMinor: -1 }],
  ] as const)(
    'fails closed and dead-letters %s before handler execution',
    async (reason, override) => {
      const harness = buildHarness({ [outboxPath]: pendingJob(override) });
      const handler = vi.fn(async () => undefined);

      const result = await runPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-a',
        leaseToken: 'lease-a',
        handler,
        now,
        policy,
      });

      expect(result).toEqual({ status: 'dead_lettered', jobId, reason });
      expect(handler).not.toHaveBeenCalled();
      expect(harness.read(outboxPath)).toMatchObject({
        status: 'dead_letter',
        deadLetterReason: reason,
        lastError: { retryable: false },
      });
    },
  );

  it.each([
    ['truth/action mismatch', { action: 'release', providerTruth: 'captured' }],
    ['unknown status', { status: 'ready_now' }],
  ])('dead-letters a malformed semantic contract: %s', async (_label, override) => {
    const harness = buildHarness({ [outboxPath]: pendingJob(override) });

    expect(
      await claimPaymentOutboxJob(harness.db, {
        jobId,
        workerId: 'worker-a',
        leaseToken: 'lease-a',
        now,
        policy,
      }),
    ).toEqual({ status: 'dead_lettered', reason: 'malformed_job' });
    expect(harness.read(outboxPath)).toMatchObject({
      status: 'dead_letter',
      deadLetterReason: 'malformed_job',
    });
  });
});

describe('payment finalization outbox discovery seam', () => {
  it('lists due pending/retry jobs and expired leases without returning future or active work', async () => {
    const collection = PAYMENT_FINALIZATION_COLLECTIONS.outbox;
    const harness = buildHarness({
      [`${collection}/due-pending`]: pendingJob({ availableAt: '2026-07-18T11:59:00.000Z' }),
      [`${collection}/due-retry`]: pendingJob({
        status: 'retry',
        attempts: 1,
        availableAt: '2026-07-18T11:59:30.000Z',
      }),
      [`${collection}/future-retry`]: pendingJob({
        status: 'retry',
        attempts: 1,
        availableAt: '2026-07-18T12:01:00.000Z',
      }),
      [`${collection}/expired-lease`]: pendingJob({
        status: 'processing',
        attempts: 1,
        leaseOwner: 'old-worker',
        leaseToken: 'old-lease',
        leaseAcquiredAt: '2026-07-18T11:58:00.000Z',
        leaseExpiresAt: '2026-07-18T11:58:00.000Z',
      }),
      [`${collection}/active-lease`]: pendingJob({
        status: 'processing',
        attempts: 1,
        leaseOwner: 'active-worker',
        leaseToken: 'active-lease',
        leaseAcquiredAt: '2026-07-18T11:59:59.000Z',
        leaseExpiresAt: '2026-07-18T12:01:00.000Z',
      }),
    });

    const oldest = await listDuePaymentOutboxJobIds(harness.db, { now, limit: 1 });
    const ids = await listDuePaymentOutboxJobIds(harness.db, { now, limit: 10 });

    expect(oldest).toEqual(['expired-lease']);
    expect(new Set(ids)).toEqual(new Set(['due-pending', 'due-retry', 'expired-lease']));
  });
});

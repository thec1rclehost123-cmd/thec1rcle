import { describe, expect, it, vi } from 'vitest';
import {
  REFUND_PROVIDER_COLLECTIONS,
  REFUND_PROVIDER_JOB_STATUS,
  runRefundProviderOutboxJob,
  type RefundProviderRunResult,
} from './refund-provider-outbox-worker.js';
import {
  buildRazorpayRefundRequestFingerprint,
  type CapturedPaymentProof,
  type RazorpayRefundProviderClient,
  type RazorpayRefundProviderOutcome,
} from './razorpay-refund-provider.js';

const now = '2026-07-19T12:00:00.000Z';
const jobId = 'job_refund_1';
const refundId = 'refund_internal_1';
const orderId = 'order_internal_1';
const paymentId = 'pay_test_123456';
const amountMinor = 12_345;
const currency = 'INR';
const idempotencyKey = 'refund_test_123456';

type StoredDocs = Record<string, Record<string, any>>;

class FakeDocumentRef {
  constructor(
    readonly collectionName: string,
    readonly id: string,
    private readonly store: StoredDocs,
  ) {}

  snapshot() {
    const data = this.store[this.collectionName]?.[this.id];
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => data,
    };
  }
}

class FakeFirestore {
  constructor(readonly docs: StoredDocs) {}

  collection(name: string) {
    return {
      doc: (id: string) => new FakeDocumentRef(name, id, this.docs),
    };
  }

  async runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
    const transaction = {
      get: async (ref: FakeDocumentRef) => ref.snapshot(),
      update: (ref: FakeDocumentRef, updates: Record<string, any>) => {
        const collection = (this.docs[ref.collectionName] ??= {});
        if (!collection[ref.id]) throw new Error(`Missing document ${ref.collectionName}/${ref.id}`);
        collection[ref.id] = { ...collection[ref.id], ...updates };
      },
      set: (ref: FakeDocumentRef, value: Record<string, any>) => {
        const collection = (this.docs[ref.collectionName] ??= {});
        collection[ref.id] = { ...value };
      },
    };
    return callback(transaction);
  }
}

const proof: CapturedPaymentProof = {
  paymentId,
  paymentAmountMinor: 50_000,
  alreadyRefundedAmountMinor: 0,
  currency,
  verifiedAt: now,
};

function validJob(overrides: Record<string, any> = {}) {
  return {
    version: 1,
    type: 'razorpay_refund_process',
    status: REFUND_PROVIDER_JOB_STATUS.PENDING,
    refundId,
    orderId,
    paymentId,
    amountMinor,
    currency,
    providerIdempotencyKey: idempotencyKey,
    requestFingerprint: buildRazorpayRefundRequestFingerprint({
      paymentId,
      amountMinor,
      currency,
      idempotencyKey,
    }),
    attempts: 0,
    availableAt: now,
    ...overrides,
  };
}

function aggregate(jobOverrides: Record<string, any> = {}): StoredDocs {
  return {
    [REFUND_PROVIDER_COLLECTIONS.jobs]: { [jobId]: validJob(jobOverrides) },
    [REFUND_PROVIDER_COLLECTIONS.refunds]: {
      [refundId]: {
        id: refundId,
        status: 'approved',
        orderId,
        amountPaise: amountMinor,
        providerOutboxJobId: jobId,
        paymentDetails: { originalPaymentId: paymentId },
        orderStatusBeforeRequest: 'confirmed',
      },
    },
    [REFUND_PROVIDER_COLLECTIONS.orders]: {
      [orderId]: { id: orderId, status: 'refund_requested', refundRequestId: refundId },
    },
    [REFUND_PROVIDER_COLLECTIONS.effects]: {},
  };
}

function accepted(status: 'pending' | 'processed' | 'failed'): RazorpayRefundProviderOutcome {
  return {
    kind: 'accepted',
    refund: { id: 'rfnd_test_123456', paymentId, amountMinor, currency, status },
    capturedPaymentProof: proof,
  };
}

function provider(outcome: RazorpayRefundProviderOutcome): RazorpayRefundProviderClient {
  return {
    createRefund: vi.fn(async () => outcome),
    fetchRefund: vi.fn(async () => outcome),
  };
}

async function run(
  db: FakeFirestore,
  refundProvider: RazorpayRefundProviderClient,
  overrides: Record<string, any> = {},
): Promise<RefundProviderRunResult> {
  return runRefundProviderOutboxJob(db as any, refundProvider, {
    jobId,
    workerId: 'refund-worker-1',
    leaseToken: 'lease_token_123456',
    now,
    policy: {
      leaseDurationMs: 60_000,
      maxAttempts: 3,
      baseRetryDelayMs: 1_000,
      maxRetryDelayMs: 8_000,
      reconciliationDelayMs: 15_000,
    },
    ...overrides,
  });
}

describe('refund provider outbox worker', () => {
  it('dead-letters malformed jobs before any provider call', async () => {
    const docs = aggregate({ requestFingerprint: 'attacker-controlled' });
    const db = new FakeFirestore(docs);
    const refundProvider = provider(accepted('processed'));

    await expect(run(db, refundProvider)).resolves.toEqual({
      status: 'dead_lettered',
      jobId,
      reason: 'malformed_job',
    });
    expect(refundProvider.createRefund).not.toHaveBeenCalled();
    expect(docs[REFUND_PROVIDER_COLLECTIONS.jobs][jobId]).toMatchObject({
      status: REFUND_PROVIDER_JOB_STATUS.DEAD_LETTER,
      deadLetterReason: 'malformed_job',
      leaseToken: null,
    });
  });

  it('does not steal an active lease', async () => {
    const docs = aggregate({
      status: REFUND_PROVIDER_JOB_STATUS.PROCESSING,
      leaseOwner: 'other-worker',
      leaseToken: 'other_lease_token',
      leaseExpiresAt: '2026-07-19T12:01:00.000Z',
    });
    const refundProvider = provider(accepted('processed'));

    await expect(run(new FakeFirestore(docs), refundProvider)).resolves.toEqual({
      status: 'not_run',
      jobId,
      reason: 'active_lease',
    });
    expect(refundProvider.createRefund).not.toHaveBeenCalled();
  });

  it('schedules an exponential retry for ambiguous provider truth and releases the lease', async () => {
    const docs = aggregate();
    const refundProvider = provider({
      kind: 'uncertain',
      stage: 'refund_create',
      reason: 'network',
      capturedPaymentProof: proof,
      message: 'connection reset',
    });

    await expect(run(new FakeFirestore(docs), refundProvider)).resolves.toMatchObject({
      status: 'retry_scheduled',
      jobId,
      attempt: 1,
      availableAt: '2026-07-19T12:00:01.000Z',
    });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.jobs][jobId]).toMatchObject({
      status: REFUND_PROVIDER_JOB_STATUS.RETRY,
      attempts: 1,
      leaseOwner: null,
      leaseToken: null,
      capturedPaymentProof: proof,
    });
  });

  it('moves a pending provider refund into reconciliation without issuing a second create', async () => {
    const docs = aggregate();
    const refundProvider = provider(accepted('pending'));

    await expect(run(new FakeFirestore(docs), refundProvider)).resolves.toEqual({
      status: 'reconciliation_scheduled',
      jobId,
      availableAt: '2026-07-19T12:00:15.000Z',
    });
    expect(refundProvider.createRefund).toHaveBeenCalledTimes(1);
    expect(docs[REFUND_PROVIDER_COLLECTIONS.jobs][jobId]).toMatchObject({
      status: REFUND_PROVIDER_JOB_STATUS.RECONCILIATION_PENDING,
      providerRefundId: 'rfnd_test_123456',
      capturedPaymentProof: proof,
      leaseToken: null,
    });
  });

  it('atomically records a processed refund and one deterministic effects job', async () => {
    const docs = aggregate();
    const refundProvider = provider(accepted('processed'));

    await expect(run(new FakeFirestore(docs), refundProvider)).resolves.toEqual({
      status: 'processed',
      jobId,
      providerRefundId: 'rfnd_test_123456',
      effectsJobId: `refund_effects_${refundId}`,
    });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.refunds][refundId]).toMatchObject({
      status: 'processed',
      providerRefundId: 'rfnd_test_123456',
      effectsOutboxJobId: `refund_effects_${refundId}`,
    });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.effects][`refund_effects_${refundId}`]).toMatchObject({
      type: 'refund_processed_effects',
      status: 'pending',
      refundId,
      amountMinor,
      currency,
    });
  });

  it('restores the prior order state only for a confirmed provider failure', async () => {
    const docs = aggregate();
    await expect(run(new FakeFirestore(docs), provider(accepted('failed')))).resolves.toEqual({
      status: 'provider_failed',
      jobId,
      providerRefundId: 'rfnd_test_123456',
      orderRestored: true,
    });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.orders][orderId]).toMatchObject({
      status: 'confirmed',
      refundRequestId: null,
    });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.refunds][refundId]).toMatchObject({
      status: 'failed',
      orderRestoreConflict: false,
    });
  });

  it('rejects a completion whose exact lease was replaced while the provider was running', async () => {
    const docs = aggregate();
    const db = new FakeFirestore(docs);
    const refundProvider: RazorpayRefundProviderClient = {
      createRefund: vi.fn(async () => {
        docs[REFUND_PROVIDER_COLLECTIONS.jobs][jobId].leaseToken = 'replacement_lease_token';
        return accepted('processed');
      }),
      fetchRefund: vi.fn(async () => accepted('processed')),
    };

    await expect(run(db, refundProvider)).resolves.toEqual({ status: 'stale_completion', jobId });
    expect(docs[REFUND_PROVIDER_COLLECTIONS.refunds][refundId].status).toBe('processing');
    expect(docs[REFUND_PROVIDER_COLLECTIONS.effects]).toEqual({});
  });
});

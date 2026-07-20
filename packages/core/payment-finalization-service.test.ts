import { describe, expect, it } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  PAYMENT_FINALIZATION_COLLECTIONS,
  applyPaymentFinalizationInTransaction,
  finalizePaymentTruth,
  type PaymentFinalizationInput,
} from './src/domain/services/payment-finalization-service.js';

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function buildHarness(
  initial: Record<string, Record<string, unknown>> = {},
  options: { serializeTransactions?: boolean } = {},
) {
  const documents = new Map(Object.entries(initial).map(([path, value]) => [path, clone(value)]));
  const writes: Array<{ type: 'create' | 'update'; path: string; data: unknown }> = [];

  function docRef(path: string) {
    return { path, id: path.split('/').at(-1) };
  }

  function collectionRef(path: string) {
    return { doc: (id: string) => docRef(`${path}/${id}`) };
  }

  const transaction = {
    async get(ref: { path: string }) {
      const value = documents.get(ref.path);
      return {
        exists: value !== undefined,
        id: ref.id,
        ref,
        data: () => clone(value),
      };
    },
    create(ref: { path: string }, data: Record<string, unknown>) {
      if (documents.has(ref.path)) throw new Error(`Document already exists: ${ref.path}`);
      documents.set(ref.path, clone(data));
      writes.push({ type: 'create', path: ref.path, data: clone(data) });
      return this;
    },
    update(ref: { path: string }, data: Record<string, unknown>) {
      const existing = documents.get(ref.path);
      if (!existing) throw new Error(`Document does not exist: ${ref.path}`);
      documents.set(ref.path, { ...clone(existing), ...clone(data) });
      writes.push({ type: 'update', path: ref.path, data: clone(data) });
      return this;
    },
  };

  let transactionQueue: Promise<unknown> = Promise.resolve();
  const runTransaction = async <T>(work: (tx: Transaction) => Promise<T>) => {
    if (!options.serializeTransactions) return work(transaction as unknown as Transaction);
    const pending = transactionQueue.then(
      () => work(transaction as unknown as Transaction),
      () => work(transaction as unknown as Transaction),
    );
    transactionQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  const db = {
    collection: (name: string) => collectionRef(name),
    runTransaction,
  };

  return {
    db: db as unknown as Firestore,
    transaction: transaction as unknown as Transaction,
    writes,
    read(path: string) {
      return clone(documents.get(path));
    },
    remove(path: string) {
      documents.delete(path);
    },
  };
}

const now = '2026-07-18T12:00:00.000Z';
const baseInput: PaymentFinalizationInput = {
  source: 'app_callback',
  provider: 'razorpay',
  providerOrderId: 'order_live_1',
  providerPaymentId: 'pay_live_1',
  providerTruth: 'captured',
  providerTruthVerified: true,
  orderId: 'internal-order-1',
  amountMinor: 149_900,
  currency: 'inr',
  eventId: 'event-1',
  reservationId: 'reservation-1',
  userId: 'user-1',
  now,
};

const finalizationId = 'payment-finalization:razorpay:order_live_1:pay_live_1';
const claimId = 'payment-order-claim:razorpay:order_live_1';
const fulfillOutboxId = `${finalizationId}:intent:fulfill`;
const releaseOutboxId = `${finalizationId}:intent:release`;

function path(collection: string, id: string) {
  return `${collection}/${id}`;
}

describe('unified payment finalization transaction', () => {
  it('atomically creates the order claim, captured finalization, and one fulfillment intent', async () => {
    const harness = buildHarness();

    const result = await finalizePaymentTruth(harness.db, baseInput);

    expect(result).toEqual({
      finalizationId,
      orderClaimId: claimId,
      webhookEventLedgerId: null,
      outboxId: fulfillOutboxId,
      action: 'fulfill',
      reason: 'paid_provider_truth',
      requiresReconciliation: false,
      replayed: false,
      eventReplayed: false,
      eventClaimed: false,
      outboxCreated: true,
    });
    expect(
      harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.finalizations, finalizationId)),
    ).toMatchObject({
      version: 1,
      finalizationId,
      orderClaimId: claimId,
      providerTruth: 'captured',
      providerTruthVerified: true,
      intentAction: 'fulfill',
    });
    expect(harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.orderClaims, claimId))).toMatchObject(
      {
        settledAction: 'fulfill',
        settledByFinalizationId: finalizationId,
        amountMinor: 149_900,
        currency: 'INR',
      },
    );
    expect(
      harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId)),
    ).toMatchObject({
      status: 'pending',
      attempts: 0,
      action: 'fulfill',
      orderId: 'internal-order-1',
      providerPaymentId: 'pay_live_1',
    });
    expect(harness.writes.map((write) => write.type)).toEqual(['create', 'create', 'create']);
  });

  it('converges callback, webhook, and reconciler without creating another fulfillment intent', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, baseInput);

    const webhook = await finalizePaymentTruth(harness.db, {
      ...baseInput,
      source: 'webhook',
      providerEventId: 'event_razorpay_1',
    });
    const writesAfterWebhook = harness.writes.length;
    const reconciler = await finalizePaymentTruth(harness.db, {
      ...baseInput,
      source: 'reconciler',
    });

    expect(webhook).toMatchObject({
      finalizationId,
      action: 'fulfill',
      replayed: true,
      eventClaimed: true,
      outboxCreated: false,
    });
    expect(reconciler).toMatchObject({ replayed: true, outboxCreated: false });
    expect(harness.writes).toHaveLength(writesAfterWebhook);
    expect(
      harness.writes.filter(
        (write) => write.path === path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId),
      ),
    ).toHaveLength(1);
    expect(
      harness.read(
        path(
          PAYMENT_FINALIZATION_COLLECTIONS.webhookEvents,
          'razorpay-webhook-event:event_razorpay_1',
        ),
      ),
    ).toMatchObject({
      providerEventId: 'event_razorpay_1',
      finalizationId,
      source: 'webhook',
    });
  });

  it('makes an exact webhook event replay a zero-write no-op', async () => {
    const harness = buildHarness();
    const input: PaymentFinalizationInput = {
      ...baseInput,
      source: 'webhook',
      providerEventId: 'event_razorpay_exact',
    };
    await finalizePaymentTruth(harness.db, input);
    const writesAfterFirst = harness.writes.length;

    const replay = await finalizePaymentTruth(harness.db, input);

    expect(replay).toMatchObject({
      replayed: true,
      eventReplayed: true,
      eventClaimed: false,
      outboxCreated: false,
    });
    expect(harness.writes).toHaveLength(writesAfterFirst);
  });

  it.each([
    ['authorized', true],
    ['pending', true],
    ['provider_unavailable', false],
  ] as const)(
    'holds %s truth for reconciliation without an outbox intent',
    async (truth, verified) => {
      const harness = buildHarness();

      const result = await finalizePaymentTruth(harness.db, {
        ...baseInput,
        providerTruth: truth,
        providerTruthVerified: verified,
      });

      expect(result).toMatchObject({
        action: 'hold',
        requiresReconciliation: true,
        outboxId: null,
        outboxCreated: false,
      });
      expect(
        harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.finalizations, finalizationId)),
      ).toMatchObject({ intentAction: null, requiresReconciliation: true });
      expect(
        harness.writes.filter((write) =>
          write.path.startsWith(`${PAYMENT_FINALIZATION_COLLECTIONS.outbox}/`),
        ),
      ).toHaveLength(0);
    },
  );

  it('holds an unverified captured claim, then emits fulfillment only after verified provider truth', async () => {
    const harness = buildHarness();
    const first = await finalizePaymentTruth(harness.db, {
      ...baseInput,
      providerTruthVerified: false,
    });

    const verified = await finalizePaymentTruth(harness.db, baseInput);

    expect(first).toMatchObject({ action: 'hold', outboxCreated: false });
    expect(verified).toMatchObject({ action: 'fulfill', outboxCreated: true });
    expect(
      harness.writes.filter(
        (write) => write.path === path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId),
      ),
    ).toHaveLength(1);
  });

  it('emits fulfillment for verified order-paid provider truth', async () => {
    const harness = buildHarness();

    const result = await finalizePaymentTruth(harness.db, {
      ...baseInput,
      providerTruth: 'order_paid',
    });

    expect(result).toMatchObject({
      action: 'fulfill',
      reason: 'paid_provider_truth',
      outboxCreated: true,
    });
    expect(
      harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId)),
    ).toMatchObject({ providerTruth: 'order_paid', action: 'fulfill' });
  });

  it.each(['failed', 'expired'] as const)(
    'emits exactly one release intent for verified %s truth',
    async (providerTruth) => {
      const harness = buildHarness();
      const input: PaymentFinalizationInput = { ...baseInput, providerTruth };

      const first = await finalizePaymentTruth(harness.db, input);
      const writesAfterFirst = harness.writes.length;
      const replay = await finalizePaymentTruth(harness.db, input);

      expect(first).toMatchObject({ action: 'release', outboxCreated: true });
      expect(replay).toMatchObject({ action: 'release', replayed: true, outboxCreated: false });
      expect(harness.writes).toHaveLength(writesAfterFirst);
      expect(
        harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, releaseOutboxId)),
      ).toMatchObject({ action: 'release', status: 'pending' });
    },
  );

  it('fails closed when verified terminal truth conflicts with an existing intent', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, { ...baseInput, providerTruth: 'failed' });
    const writesBeforeConflict = harness.writes.length;

    await expect(finalizePaymentTruth(harness.db, baseInput)).rejects.toMatchObject({
      code: 'PAYMENT_FINALIZATION_ACTION_CONFLICT',
    });
    expect(harness.writes).toHaveLength(writesBeforeConflict);
  });

  it('fails closed when the provider order is reused for another internal order or amount', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, {
      ...baseInput,
      providerTruth: 'pending',
    });
    const writesBeforeConflict = harness.writes.length;

    await expect(
      finalizePaymentTruth(harness.db, {
        ...baseInput,
        providerPaymentId: 'pay_live_2',
        orderId: 'attacker-order',
        amountMinor: 1,
        providerTruth: 'captured',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FINALIZATION_IDENTITY_CONFLICT' });
    expect(harness.writes).toHaveLength(writesBeforeConflict);
  });

  it('permits multiple held attempts but prevents a second payment from fulfilling one provider order', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, { ...baseInput, providerTruth: 'pending' });
    await finalizePaymentTruth(harness.db, {
      ...baseInput,
      providerPaymentId: 'pay_live_2',
      providerTruth: 'captured',
    });
    expect(
      harness.read(
        path(
          PAYMENT_FINALIZATION_COLLECTIONS.finalizations,
          'payment-finalization:razorpay:order_live_1:pay_live_2',
        ),
      ),
    ).toMatchObject({ intentAction: 'fulfill', providerPaymentId: 'pay_live_2' });
    expect(
      harness.writes.filter(
        (write) =>
          write.path ===
          path(
            PAYMENT_FINALIZATION_COLLECTIONS.outbox,
            'payment-finalization:razorpay:order_live_1:pay_live_2:intent:fulfill',
          ),
      ),
    ).toHaveLength(1);
    const writesBeforeConflict = harness.writes.length;

    await expect(finalizePaymentTruth(harness.db, baseInput)).rejects.toMatchObject({
      code: 'PAYMENT_FINALIZATION_ACTION_CONFLICT',
    });
    expect(harness.writes).toHaveLength(writesBeforeConflict);
  });

  it('fails closed when fulfillment is followed by a verified release observation', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, baseInput);
    const writesBeforeConflict = harness.writes.length;

    await expect(
      finalizePaymentTruth(harness.db, { ...baseInput, providerTruth: 'expired' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FINALIZATION_ACTION_CONFLICT' });
    expect(harness.writes).toHaveLength(writesBeforeConflict);
  });

  it('does not overwrite terminal truth with a later hold or return a contradictory reason', async () => {
    const harness = buildHarness();
    await finalizePaymentTruth(harness.db, baseInput);
    const writesBeforeHold = harness.writes.length;

    const result = await finalizePaymentTruth(harness.db, {
      ...baseInput,
      source: 'reconciler',
      providerTruth: 'provider_unavailable',
      providerTruthVerified: false,
    });

    expect(result).toMatchObject({
      action: 'fulfill',
      reason: 'paid_provider_truth',
      requiresReconciliation: false,
      replayed: true,
      outboxCreated: false,
    });
    expect(harness.writes).toHaveLength(writesBeforeHold);
    expect(
      harness.read(path(PAYMENT_FINALIZATION_COLLECTIONS.finalizations, finalizationId)),
    ).toMatchObject({
      providerTruth: 'captured',
      decisionReason: 'paid_provider_truth',
      intentAction: 'fulfill',
    });
  });

  it.each(['claim', 'outbox'] as const)(
    'fails closed when the atomic terminal %s record is missing',
    async (missingRecord) => {
      const harness = buildHarness();
      await finalizePaymentTruth(harness.db, baseInput);
      harness.remove(
        missingRecord === 'claim'
          ? path(PAYMENT_FINALIZATION_COLLECTIONS.orderClaims, claimId)
          : path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId),
      );
      const writesBeforeCheck = harness.writes.length;

      await expect(finalizePaymentTruth(harness.db, baseInput)).rejects.toMatchObject({
        code: 'PAYMENT_FINALIZATION_CORRUPT_STATE',
      });
      expect(harness.writes).toHaveLength(writesBeforeCheck);
    },
  );

  it('serializes two concurrent exact terminal callers to one fulfillment intent', async () => {
    const harness = buildHarness({}, { serializeTransactions: true });

    const [first, second] = await Promise.all([
      finalizePaymentTruth(harness.db, baseInput),
      finalizePaymentTruth(harness.db, { ...baseInput, source: 'reconciler' }),
    ]);

    expect([first.outboxCreated, second.outboxCreated].sort()).toEqual([false, true]);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(
      harness.writes.filter(
        (write) => write.path === path(PAYMENT_FINALIZATION_COLLECTIONS.outbox, fulfillOutboxId),
      ),
    ).toHaveLength(1);
  });

  it('allows only one of two concurrent conflicting terminal callers to settle', async () => {
    const harness = buildHarness({}, { serializeTransactions: true });

    const results = await Promise.allSettled([
      finalizePaymentTruth(harness.db, baseInput),
      finalizePaymentTruth(harness.db, { ...baseInput, providerTruth: 'failed' }),
    ]);

    expect(results[0]).toMatchObject({ status: 'fulfilled' });
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: { code: 'PAYMENT_FINALIZATION_ACTION_CONFLICT' },
    });
    expect(
      harness.writes.filter((write) =>
        write.path.startsWith(`${PAYMENT_FINALIZATION_COLLECTIONS.outbox}/`),
      ),
    ).toHaveLength(1);
  });

  it('fails closed when one verified webhook event id is reused for different payment truth', async () => {
    const harness = buildHarness();
    const webhookInput: PaymentFinalizationInput = {
      ...baseInput,
      source: 'webhook',
      providerEventId: 'event_reused',
      providerTruth: 'pending',
    };
    await finalizePaymentTruth(harness.db, webhookInput);
    const writesBeforeConflict = harness.writes.length;

    await expect(
      finalizePaymentTruth(harness.db, { ...webhookInput, providerTruth: 'captured' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FINALIZATION_EVENT_CONFLICT' });
    expect(harness.writes).toHaveLength(writesBeforeConflict);
  });

  it('rejects webhook use without a route-verified event identity before any transaction read', async () => {
    const harness = buildHarness();

    await expect(
      applyPaymentFinalizationInTransaction(harness.transaction, harness.db, {
        ...baseInput,
        source: 'webhook',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_FINALIZATION_INVALID_INPUT' });
    expect(harness.writes).toEqual([]);
  });
});

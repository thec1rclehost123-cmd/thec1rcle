import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import {
  buildPaymentFinalizationKey,
  buildRazorpayEventDeduplicationKey,
  decidePaymentTruth,
  type PaymentFinalizationSource,
  type PaymentProviderTruth,
  type PaymentTruthDecision,
} from '../payment-refund-contract.js';

/**
 * Durable payment finalization primitives.
 *
 * Route code remains responsible for verifying callback/webhook signatures and
 * obtaining provider truth. This service never calls Razorpay, Redis,
 * inventory, ticketing, notifications, or any other external system. It only
 * commits a canonical payment decision and an intent to the transactional
 * outbox in one Firestore transaction.
 */

export const PAYMENT_FINALIZATION_COLLECTIONS = Object.freeze({
  finalizations: 'payment_finalizations',
  orderClaims: 'payment_finalization_order_claims',
  webhookEvents: 'payment_provider_event_ledger',
  outbox: 'payment_finalization_outbox',
});

export type PaymentFinalizationAction = 'fulfill' | 'release' | 'hold';
export type PaymentIntentAction = Exclude<PaymentFinalizationAction, 'hold'>;

export interface PaymentFinalizationInput {
  source: PaymentFinalizationSource;
  provider: 'razorpay';
  providerOrderId: string;
  providerPaymentId: string;
  providerTruth: PaymentProviderTruth;
  providerTruthVerified: boolean;
  /** Required only for a signature-verified Razorpay webhook delivery. */
  providerEventId?: string | null;
  orderId: string;
  amountMinor: number;
  currency: string;
  eventId?: string | null;
  reservationId?: string | null;
  userId?: string | null;
  now?: Date | string;
}

export interface PaymentFinalizationResult {
  finalizationId: string;
  orderClaimId: string;
  webhookEventLedgerId: string | null;
  outboxId: string | null;
  action: PaymentFinalizationAction;
  reason: PaymentTruthDecision['reason'];
  requiresReconciliation: boolean;
  replayed: boolean;
  eventReplayed: boolean;
  eventClaimed: boolean;
  outboxCreated: boolean;
}

export class PaymentFinalizationError extends Error {
  readonly code:
    | 'PAYMENT_FINALIZATION_INVALID_INPUT'
    | 'PAYMENT_FINALIZATION_IDENTITY_CONFLICT'
    | 'PAYMENT_FINALIZATION_EVENT_CONFLICT'
    | 'PAYMENT_FINALIZATION_ACTION_CONFLICT'
    | 'PAYMENT_FINALIZATION_CORRUPT_STATE';
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: PaymentFinalizationError['code'],
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PaymentFinalizationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

type CanonicalInput = Omit<PaymentFinalizationInput, 'providerEventId' | 'now'> & {
  providerEventId: string | null;
  eventId: string | null;
  reservationId: string | null;
  userId: string | null;
  timestamp: string;
  finalizationId: string;
  orderClaimId: string;
  webhookEventLedgerId: string | null;
};

interface SnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new PaymentFinalizationError(message, 'PAYMENT_FINALIZATION_INVALID_INPUT', details);
}

function identifier(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.includes('/') || Buffer.byteLength(normalized, 'utf8') > 256) {
    return invalid(`${field} must be a non-empty identifier without slashes`, { field });
  }
  return normalized;
}

function optionalIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return identifier(value, field);
}

function exactMinorAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return invalid('amountMinor must be a positive safe integer', { amountMinor: value });
  }
  return value;
}

function currencyCode(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    return invalid('currency must be a three-letter ISO currency code', { currency: value });
  }
  return normalized;
}

function timestamp(value?: Date | string): string {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return invalid('now must be a valid date');
  return date.toISOString();
}

function canonicalize(input: PaymentFinalizationInput): CanonicalInput {
  if (!input || typeof input !== 'object') return invalid('payment finalization input is required');
  if (input.provider !== 'razorpay') return invalid('provider must be razorpay');
  if (!['app_callback', 'webhook', 'reconciler'].includes(input.source)) {
    return invalid('source is invalid', { source: input.source });
  }
  if (typeof input.providerTruthVerified !== 'boolean') {
    return invalid('providerTruthVerified must be boolean');
  }

  const providerOrderId = identifier(input.providerOrderId, 'providerOrderId');
  const providerPaymentId = identifier(input.providerPaymentId, 'providerPaymentId');
  const orderId = identifier(input.orderId, 'orderId');
  const providerEventId = optionalIdentifier(input.providerEventId, 'providerEventId');

  if (input.source === 'webhook' && !providerEventId) {
    return invalid('providerEventId is required for webhook finalization');
  }
  if (input.source !== 'webhook' && providerEventId) {
    return invalid('providerEventId is accepted only from the webhook boundary');
  }

  const allowedTruths: readonly PaymentProviderTruth[] = [
    'captured',
    'order_paid',
    'authorized',
    'pending',
    'failed',
    'expired',
    'provider_unavailable',
  ];
  if (!allowedTruths.includes(input.providerTruth)) {
    return invalid('providerTruth is invalid', { providerTruth: input.providerTruth });
  }

  const finalizationId = buildPaymentFinalizationKey({
    provider: 'razorpay',
    providerOrderId,
    providerPaymentId,
  });
  const orderClaimId = `payment-order-claim:razorpay:${encodeURIComponent(providerOrderId)}`;
  const webhookEventLedgerId = providerEventId
    ? buildRazorpayEventDeduplicationKey(providerEventId)
    : null;
  const documentIds = [
    finalizationId,
    orderClaimId,
    webhookEventLedgerId,
    `${finalizationId}:intent:fulfill`,
    `${finalizationId}:intent:release`,
  ].filter((value): value is string => Boolean(value));
  if (documentIds.some((value) => Buffer.byteLength(value, 'utf8') > 1_500)) {
    return invalid('payment identity exceeds Firestore document id limits');
  }

  return {
    ...input,
    provider: 'razorpay',
    providerOrderId,
    providerPaymentId,
    providerEventId,
    orderId,
    amountMinor: exactMinorAmount(input.amountMinor),
    currency: currencyCode(input.currency),
    eventId: optionalIdentifier(input.eventId, 'eventId'),
    reservationId: optionalIdentifier(input.reservationId, 'reservationId'),
    userId: optionalIdentifier(input.userId, 'userId'),
    timestamp: timestamp(input.now),
    finalizationId,
    orderClaimId,
    webhookEventLedgerId,
  };
}

function record(snapshot: SnapshotLike): Record<string, unknown> | null {
  return snapshot.exists ? snapshot.data() || {} : null;
}

function assertFieldsMatch(
  existing: Record<string, unknown>,
  expected: Record<string, unknown>,
  code: PaymentFinalizationError['code'],
  message: string,
): void {
  const conflicts = Object.entries(expected)
    .filter(([field, value]) => existing[field] !== value)
    .map(([field]) => field);
  if (conflicts.length > 0) {
    throw new PaymentFinalizationError(message, code, { conflictingFields: conflicts });
  }
}

function canonicalIdentity(input: CanonicalInput) {
  return {
    provider: input.provider,
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  };
}

function orderClaimIdentity(input: CanonicalInput) {
  return {
    provider: input.provider,
    providerOrderId: input.providerOrderId,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  };
}

function eventIdentity(input: CanonicalInput) {
  return {
    ...canonicalIdentity(input),
    providerEventId: input.providerEventId,
    finalizationId: input.finalizationId,
    providerTruth: input.providerTruth,
  };
}

function intentOutboxId(finalizationId: string, action: PaymentIntentAction): string {
  return `${finalizationId}:intent:${action}`;
}

function assertOutboxMatches(
  existing: Record<string, unknown>,
  input: CanonicalInput,
  action: PaymentIntentAction,
): void {
  assertFieldsMatch(
    existing,
    {
      version: 1,
      finalizationId: input.finalizationId,
      orderClaimId: input.orderClaimId,
      orderId: input.orderId,
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      action,
    },
    'PAYMENT_FINALIZATION_CORRUPT_STATE',
    'Payment finalization outbox identity is inconsistent',
  );
}

function assertAtomicState(
  finalization: Record<string, unknown> | null,
  claim: Record<string, unknown> | null,
  fulfillOutbox: Record<string, unknown> | null,
  releaseOutbox: Record<string, unknown> | null,
  input: CanonicalInput,
): void {
  if (finalization && !claim) {
    throw new PaymentFinalizationError(
      'Payment finalization is missing its provider order claim',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId, orderClaimId: input.orderClaimId },
    );
  }
  if (!finalization && (fulfillOutbox || releaseOutbox)) {
    throw new PaymentFinalizationError(
      'Payment outbox exists without a finalization record',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId },
    );
  }
  if (fulfillOutbox && releaseOutbox) {
    throw new PaymentFinalizationError(
      'Payment finalization has conflicting outbox intents',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId },
    );
  }

  if (claim) {
    assertFieldsMatch(
      claim,
      { version: 1, orderClaimId: input.orderClaimId, ...orderClaimIdentity(input) },
      'PAYMENT_FINALIZATION_IDENTITY_CONFLICT',
      'Provider order was reused with a different internal identity',
    );
    if (claim.settledByFinalizationId === input.finalizationId && !finalization) {
      throw new PaymentFinalizationError(
        'Settled provider order claim is missing its finalization record',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { finalizationId: input.finalizationId, orderClaimId: input.orderClaimId },
      );
    }
  }

  if (!finalization) return;
  assertFieldsMatch(
    finalization,
    { version: 1, finalizationId: input.finalizationId, ...canonicalIdentity(input) },
    'PAYMENT_FINALIZATION_IDENTITY_CONFLICT',
    'Payment finalization identity was reused with different inputs',
  );

  const existingAction = finalization.intentAction;
  if (existingAction === 'fulfill') {
    if (
      finalization.decisionReason !== 'paid_provider_truth' ||
      finalization.providerTruthVerified !== true
    ) {
      throw new PaymentFinalizationError(
        'Fulfillment intent is not backed by verified paid provider truth',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { finalizationId: input.finalizationId },
      );
    }
    if (!fulfillOutbox) {
      throw new PaymentFinalizationError(
        'Fulfilled finalization is missing its outbox intent',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { finalizationId: input.finalizationId },
      );
    }
    assertOutboxMatches(fulfillOutbox, input, 'fulfill');
  } else if (existingAction === 'release') {
    if (
      finalization.decisionReason !== 'terminal_failure_provider_truth' ||
      finalization.providerTruthVerified !== true
    ) {
      throw new PaymentFinalizationError(
        'Release intent is not backed by verified terminal provider truth',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { finalizationId: input.finalizationId },
      );
    }
    if (!releaseOutbox) {
      throw new PaymentFinalizationError(
        'Released finalization is missing its outbox intent',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { finalizationId: input.finalizationId },
      );
    }
    assertOutboxMatches(releaseOutbox, input, 'release');
  } else if (existingAction !== null && existingAction !== undefined) {
    throw new PaymentFinalizationError(
      'Payment finalization intent action is invalid',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId, existingAction },
    );
  } else if (fulfillOutbox || releaseOutbox) {
    throw new PaymentFinalizationError(
      'Holding finalization cannot have an outbox intent',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId },
    );
  }
}

async function getSnapshot(
  transaction: Transaction,
  reference: DocumentReference,
): Promise<SnapshotLike> {
  return (await transaction.get(reference)) as unknown as SnapshotLike;
}

/**
 * Claims one provider observation and emits at most one fulfillment/release
 * intent inside an existing Firestore transaction. All transaction reads are
 * completed before the first write.
 */
export async function applyPaymentFinalizationInTransaction(
  transaction: Transaction,
  db: Firestore,
  rawInput: PaymentFinalizationInput,
): Promise<PaymentFinalizationResult> {
  const input = canonicalize(rawInput);
  const decision = decidePaymentTruth({
    truth: input.providerTruth,
    providerTruthVerified: input.providerTruthVerified,
  });
  const finalizationRef = db
    .collection(PAYMENT_FINALIZATION_COLLECTIONS.finalizations)
    .doc(input.finalizationId);
  const orderClaimRef = db
    .collection(PAYMENT_FINALIZATION_COLLECTIONS.orderClaims)
    .doc(input.orderClaimId);
  const webhookEventRef = input.webhookEventLedgerId
    ? db.collection(PAYMENT_FINALIZATION_COLLECTIONS.webhookEvents).doc(input.webhookEventLedgerId)
    : null;
  const fulfillOutboxId = intentOutboxId(input.finalizationId, 'fulfill');
  const releaseOutboxId = intentOutboxId(input.finalizationId, 'release');
  const fulfillOutboxRef = db
    .collection(PAYMENT_FINALIZATION_COLLECTIONS.outbox)
    .doc(fulfillOutboxId);
  const releaseOutboxRef = db
    .collection(PAYMENT_FINALIZATION_COLLECTIONS.outbox)
    .doc(releaseOutboxId);

  // Firestore disallows reads after writes. Keep every defensive consistency
  // read together before deciding which records to create/update.
  const [eventSnapshot, finalizationSnapshot, claimSnapshot, fulfillSnapshot, releaseSnapshot] =
    await Promise.all([
      webhookEventRef ? getSnapshot(transaction, webhookEventRef) : Promise.resolve(null),
      getSnapshot(transaction, finalizationRef),
      getSnapshot(transaction, orderClaimRef),
      getSnapshot(transaction, fulfillOutboxRef),
      getSnapshot(transaction, releaseOutboxRef),
    ]);

  const eventRecord = eventSnapshot ? record(eventSnapshot) : null;
  const finalization = record(finalizationSnapshot);
  const claim = record(claimSnapshot);
  const fulfillOutbox = record(fulfillSnapshot);
  const releaseOutbox = record(releaseSnapshot);

  if (eventRecord) {
    assertFieldsMatch(
      eventRecord,
      { version: 1, webhookEventLedgerId: input.webhookEventLedgerId, ...eventIdentity(input) },
      'PAYMENT_FINALIZATION_EVENT_CONFLICT',
      'Provider event id was reused with different payment inputs',
    );
    if (!finalization || !claim) {
      throw new PaymentFinalizationError(
        'Provider event ledger is missing its atomic finalization state',
        'PAYMENT_FINALIZATION_CORRUPT_STATE',
        { webhookEventLedgerId: input.webhookEventLedgerId },
      );
    }
  }
  assertAtomicState(finalization, claim, fulfillOutbox, releaseOutbox, input);

  const priorAction = (finalization?.intentAction || null) as PaymentIntentAction | null;
  const claimAction = (claim?.settledAction || null) as PaymentIntentAction | null;
  const claimFinalizationId = (claim?.settledByFinalizationId || null) as string | null;
  const nextAction = decision.action === 'hold' ? null : decision.action;
  const effectiveReason = priorAction
    ? (finalization?.decisionReason as PaymentTruthDecision['reason'])
    : decision.reason;

  if (
    Boolean(claimAction) !== Boolean(claimFinalizationId) ||
    (claimAction && !['fulfill', 'release'].includes(claimAction))
  ) {
    throw new PaymentFinalizationError(
      'Provider order claim settlement state is invalid',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { orderClaimId: input.orderClaimId },
    );
  }
  if (
    claimFinalizationId === input.finalizationId &&
    (claimAction !== priorAction || priorAction === null)
  ) {
    throw new PaymentFinalizationError(
      'Provider order claim settlement is not reflected by its finalization',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId, orderClaimId: input.orderClaimId },
    );
  }
  if (
    priorAction &&
    (claimAction !== priorAction || claimFinalizationId !== input.finalizationId)
  ) {
    throw new PaymentFinalizationError(
      'Finalization and provider order claim settlement disagree',
      'PAYMENT_FINALIZATION_CORRUPT_STATE',
      { finalizationId: input.finalizationId, orderClaimId: input.orderClaimId },
    );
  }
  if (
    nextAction &&
    claimAction &&
    (claimAction !== nextAction || claimFinalizationId !== input.finalizationId)
  ) {
    throw new PaymentFinalizationError(
      'Provider order already has a different terminal payment intent',
      'PAYMENT_FINALIZATION_ACTION_CONFLICT',
      {
        orderClaimId: input.orderClaimId,
        requestedAction: nextAction,
        settledAction: claimAction,
        settledByFinalizationId: claimFinalizationId,
      },
    );
  }
  if (priorAction && nextAction && priorAction !== nextAction) {
    throw new PaymentFinalizationError(
      'Payment truth conflicts with an existing terminal payment intent',
      'PAYMENT_FINALIZATION_ACTION_CONFLICT',
      { finalizationId: input.finalizationId, priorAction, requestedAction: nextAction },
    );
  }

  // An exact webhook replay is a true no-op. We still validate all canonical
  // state above before acknowledging it.
  if (eventRecord) {
    return {
      finalizationId: input.finalizationId,
      orderClaimId: input.orderClaimId,
      webhookEventLedgerId: input.webhookEventLedgerId,
      outboxId: priorAction ? intentOutboxId(input.finalizationId, priorAction) : null,
      action: priorAction || decision.action,
      reason: effectiveReason,
      requiresReconciliation: priorAction ? false : decision.requiresReconciliation,
      replayed: true,
      eventReplayed: true,
      eventClaimed: false,
      outboxCreated: false,
    };
  }

  let eventClaimed = false;
  if (webhookEventRef) {
    transaction.create(webhookEventRef, {
      version: 1,
      webhookEventLedgerId: input.webhookEventLedgerId,
      ...eventIdentity(input),
      source: 'webhook',
      receivedAt: input.timestamp,
    });
    eventClaimed = true;
  }

  if (!claim) {
    transaction.create(orderClaimRef, {
      version: 1,
      orderClaimId: input.orderClaimId,
      ...orderClaimIdentity(input),
      settledAction: nextAction,
      settledByFinalizationId: nextAction ? input.finalizationId : null,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    });
  } else if (nextAction && !claimAction) {
    transaction.update(orderClaimRef, {
      settledAction: nextAction,
      settledByFinalizationId: input.finalizationId,
      updatedAt: input.timestamp,
    });
  }

  const isExactFinalizationReplay = Boolean(
    finalization &&
    (priorAction || null) === (nextAction || null) &&
    finalization.providerTruth === input.providerTruth &&
    finalization.providerTruthVerified === input.providerTruthVerified,
  );

  if (!finalization) {
    transaction.create(finalizationRef, {
      version: 1,
      finalizationId: input.finalizationId,
      orderClaimId: input.orderClaimId,
      ...canonicalIdentity(input),
      eventId: input.eventId,
      reservationId: input.reservationId,
      userId: input.userId,
      providerTruth: input.providerTruth,
      providerTruthVerified: input.providerTruthVerified,
      decisionReason: decision.reason,
      intentAction: nextAction,
      requiresReconciliation: nextAction ? false : decision.requiresReconciliation,
      source: input.source,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    });
  } else if (!priorAction && nextAction) {
    transaction.update(finalizationRef, {
      providerTruth: input.providerTruth,
      providerTruthVerified: input.providerTruthVerified,
      decisionReason: decision.reason,
      intentAction: nextAction,
      requiresReconciliation: false,
      source: input.source,
      updatedAt: input.timestamp,
    });
  } else if (!priorAction && !nextAction && !isExactFinalizationReplay) {
    transaction.update(finalizationRef, {
      providerTruth: input.providerTruth,
      providerTruthVerified: input.providerTruthVerified,
      decisionReason: decision.reason,
      requiresReconciliation: decision.requiresReconciliation,
      source: input.source,
      updatedAt: input.timestamp,
    });
  }

  let outboxId: string | null = priorAction
    ? intentOutboxId(input.finalizationId, priorAction)
    : null;
  let outboxCreated = false;
  if (nextAction && !priorAction) {
    outboxId = intentOutboxId(input.finalizationId, nextAction);
    const outboxRef = nextAction === 'fulfill' ? fulfillOutboxRef : releaseOutboxRef;
    transaction.create(outboxRef, {
      version: 1,
      finalizationId: input.finalizationId,
      orderClaimId: input.orderClaimId,
      orderId: input.orderId,
      provider: input.provider,
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      providerTruth: input.providerTruth,
      amountMinor: input.amountMinor,
      currency: input.currency,
      eventId: input.eventId,
      reservationId: input.reservationId,
      userId: input.userId,
      action: nextAction,
      status: 'pending',
      attempts: 0,
      availableAt: input.timestamp,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    });
    outboxCreated = true;
  }

  return {
    finalizationId: input.finalizationId,
    orderClaimId: input.orderClaimId,
    webhookEventLedgerId: input.webhookEventLedgerId,
    outboxId,
    action: priorAction || nextAction || 'hold',
    reason: effectiveReason,
    requiresReconciliation: priorAction ? false : decision.requiresReconciliation,
    replayed: Boolean(finalization && !outboxCreated && (priorAction || isExactFinalizationReplay)),
    eventReplayed: false,
    eventClaimed,
    outboxCreated,
  };
}

/**
 * Unified entry point for app callbacks, verified webhooks, and reconcilers.
 * The returned outbox record is processed separately after commit.
 */
export async function finalizePaymentTruth(
  db: Firestore,
  input: PaymentFinalizationInput,
): Promise<PaymentFinalizationResult> {
  return db.runTransaction((transaction) =>
    applyPaymentFinalizationInTransaction(transaction, db, input),
  );
}

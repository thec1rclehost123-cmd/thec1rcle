/**
 * Pure payment/refund safety contract.
 *
 * This module deliberately has no provider, Firestore, Redis, inventory, or
 * ticketing dependencies. Callers must establish provider truth first and then
 * use these decisions to guard their transactional side effects.
 */

export type PaymentProviderTruth =
  | 'captured'
  | 'order_paid'
  | 'authorized'
  | 'pending'
  | 'failed'
  | 'expired'
  | 'provider_unavailable';

export type PaymentFinalizationSource = 'app_callback' | 'webhook' | 'reconciler';

export interface PaymentFinalizationIdentity {
  provider: 'razorpay';
  providerOrderId: string;
  providerPaymentId: string;
}

export interface PaymentTruthDecisionInput {
  truth: PaymentProviderTruth;
  /** True only after authenticated provider evidence establishes this state. */
  providerTruthVerified: boolean;
}

export interface PaymentTruthDecision {
  action: 'fulfill' | 'release' | 'hold';
  permitsFulfillment: boolean;
  permitsReservationRelease: boolean;
  requiresReconciliation: boolean;
  reason:
    | 'paid_provider_truth'
    | 'terminal_failure_provider_truth'
    | 'non_terminal_payment'
    | 'provider_truth_unavailable'
    | 'unverified_provider_claim';
}

function requiredIdentifier(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new RangeError(`${name} is required`);
  return normalized;
}

/**
 * The source is intentionally excluded. App callbacks, webhooks, and the
 * reconciler must compete for the same finalization record.
 */
export function buildPaymentFinalizationKey(
  identity: PaymentFinalizationIdentity & { source?: PaymentFinalizationSource },
): string {
  const provider = requiredIdentifier(identity.provider, 'provider');
  const providerOrderId = requiredIdentifier(identity.providerOrderId, 'providerOrderId');
  const providerPaymentId = requiredIdentifier(identity.providerPaymentId, 'providerPaymentId');
  return `payment-finalization:${encodeURIComponent(provider)}:${encodeURIComponent(providerOrderId)}:${encodeURIComponent(providerPaymentId)}`;
}

/**
 * Decides whether payment truth permits service fulfillment or reservation
 * release. "Hold" always means no inventory, ticket, entitlement, or order
 * terminalization side effects.
 */
export function decidePaymentTruth(input: PaymentTruthDecisionInput): PaymentTruthDecision {
  if (input.truth === 'provider_unavailable') {
    return {
      action: 'hold',
      permitsFulfillment: false,
      permitsReservationRelease: false,
      requiresReconciliation: true,
      reason: 'provider_truth_unavailable',
    };
  }

  if (!input.providerTruthVerified) {
    return {
      action: 'hold',
      permitsFulfillment: false,
      permitsReservationRelease: false,
      requiresReconciliation: true,
      reason: 'unverified_provider_claim',
    };
  }

  if (input.truth === 'captured' || input.truth === 'order_paid') {
    return {
      action: 'fulfill',
      permitsFulfillment: true,
      permitsReservationRelease: false,
      requiresReconciliation: false,
      reason: 'paid_provider_truth',
    };
  }

  if (input.truth === 'failed' || input.truth === 'expired') {
    return {
      action: 'release',
      permitsFulfillment: false,
      permitsReservationRelease: true,
      requiresReconciliation: false,
      reason: 'terminal_failure_provider_truth',
    };
  }

  return {
    action: 'hold',
    permitsFulfillment: false,
    permitsReservationRelease: false,
    requiresReconciliation: true,
    reason: 'non_terminal_payment',
  };
}

export type RazorpayWebhookDeliveryDecision =
  | {
      action: 'process';
      eventId: string;
      deduplicationKey: string;
      acknowledge: false;
    }
  | {
      action: 'acknowledge_duplicate';
      eventId: string;
      deduplicationKey: string;
      acknowledge: true;
    }
  | {
      action: 'reject';
      code: 'INVALID_SIGNATURE' | 'MISSING_EVENT_ID';
      acknowledge: false;
    };

function containsEventId(processed: ReadonlySet<string> | readonly string[], eventId: string) {
  return Array.isArray(processed)
    ? processed.includes(eventId)
    : (processed as ReadonlySet<string>).has(eventId);
}

export function buildRazorpayEventDeduplicationKey(eventId: string): string {
  return `razorpay-webhook-event:${encodeURIComponent(requiredIdentifier(eventId, 'eventId'))}`;
}

/**
 * Duplicate x-razorpay-event-id deliveries are acknowledged without replaying
 * side effects. The event id is only trusted after webhook signature proof.
 */
export function classifyRazorpayWebhookDelivery(input: {
  eventId?: string | null;
  signatureVerified: boolean;
  processedEventIds: ReadonlySet<string> | readonly string[];
}): RazorpayWebhookDeliveryDecision {
  if (!input.signatureVerified) {
    return { action: 'reject', code: 'INVALID_SIGNATURE', acknowledge: false };
  }

  const eventId = input.eventId?.trim();
  if (!eventId) {
    return { action: 'reject', code: 'MISSING_EVENT_ID', acknowledge: false };
  }

  const deduplicationKey = buildRazorpayEventDeduplicationKey(eventId);
  if (containsEventId(input.processedEventIds, eventId)) {
    return { action: 'acknowledge_duplicate', eventId, deduplicationKey, acknowledge: true };
  }

  return { action: 'process', eventId, deduplicationKey, acknowledge: false };
}

export type RefundStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'rejected';

const REFUND_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  requested: ['approved', 'rejected'],
  approved: ['processing'],
  processing: ['processed', 'failed'],
  processed: [],
  failed: [],
  rejected: [],
};

export function decideRefundTransition(
  current: RefundStatus,
  next: RefundStatus,
):
  | { allowed: true; from: RefundStatus; to: RefundStatus }
  | { allowed: false; from: RefundStatus; to: RefundStatus; code: 'ILLEGAL_REFUND_TRANSITION' } {
  if (REFUND_TRANSITIONS[current].includes(next)) return { allowed: true, from: current, to: next };
  return { allowed: false, from: current, to: next, code: 'ILLEGAL_REFUND_TRANSITION' };
}

export interface RefundRequestValidationInput {
  actor: { uid: string; role?: string | null };
  order: {
    userId?: string | null;
    customerId?: string | null;
    capturedAmountMinor: number;
    processedRefundAmountMinor?: number;
  };
  /** Defaults to all remaining refundable value. Amounts are integer paise. */
  requestedAmountMinor?: number | null;
}

export type RefundRequestValidation =
  | {
      valid: true;
      amountMinor: number;
      remainingRefundableAmountMinor: number;
      authorizedAs: 'owner' | 'administrator';
    }
  | {
      valid: false;
      code:
        | 'REFUND_NOT_OWNER'
        | 'INVALID_CAPTURED_AMOUNT'
        | 'INVALID_PROCESSED_REFUND_AMOUNT'
        | 'INVALID_REFUND_AMOUNT'
        | 'REFUND_AMOUNT_EXCEEDS_AVAILABLE';
    };

const REFUND_ADMIN_ROLES = new Set(['admin', 'super_admin', 'super']);

function isNonNegativeMinorAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Validates both refund authority and exact minor-unit value boundaries. */
export function validateRefundRequest(
  input: RefundRequestValidationInput,
): RefundRequestValidation {
  const actorUid = input.actor.uid.trim();
  const role = input.actor.role?.trim().toLowerCase() || '';
  const ownerIds = [input.order.userId, input.order.customerId]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  const authorizedAs = REFUND_ADMIN_ROLES.has(role)
    ? 'administrator'
    : ownerIds.includes(actorUid)
      ? 'owner'
      : null;

  if (!authorizedAs) return { valid: false, code: 'REFUND_NOT_OWNER' };

  const capturedAmountMinor = input.order.capturedAmountMinor;
  if (!Number.isSafeInteger(capturedAmountMinor) || capturedAmountMinor <= 0) {
    return { valid: false, code: 'INVALID_CAPTURED_AMOUNT' };
  }

  const processedRefundAmountMinor = input.order.processedRefundAmountMinor ?? 0;
  if (
    !isNonNegativeMinorAmount(processedRefundAmountMinor) ||
    processedRefundAmountMinor > capturedAmountMinor
  ) {
    return { valid: false, code: 'INVALID_PROCESSED_REFUND_AMOUNT' };
  }

  const remainingRefundableAmountMinor = capturedAmountMinor - processedRefundAmountMinor;
  const amountMinor = input.requestedAmountMinor ?? remainingRefundableAmountMinor;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return { valid: false, code: 'INVALID_REFUND_AMOUNT' };
  }
  if (amountMinor > remainingRefundableAmountMinor) {
    return { valid: false, code: 'REFUND_AMOUNT_EXCEEDS_AVAILABLE' };
  }

  return { valid: true, amountMinor, remainingRefundableAmountMinor, authorizedAs };
}

export interface RefundEffectDecision {
  recordsProcessedRefund: boolean;
  permitsOrderTerminalization: boolean;
  permitsTicketInvalidation: boolean;
  permitsInventoryRestore: boolean;
  orderDisposition: 'unchanged' | 'partial_refund' | 'refunded';
}

/**
 * Provider refund completion is a hard prerequisite for all destructive local
 * effects. Full-order effects also require exact cumulative amount equality.
 */
export function decideRefundEffects(input: {
  status: RefundStatus;
  capturedAmountMinor: number;
  processedRefundAmountMinorBefore?: number;
  refundAmountMinor: number;
}): RefundEffectDecision {
  if (input.status !== 'processed') {
    return {
      recordsProcessedRefund: false,
      permitsOrderTerminalization: false,
      permitsTicketInvalidation: false,
      permitsInventoryRestore: false,
      orderDisposition: 'unchanged',
    };
  }

  const prior = input.processedRefundAmountMinorBefore ?? 0;
  const amountsAreValid =
    Number.isSafeInteger(input.capturedAmountMinor) &&
    input.capturedAmountMinor > 0 &&
    isNonNegativeMinorAmount(prior) &&
    Number.isSafeInteger(input.refundAmountMinor) &&
    input.refundAmountMinor > 0 &&
    prior + input.refundAmountMinor <= input.capturedAmountMinor;

  if (!amountsAreValid) {
    return {
      recordsProcessedRefund: false,
      permitsOrderTerminalization: false,
      permitsTicketInvalidation: false,
      permitsInventoryRestore: false,
      orderDisposition: 'unchanged',
    };
  }

  const isFullRefund = prior + input.refundAmountMinor === input.capturedAmountMinor;
  return {
    recordsProcessedRefund: true,
    permitsOrderTerminalization: isFullRefund,
    permitsTicketInvalidation: isFullRefund,
    permitsInventoryRestore: isFullRefund,
    orderDisposition: isFullRefund ? 'refunded' : 'partial_refund',
  };
}

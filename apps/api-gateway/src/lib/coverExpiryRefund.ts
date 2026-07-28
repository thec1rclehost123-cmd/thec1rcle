import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { settleRefund } from '../routes/v1/refunds';

const OUTBOX_TYPE = 'cover.wallet.expiry_refund.required';
const ACTIVE_REFUND_STATUSES = new Set([
  'pending',
  'approved',
  'settling',
  'processing',
  'completed',
  'refunded',
]);
const PROCESSABLE_OUTBOX_STATUSES = new Set(['pending', 'processing']);
const LEASE_MS = 60_000;

type SettlementResult =
  { ok: true; status: string; razorpayRefundId: string } | { ok: false; error: string };

type SettlementFunction = (
  fastify: FastifyInstance,
  params: {
    refundId: string;
    orderId: string;
    amountPaise: number;
    razorpayPaymentId: string;
    fullyRefunded: boolean;
    previousStatus: string;
    actor: { uid: string; role: string | null };
    requestId: string;
  },
) => Promise<SettlementResult>;

function positiveSafePaise(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer paise value`), {
      code: 'INVALID_MONEY',
    });
  }
  return parsed;
}

function amountPaise(record: Record<string, any>): number {
  if (Number.isSafeInteger(record.amountPaise)) return Number(record.amountPaise);
  return Math.round(Number(record.amount || 0) * 100);
}

async function claimCoverExpiryRefund(fastify: FastifyInstance, outboxId: string, leaseId: string) {
  const db = fastify.db;
  const outboxRef = db.collection('domain_event_outbox').doc(outboxId);
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS).toISOString();

  return db.runTransaction(async (transaction: any) => {
    const outboxSnapshot = await transaction.get(outboxRef);
    if (!outboxSnapshot.exists) {
      return { claimed: false as const, reason: 'OUTBOX_NOT_FOUND' };
    }

    const outbox = { id: outboxSnapshot.id, ...outboxSnapshot.data() } as Record<string, any>;
    if (outbox.type !== OUTBOX_TYPE) {
      return { claimed: false as const, reason: 'OUTBOX_TYPE_MISMATCH' };
    }
    if (outbox.status === 'dispatched') {
      return { claimed: false as const, reason: 'ALREADY_DISPATCHED' };
    }
    if (outbox.status === 'operator_review') {
      return { claimed: false as const, reason: 'OPERATOR_REVIEW_REQUIRED' };
    }
    if (!PROCESSABLE_OUTBOX_STATUSES.has(String(outbox.status || 'pending'))) {
      return { claimed: false as const, reason: 'OUTBOX_NOT_PROCESSABLE' };
    }
    if (
      outbox.status === 'processing' &&
      outbox.leaseExpiresAt &&
      new Date(outbox.leaseExpiresAt).getTime() > now.getTime()
    ) {
      return { claimed: false as const, reason: 'LEASED' };
    }

    const walletId = String(outbox.walletId || '');
    const orderId = String(outbox.orderId || '');
    const refundId = `cover_expiry_${walletId}`;
    const walletRef = db.collection('cover_wallets').doc(walletId);
    const expiryTxnRef = walletRef.collection('txns').doc(`EXPIRY-REFUND-${walletId}`);
    const orderRef = db.collection('orders').doc(orderId);
    const refundRef = db.collection('refund_requests').doc(refundId);

    const [walletSnapshot, expiryTxnSnapshot, orderSnapshot, refundSnapshot, priorRefunds] =
      await Promise.all([
        transaction.get(walletRef),
        transaction.get(expiryTxnRef),
        transaction.get(orderRef),
        transaction.get(refundRef),
        transaction.get(db.collection('refund_requests').where('orderId', '==', orderId)),
      ]);

    if (!walletSnapshot.exists || !expiryTxnSnapshot.exists || !orderSnapshot.exists) {
      throw Object.assign(new Error('Cover expiry refund is missing authoritative artifacts'), {
        code: 'COVER_EXPIRY_REFUND_ARTIFACT_MISSING',
      });
    }

    const wallet = { id: walletSnapshot.id, ...walletSnapshot.data() } as Record<string, any>;
    const expiryTxn = expiryTxnSnapshot.data() as Record<string, any>;
    const order = { id: orderSnapshot.id, ...orderSnapshot.data() } as Record<string, any>;
    const refundAmountPaise = positiveSafePaise(outbox.amountPaise, 'outbox.amountPaise');
    const expiryAmountPaise = positiveSafePaise(
      expiryTxn.amountPaise,
      'expiry transaction amountPaise',
    );

    if (
      wallet.state !== 'EXPIRED' ||
      wallet.orderId !== orderId ||
      expiryTxn.type !== 'EXPIRY_REFUND' ||
      expiryAmountPaise !== refundAmountPaise
    ) {
      throw Object.assign(new Error('Cover expiry refund artifacts do not reconcile'), {
        code: 'COVER_EXPIRY_REFUND_CONFLICT',
      });
    }
    if (!['confirmed', 'checked_in'].includes(String(order.status || ''))) {
      return { claimed: false as const, reason: 'ORDER_NOT_REFUNDABLE' };
    }
    if (!order.paymentId) {
      throw Object.assign(new Error('Cover expiry refund order has no provider payment'), {
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    const existingRefund = refundSnapshot.exists
      ? ({ id: refundSnapshot.id, ...refundSnapshot.data() } as Record<string, any>)
      : null;
    if (existingRefund?.status === 'completed') {
      transaction.update(outboxRef, {
        status: 'dispatched',
        refundRequestId: refundId,
        providerRefundId: existingRefund.razorpayRefundId || null,
        dispatchedAt: existingRefund.completedAt || nowIso,
        leaseId: null,
        leaseExpiresAt: null,
        updatedAt: nowIso,
      });
      return { claimed: false as const, reason: 'ALREADY_DISPATCHED' };
    }
    if (existingRefund && !['pending', 'approved'].includes(String(existingRefund.status || ''))) {
      return { claimed: false as const, reason: 'REFUND_NOT_RETRY_SAFE' };
    }

    if (!existingRefund) {
      const paidPaise = Number.isSafeInteger(order.totalPaise)
        ? Number(order.totalPaise)
        : Math.round(Number(order.totalAmount || 0) * 100);
      positiveSafePaise(paidPaise, 'order.totalPaise');
      const alreadyRefundedPaise = priorRefunds.docs.reduce((sum: number, document: any) => {
        if (document.id === refundId) return sum;
        const refund = document.data() as Record<string, any>;
        if (!ACTIVE_REFUND_STATUSES.has(String(refund.status || ''))) return sum;
        return sum + amountPaise(refund);
      }, 0);
      const remainingPaise = paidPaise - alreadyRefundedPaise;
      if (refundAmountPaise > remainingPaise) {
        throw Object.assign(new Error('Cover expiry refund exceeds provider refundable balance'), {
          code: 'REFUND_AMOUNT_EXCEEDS_BALANCE',
        });
      }

      transaction.create(refundRef, {
        id: refundId,
        orderId,
        eventId: wallet.eventId,
        customerId: wallet.userId,
        walletId,
        amount: refundAmountPaise / 100,
        amountPaise: refundAmountPaise,
        isPartial: true,
        fullyRefunded: false,
        revokeAdmission: false,
        reason: 'Unused Cover Wallet balance expired under the configured refund policy',
        source: 'system',
        refundKind: 'cover_wallet_expiry',
        requestedBy: { uid: 'system:cover-wallet-expiry', role: 'system' },
        status: 'approved',
        approvalType: 'system_policy',
        approversRequired: 0,
        approvers: [{ uid: 'system:cover-wallet-expiry', role: 'system', at: nowIso }],
        paymentDetails: { originalPaymentId: order.paymentId },
        previousStatus: order.status,
        terminalOrderStatus: order.status,
        idempotencyKey: `cover-expiry-refund:${walletId}`,
        outboxEventId: outboxId,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    transaction.update(outboxRef, {
      status: 'processing',
      refundRequestId: refundId,
      leaseId,
      leaseExpiresAt,
      lastAttemptAt: nowIso,
      attempts: Number(outbox.attempts || 0) + 1,
      updatedAt: nowIso,
    });

    return {
      claimed: true as const,
      outboxId,
      refundId,
      orderId,
      amountPaise: refundAmountPaise,
      razorpayPaymentId: String(order.paymentId),
      previousStatus: String(order.status),
    };
  });
}

export async function processCoverExpiryRefundOutbox(
  fastify: FastifyInstance,
  {
    limit = 25,
    settle = settleRefund as SettlementFunction,
  }: { limit?: number; settle?: SettlementFunction } = {},
) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 1, 1), 100);
  const snapshot = await fastify.db
    .collection('domain_event_outbox')
    .where('type', '==', OUTBOX_TYPE)
    .limit(boundedLimit)
    .get();
  const candidates = snapshot.docs.filter((document: any) =>
    PROCESSABLE_OUTBOX_STATUSES.has(String(document.data()?.status || 'pending')),
  );
  const results = [];

  for (const document of candidates) {
    const leaseId = randomUUID();
    try {
      const claim = await claimCoverExpiryRefund(fastify, document.id, leaseId);
      if (!claim.claimed) {
        results.push({ outboxId: document.id, success: true, skipped: true, reason: claim.reason });
        continue;
      }

      const settlement = await settle(fastify, {
        refundId: claim.refundId,
        orderId: claim.orderId,
        amountPaise: claim.amountPaise,
        razorpayPaymentId: claim.razorpayPaymentId,
        fullyRefunded: false,
        previousStatus: claim.previousStatus,
        actor: { uid: 'system:cover-wallet-expiry', role: 'system' },
        requestId: claim.outboxId,
      });
      const outboxRef = fastify.db.collection('domain_event_outbox').doc(claim.outboxId);

      if (!settlement.ok) {
        await outboxRef.update({
          status: 'operator_review',
          leaseId: null,
          leaseExpiresAt: null,
          lastError: settlement.error.slice(0, 500),
          updatedAt: new Date().toISOString(),
        });
        results.push({
          outboxId: claim.outboxId,
          refundId: claim.refundId,
          success: false,
          operatorReviewRequired: true,
          error: settlement.error,
        });
        continue;
      }

      if (settlement.status === 'completed') {
        await outboxRef.update({
          status: 'dispatched',
          providerRefundId: settlement.razorpayRefundId,
          dispatchedAt: new Date().toISOString(),
          leaseId: null,
          leaseExpiresAt: null,
          lastError: null,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await outboxRef.update({
          status: 'provider_pending',
          providerRefundId: settlement.razorpayRefundId,
          leaseId: null,
          leaseExpiresAt: null,
          lastError: null,
          updatedAt: new Date().toISOString(),
        });
      }
      results.push({
        outboxId: claim.outboxId,
        refundId: claim.refundId,
        success: true,
        status: settlement.status,
        providerRefundId: settlement.razorpayRefundId,
      });
    } catch (error: any) {
      await fastify.db
        .collection('domain_event_outbox')
        .doc(document.id)
        .update({
          status: 'operator_review',
          leaseId: null,
          leaseExpiresAt: null,
          lastError: String(error?.message || error).slice(0, 500),
          updatedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
      results.push({
        outboxId: document.id,
        success: false,
        operatorReviewRequired: true,
        error: String(error?.message || error),
      });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter((result) => result.success && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}

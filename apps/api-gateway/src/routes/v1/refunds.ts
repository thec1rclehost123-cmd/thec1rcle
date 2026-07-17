import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const RequestBody = z
  .object({
    orderId: z.string(),
    reason: z.string().optional(),
    amount: z.number().positive().nullable().optional(),
    // `source` is accepted for backward compatibility but ignored — it is
    // derived server-side from the authenticated actor, never trusted.
    source: z.string().optional(),
  })
  .strict();

// Refund statuses that consume the order's refundable balance.
const ACTIVE_REFUND_STATUSES = ['pending', 'approved', 'processing', 'completed', 'refunded'];

const PendingQuery = z
  .object({
    limit: z.string().optional(),
    eventId: z.string().optional(),
  })
  .strict();

const OrderIdParam = z.object({ orderId: z.string() }).strict();
const RefundIdParam = z.object({ id: z.string() }).strict();

const ActionBody = z
  .object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional(),
  })
  .strict();

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

function getRazorpayKeySecret() {
  return process.env.RAZORPAY_KEY_SECRET;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function allowMockRazorpay() {
  return !isProductionRuntime() && process.env.C1RCLE_ALLOW_MOCK_RAZORPAY === 'true';
}

const REFUNDS_COL = 'refund_requests';
const ORDERS_COL = 'orders';

/**
 * Atomically claims a refund request for settlement so a retried/duplicate
 * call can't trigger two Razorpay refunds for the same request.
 */
async function claimRefundForSettlement(
  fastify: FastifyInstance,
  refundId: string,
): Promise<boolean> {
  const ref = fastify.db.collection(REFUNDS_COL).doc(refundId);
  return fastify.db.runTransaction(async (t: any) => {
    const snap = await t.get(ref);
    if (!snap.exists) return false;
    const data = snap.data() as any;
    if (data.razorpayRefundId) return false;
    if (!['pending', 'approved'].includes(data.status)) return false;
    t.update(ref, { status: 'settling', updatedAt: new Date().toISOString() });
    return true;
  });
}

/**
 * Calls Razorpay to actually move the money for an approved refund, then
 * reconciles the refund request and order documents with the outcome. On
 * failure, the order is restored to its pre-refund status rather than left
 * locked in `refund_requested`.
 */
async function settleRefund(
  fastify: FastifyInstance,
  params: {
    refundId: string;
    orderId: string;
    amount: number;
    razorpayPaymentId: string;
    fullyRefunded: boolean;
    previousStatus: string;
    actor: { uid: string; role: string | null };
    requestId: string;
  },
): Promise<{ ok: true; status: string; razorpayRefundId: string } | { ok: false; error: string }> {
  const {
    refundId,
    orderId,
    amount,
    razorpayPaymentId,
    fullyRefunded,
    previousStatus,
    actor,
    requestId,
  } = params;
  const now = new Date().toISOString();
  const refundRef = fastify.db.collection(REFUNDS_COL).doc(refundId);
  const orderRef = fastify.db.collection(ORDERS_COL).doc(orderId);

  const claimed = await claimRefundForSettlement(fastify, refundId);
  if (!claimed) {
    const snap = await refundRef.get();
    const data = snap.exists ? (snap.data() as any) : null;
    if (data?.razorpayRefundId) {
      return { ok: true, status: data.status, razorpayRefundId: data.razorpayRefundId };
    }
    return { ok: false, error: 'Refund is already being processed' };
  }

  try {
    const refund = await (fastify as any).checkoutService.refundPayment({
      razorpayPaymentId,
      amount,
      receipt: refundId,
      notes: { orderId, refundRequestId: refundId },
      config: {
        keyId: getRazorpayKeyId(),
        keySecret: getRazorpayKeySecret(),
        allowMockPayment: allowMockRazorpay(),
      },
    });

    const status = refund.status === 'processed' ? 'completed' : 'processing';

    await fastify.db.runTransaction(async (t: any) => {
      t.update(refundRef, {
        status,
        razorpayRefundId: refund.id,
        settledAt: now,
        updatedAt: now,
      });
      t.update(orderRef, {
        status: fullyRefunded ? 'refunded' : previousStatus,
        refundStatus: status,
        razorpayRefundId: refund.id,
        updatedAt: now,
      });
    });

    await fastify.writeAuditLog({
      action: 'refund.settled',
      actorUid: actor.uid,
      actorRole: actor.role || null,
      entityType: 'refund',
      entityId: refundId,
      requestId,
      payload: { orderId, amount, razorpayRefundId: refund.id, status },
    });

    return { ok: true, status, razorpayRefundId: refund.id };
  } catch (e: any) {
    const message = e?.message || 'Razorpay refund failed';

    await fastify.db.runTransaction(async (t: any) => {
      t.update(refundRef, { status: 'failed', failureReason: message, updatedAt: now });
      t.update(orderRef, { status: previousStatus, refundStatus: 'failed', updatedAt: now });
    });

    await fastify.writeAuditLog({
      action: 'refund.failed',
      actorUid: actor.uid,
      actorRole: actor.role || null,
      entityType: 'refund',
      entityId: refundId,
      requestId,
      payload: { orderId, amount, reason: message },
    });

    fastify.log.error(`Refund settlement failed for ${refundId}: ${message}`);
    return { ok: false, error: message };
  }
}

export default async function refundRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/refunds/request
   */
  fastify.post(
    '/request',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: RequestBody })],
    },
    async (request: any, reply) => {
      const { orderId, reason = '', amount = null } = request.body;
      const requestedBy = request.user;
      if (!requestedBy) return reply.status(401).send({ error: 'Unauthorized' });

      const isAdmin = ['admin', 'super_admin', 'super'].includes(requestedBy.role);
      // Source is derived from the authenticated actor, never from the body.
      const source = isAdmin ? 'admin' : 'user';
      const AUTO_APPROVE_THRESHOLD = 500;
      const now = new Date().toISOString();
      const id = randomUUID();

      // Everything runs in a transaction so ownership, the refundable-balance
      // computation, the refund write, and the order lock are consistent and
      // cannot be raced into multiple stacked refunds.
      const outcome = await fastify.db.runTransaction(async (t: any) => {
        const orderRef = fastify.db.collection(ORDERS_COL).doc(orderId);
        const orderSnap = await t.get(orderRef);
        if (!orderSnap.exists)
          return { ok: false as const, status: 404, message: 'Order not found' };
        const order = { id: orderSnap.id, ...orderSnap.data() } as any;

        // Authorization: only the order owner or an admin may request a refund.
        const ownsOrder = order.userId === requestedBy.uid || order.customerId === requestedBy.uid;
        if (!isAdmin && !ownsOrder) {
          return { ok: false as const, status: 403, message: 'Forbidden' };
        }

        if (!['confirmed', 'checked_in'].includes(order.status)) {
          return { ok: false as const, status: 400, message: 'Order is not in a refundable state' };
        }

        const originalPaymentId = order.paymentId;
        if (!originalPaymentId) {
          return {
            ok: false as const,
            status: 409,
            message: 'Order has no linked payment to refund',
          };
        }

        // Compute the refundable balance = paid − sum of prior active refunds.
        const priorSnap = await t.get(
          fastify.db.collection(REFUNDS_COL).where('orderId', '==', orderId),
        );
        const paid = Number(order.totalAmount || 0);
        const alreadyRefunded = priorSnap.docs.reduce((sum: number, d: any) => {
          const r = d.data();
          return ACTIVE_REFUND_STATUSES.includes(r.status) ? sum + Number(r.amount || 0) : sum;
        }, 0);
        const remaining = Math.max(0, paid - alreadyRefunded);
        if (remaining <= 0) {
          return { ok: false as const, status: 409, message: 'Order is already fully refunded' };
        }

        // Clamp the requested amount to the refundable balance. `amount` is only
        // honored when explicitly provided; otherwise refund the full balance.
        const refundAmount = amount == null ? remaining : Number(amount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          return { ok: false as const, status: 400, message: 'Invalid refund amount' };
        }
        if (refundAmount > remaining) {
          return {
            ok: false as const,
            status: 400,
            message: 'Refund amount exceeds refundable balance',
          };
        }

        const autoApprove = refundAmount < AUTO_APPROVE_THRESHOLD && order.status !== 'checked_in';
        const fullyRefunded = refundAmount >= remaining;

        const refundRequest: any = {
          id,
          orderId,
          eventId: order.eventId,
          customerId: order.customerId || order.userId,
          amount: refundAmount,
          isPartial: refundAmount < paid,
          fullyRefunded,
          reason,
          source,
          requestedBy: { uid: requestedBy.uid, role: requestedBy.role },
          status: autoApprove ? 'approved' : 'pending',
          approvalType: refundAmount < 500 ? 'auto' : refundAmount < 5000 ? 'single' : 'dual',
          approversRequired: refundAmount < 500 ? 0 : refundAmount < 5000 ? 1 : 2,
          approvers: autoApprove ? [{ uid: 'system', role: 'system', at: now }] : [],
          paymentDetails: { originalPaymentId },
          previousStatus: order.status,
          idempotencyKey: `refund:${orderId}:${id}`,
          createdAt: now,
          updatedAt: now,
        };

        t.set(fastify.db.collection(REFUNDS_COL).doc(id), refundRequest);

        // Lock the order while the refund is pending or being settled with
        // Razorpay so the ticket can't be re-scanned and a second refund
        // can't be requested against the same balance. `previousStatus`
        // above is what restores this on rejection or a failed gateway call.
        t.update(orderRef, {
          status: 'refund_requested',
          updatedAt: now,
          refundRequestId: id,
        });

        return { ok: true as const, refundRequest, autoApprove };
      });

      if (!outcome.ok) {
        return reply.status(outcome.status).send({ error: outcome.message });
      }

      await fastify.writeAuditLog({
        action: 'refund.request',
        actorUid: requestedBy.uid,
        actorRole: requestedBy.role || null,
        entityType: 'order',
        entityId: orderId,
        requestId: request.id,
        payload: {
          refundId: id,
          amount: outcome.refundRequest.amount,
          autoApproved: outcome.autoApprove,
          ip: request.ip,
        },
      });

      if (!outcome.autoApprove) {
        return {
          success: true,
          refundRequest: outcome.refundRequest,
          autoApproved: false,
        };
      }

      const settled = await settleRefund(fastify, {
        refundId: id,
        orderId,
        amount: outcome.refundRequest.amount,
        razorpayPaymentId: outcome.refundRequest.paymentDetails.originalPaymentId,
        fullyRefunded: outcome.refundRequest.fullyRefunded,
        previousStatus: outcome.refundRequest.previousStatus,
        actor: { uid: requestedBy.uid, role: requestedBy.role },
        requestId: request.id,
      });

      if (!settled.ok) {
        return reply.status(502).send({
          success: false,
          refundRequest: { ...outcome.refundRequest, status: 'failed' },
          error: settled.error,
        });
      }

      return {
        success: true,
        refundRequest: {
          ...outcome.refundRequest,
          status: settled.status,
          razorpayRefundId: settled.razorpayRefundId,
        },
        autoApproved: true,
      };
    },
  );

  /**
   * GET /api/v1/refunds/pending
   * Admin-only: list all pending refunds across all orders.
   */
  fastify.get(
    '/pending',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: PendingQuery })],
    },
    async (request: any, reply) => {
      if (!['admin', 'super_admin', 'super'].includes(request.user.role)) {
        return reply.status(403).send({ error: 'Forbidden: Admin access required' });
      }
      const { limit = 50, eventId } = request.query;
      let q: any = fastify.db.collection(REFUNDS_COL).where('status', '==', 'pending');
      if (eventId) q = q.where('eventId', '==', eventId);
      q = q.orderBy('createdAt', 'desc').limit(Number(limit));
      const snap = await q.get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * GET /api/v1/refunds/order/:orderId
   * Caller must own the order or be an admin.
   */
  fastify.get(
    '/order/:orderId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: OrderIdParam })],
    },
    async (request: any, reply) => {
      const { orderId } = request.params;
      const isAdmin = ['admin', 'super_admin', 'super'].includes(request.user.role);
      if (!isAdmin) {
        const orderDoc = await fastify.db.collection(ORDERS_COL).doc(orderId).get();
        if (!orderDoc.exists) return reply.status(404).send({ error: 'Order not found' });
        const order = orderDoc.data() as any;
        if (order.userId !== request.user.uid && order.customerId !== request.user.uid) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }
      const snap = await fastify.db
        .collection(REFUNDS_COL)
        .where('orderId', '==', orderId)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * PATCH /api/v1/refunds/:id
   */
  fastify.patch(
    '/:id',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: RefundIdParam, body: ActionBody }),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const { action, reason } = request.body;
      const actor = request.user;
      if (!actor || !['admin', 'super_admin', 'super'].includes(actor.role)) {
        return reply.status(403).send({ error: 'Only admins can respond to refunds' });
      }
      const now = new Date().toISOString();
      const doc = await fastify.db.collection(REFUNDS_COL).doc(id).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Refund not found' });

      const refundData = doc.data() as any;
      const previousStatus = refundData.previousStatus || 'confirmed';

      if (action === 'approve') {
        if (refundData.razorpayRefundId) {
          return reply.status(409).send({ error: 'Refund has already been processed' });
        }
        if (!['pending', 'approved'].includes(refundData.status)) {
          return reply
            .status(409)
            .send({ error: `Refund is not approvable from status "${refundData.status}"` });
        }
        const originalPaymentId = refundData.paymentDetails?.originalPaymentId;
        if (!originalPaymentId) {
          return reply
            .status(409)
            .send({ error: 'Refund request has no linked payment to refund' });
        }

        await fastify.db
          .collection(REFUNDS_COL)
          .doc(id)
          .update({
            status: 'approved',
            approvedAt: now,
            updatedAt: now,
            approvers: [
              ...(refundData.approvers || []),
              { uid: actor.uid, role: actor.role, at: now },
            ],
          });

        await fastify.writeAuditLog({
          action: 'refund.approve',
          actorUid: actor.uid,
          actorRole: actor.role || null,
          entityType: 'refund',
          entityId: id,
          requestId: request.id,
          payload: { orderId: refundData.orderId, amount: refundData.amount, ip: request.ip },
        });

        const settled = await settleRefund(fastify, {
          refundId: id,
          orderId: refundData.orderId,
          amount: refundData.amount,
          razorpayPaymentId: originalPaymentId,
          fullyRefunded: Boolean(refundData.fullyRefunded ?? !refundData.isPartial),
          previousStatus,
          actor: { uid: actor.uid, role: actor.role },
          requestId: request.id,
        });

        if (!settled.ok) {
          return reply.status(502).send({ success: false, error: settled.error });
        }

        return {
          success: true,
          status: settled.status,
          razorpayRefundId: settled.razorpayRefundId,
        };
      }

      // action === 'reject': restore whatever status the order had before
      // the refund was requested (e.g. `checked_in`), never hardcode it —
      // otherwise a rejected refund on an already-scanned ticket would
      // reopen it for re-entry.
      await fastify.db
        .collection(REFUNDS_COL)
        .doc(id)
        .update({ status: 'rejected', rejectionReason: reason, rejectedAt: now, updatedAt: now });
      await fastify.db
        .collection(ORDERS_COL)
        .doc(refundData.orderId)
        .update({ status: previousStatus, updatedAt: now });

      await fastify.writeAuditLog({
        action: 'refund.reject',
        actorUid: actor.uid,
        actorRole: actor.role || null,
        entityType: 'refund',
        entityId: id,
        requestId: request.id,
        payload: { orderId: refundData.orderId, amount: refundData.amount, reason, ip: request.ip },
      });

      return { success: true };
    },
  );
}

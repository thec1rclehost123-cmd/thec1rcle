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

export default async function refundRoutes(fastify: FastifyInstance) {
  const REFUNDS_COL = 'refund_requests';
  const ORDERS_COL = 'orders';

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
          reason,
          source,
          requestedBy: { uid: requestedBy.uid, role: requestedBy.role },
          status: autoApprove ? 'approved' : 'pending',
          approvalType: refundAmount < 500 ? 'auto' : refundAmount < 5000 ? 'single' : 'dual',
          approversRequired: refundAmount < 500 ? 0 : refundAmount < 5000 ? 1 : 2,
          approvers: autoApprove ? [{ uid: 'system', role: 'system', at: now }] : [],
          paymentDetails: { originalPaymentId: order.payment?.razorpayPaymentId },
          idempotencyKey: `refund:${orderId}:${id}`,
          createdAt: now,
          updatedAt: now,
        };

        t.set(fastify.db.collection(REFUNDS_COL).doc(id), refundRequest);

        // Lock the order. When the full balance is refunded, move it out of a
        // refundable state so the ticket is invalidated and no further refunds
        // can be requested; a manual (non-auto) request parks it for review.
        const orderUpdate: any = { updatedAt: now, refundRequestId: id };
        if (fullyRefunded) {
          orderUpdate.status = autoApprove ? 'refunded' : 'refund_requested';
        } else if (!autoApprove) {
          orderUpdate.status = 'refund_requested';
        }
        t.update(orderRef, orderUpdate);

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

      return {
        success: true,
        refundRequest: outcome.refundRequest,
        autoApproved: outcome.autoApprove,
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
      if (action === 'approve') {
        await fastify.db
          .collection(REFUNDS_COL)
          .doc(id)
          .update({ status: 'approved', approvedAt: now, updatedAt: now });
      } else if (action === 'reject') {
        await fastify.db
          .collection(REFUNDS_COL)
          .doc(id)
          .update({ status: 'rejected', rejectionReason: reason, rejectedAt: now, updatedAt: now });
        await fastify.db
          .collection(ORDERS_COL)
          .doc(refundData.orderId)
          .update({ status: 'confirmed', updatedAt: now });
      }

      await fastify.writeAuditLog({
        action: `refund.${action}`,
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

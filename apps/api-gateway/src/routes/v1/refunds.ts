import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const RequestBody = z
  .object({
    orderId: z.string(),
    reason: z.string().optional(),
    amount: z.number().nullable().optional(),
    source: z.string().optional(),
  })
  .strict();

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
      const { orderId, reason = '', amount = null, source = 'user' } = request.body;
      const requestedBy = request.user;
      if (!requestedBy) return reply.status(401).send({ error: 'Unauthorized' });

      const orderDoc = await fastify.db.collection(ORDERS_COL).doc(orderId).get();
      if (!orderDoc.exists) return reply.status(404).send({ error: 'Order not found' });
      const order = { id: orderDoc.id, ...orderDoc.data() } as any;

      if (!['confirmed', 'checked_in'].includes(order.status)) {
        return reply.status(400).send({ error: 'Order is not in a refundable state' });
      }

      const refundAmount = amount ?? order.totalAmount;
      const AUTO_APPROVE_THRESHOLD = 500;
      const autoApprove = refundAmount < AUTO_APPROVE_THRESHOLD && order.status !== 'checked_in';
      const now = new Date().toISOString();
      const id = randomUUID();

      const refundRequest: any = {
        id,
        orderId,
        eventId: order.eventId,
        customerId: order.customerId || order.userId,
        amount: refundAmount,
        isPartial: refundAmount < order.totalAmount,
        reason,
        source,
        requestedBy: { uid: requestedBy.uid, role: requestedBy.role },
        status: autoApprove ? 'approved' : 'pending',
        approvalType: refundAmount < 500 ? 'auto' : refundAmount < 5000 ? 'single' : 'dual',
        approversRequired: refundAmount < 500 ? 0 : refundAmount < 5000 ? 1 : 2,
        approvers: autoApprove ? [{ uid: 'system', role: 'system', at: now }] : [],
        paymentDetails: { originalPaymentId: order.payment?.razorpayPaymentId },
        idempotencyKey: `refund:${orderId}:${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };

      await fastify.db.collection(REFUNDS_COL).doc(id).set(refundRequest);
      if (!autoApprove) {
        await fastify.db
          .collection(ORDERS_COL)
          .doc(orderId)
          .update({ status: 'refund_requested', refundRequestId: id, updatedAt: now });
      }

      await fastify.writeAuditLog({
        action: 'refund.request',
        actorUid: requestedBy.uid,
        actorRole: requestedBy.role || null,
        entityType: 'order',
        entityId: orderId,
        requestId: request.id,
        payload: { refundId: id, amount: refundAmount, autoApproved: autoApprove, ip: request.ip },
      });

      return { success: true, refundRequest, autoApproved: autoApprove };
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

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { finalizeProcessedRefund } from '../../lib/refundLedger';

const RequestBody = z
  .object({
    orderId: z.string(),
    reason: z.string().optional(),
    amountPaise: z.number().int().positive().nullable().optional(),
    amount: z.number().positive().nullable().optional(),
    ticketIds: z.array(z.string().min(1)).min(1).max(50).optional(),
    entitlementIds: z.array(z.string().min(1)).min(1).max(50).optional(),
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
    amountPaise: number;
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
    amountPaise,
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
      amount: amountPaise / 100,
      receipt: refundId,
      notes: { orderId, refundRequestId: refundId },
      config: {
        keyId: getRazorpayKeyId(),
        keySecret: getRazorpayKeySecret(),
        allowMockPayment: allowMockRazorpay(),
      },
    });

    const status = refund.status === 'processed' ? 'completed' : 'processing';

    if (status === 'completed') {
      await finalizeProcessedRefund({
        db: fastify.db,
        refundId,
        providerRefundId: refund.id,
        processedAt: now,
      });
    } else {
      await fastify.db.runTransaction(async (t: any) => {
        t.update(refundRef, {
          status,
          razorpayRefundId: refund.id,
          settledAt: now,
          updatedAt: now,
        });
        t.update(orderRef, {
          status: fullyRefunded ? 'refund_processing' : previousStatus,
          refundStatus: status,
          razorpayRefundId: refund.id,
          updatedAt: now,
        });
      });
    }

    await fastify.writeAuditLog({
      action: 'refund.settled',
      actorUid: actor.uid,
      actorRole: actor.role || null,
      entityType: 'refund',
      entityId: refundId,
      requestId,
      payload: { orderId, amountPaise, razorpayRefundId: refund.id, status },
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
      payload: { orderId, amountPaise, reason: message },
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
      const {
        orderId,
        reason = '',
        amountPaise: requestedAmountPaise,
        amount = null,
        ticketIds = [],
        entitlementIds = [],
      } = request.body;
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
        const paidPaise = Number.isSafeInteger(order.totalPaise)
          ? order.totalPaise
          : Math.round(Number(order.totalAmount || 0) * 100);
        const alreadyRefundedPaise = priorSnap.docs.reduce((sum: number, d: any) => {
          const r = d.data();
          if (!ACTIVE_REFUND_STATUSES.includes(r.status)) return sum;
          return (
            sum +
            (Number.isSafeInteger(r.amountPaise)
              ? r.amountPaise
              : Math.round(Number(r.amount || 0) * 100))
          );
        }, 0);
        const remainingPaise = Math.max(0, paidPaise - alreadyRefundedPaise);
        if (remainingPaise <= 0) {
          return { ok: false as const, status: 409, message: 'Order is already fully refunded' };
        }

        const refundAmountPaise =
          requestedAmountPaise != null
            ? Number(requestedAmountPaise)
            : amount != null
              ? Math.round(Number(amount) * 100)
              : remainingPaise;
        if (!Number.isSafeInteger(refundAmountPaise) || refundAmountPaise <= 0) {
          return { ok: false as const, status: 400, message: 'Invalid refund amount' };
        }
        if (refundAmountPaise > remainingPaise) {
          return {
            ok: false as const,
            status: 400,
            message: 'Refund amount exceeds refundable balance',
          };
        }

        const refundAmount = refundAmountPaise / 100;
        const autoApprove =
          refundAmountPaise < AUTO_APPROVE_THRESHOLD * 100 && order.status !== 'checked_in';
        const fullyRefunded = refundAmountPaise >= remainingPaise;
        if (
          !fullyRefunded &&
          (ticketIds.length === 0 ||
            entitlementIds.length === 0 ||
            ticketIds.length !== entitlementIds.length)
        ) {
          return {
            ok: false as const,
            status: 400,
            message: 'Partial refunds require exact ticket and entitlement IDs',
          };
        }

        if (!fullyRefunded) {
          const [selectedTickets, selectedEntitlements] = await Promise.all([
            Promise.all(
              ticketIds.map((ticketId: string) =>
                t.get(fastify.db.collection('tickets').doc(ticketId)),
              ),
            ),
            Promise.all(
              entitlementIds.map((entitlementId: string) =>
                t.get(fastify.db.collection('entitlements').doc(entitlementId)),
              ),
            ),
          ]);
          const selectedTicketIds = new Set(ticketIds);
          const mappingIsValid =
            selectedTickets.every(
              (ticket: any) =>
                ticket.exists &&
                String(ticket.data()?.orderId || '') === orderId &&
                !['refunded', 'revoked'].includes(
                  String(ticket.data()?.status || '').toLowerCase(),
                ),
            ) &&
            selectedEntitlements.every(
              (entitlement: any) =>
                entitlement.exists &&
                String(entitlement.data()?.orderId || '') === orderId &&
                selectedTicketIds.has(String(entitlement.data()?.ticketDocumentId || '')) &&
                String(entitlement.data()?.state || '').toUpperCase() === 'ACTIVE',
            );
          if (!mappingIsValid) {
            return {
              ok: false as const,
              status: 400,
              message: 'Refund admission mapping is invalid',
            };
          }
        }

        const refundRequest: any = {
          id,
          orderId,
          eventId: order.eventId,
          customerId: order.customerId || order.userId,
          amount: refundAmount,
          amountPaise: refundAmountPaise,
          isPartial: refundAmountPaise < paidPaise,
          fullyRefunded,
          revokeAdmission: true,
          ticketIds: fullyRefunded ? [] : ticketIds,
          entitlementIds: fullyRefunded ? [] : entitlementIds,
          reason,
          source,
          requestedBy: { uid: requestedBy.uid, role: requestedBy.role },
          status: autoApprove ? 'approved' : 'pending',
          approvalType:
            refundAmountPaise < 50000 ? 'auto' : refundAmountPaise < 500000 ? 'single' : 'dual',
          approversRequired: refundAmountPaise < 50000 ? 0 : refundAmountPaise < 500000 ? 1 : 2,
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
          amountPaise: outcome.refundRequest.amountPaise,
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
        amountPaise: outcome.refundRequest.amountPaise,
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
        const approval = await fastify.db.runTransaction(async (transaction: any) => {
          const refundRef = fastify.db.collection(REFUNDS_COL).doc(id);
          const snapshot = await transaction.get(refundRef);
          if (!snapshot.exists) {
            return { ok: false as const, status: 404, error: 'Refund not found' };
          }
          const current = snapshot.data() as any;
          if (current.razorpayRefundId) {
            return {
              ok: false as const,
              status: 409,
              error: 'Refund has already been processed',
            };
          }
          if (!['pending', 'approved'].includes(current.status)) {
            return {
              ok: false as const,
              status: 409,
              error: `Refund is not approvable from status "${current.status}"`,
            };
          }
          if (current.approvers?.some((approver: any) => approver.uid === actor.uid)) {
            return {
              ok: false as const,
              status: 409,
              error: 'This admin has already approved the refund',
            };
          }
          const originalPaymentId = current.paymentDetails?.originalPaymentId;
          if (!originalPaymentId) {
            return {
              ok: false as const,
              status: 409,
              error: 'Refund request has no linked payment to refund',
            };
          }
          const approvers = [
            ...(current.approvers || []),
            { uid: actor.uid, role: actor.role, at: now },
          ];
          const approversRequired = Math.max(1, Number(current.approversRequired || 1));
          const fullyApproved = approvers.length >= approversRequired;
          const amountPaise = Number.isSafeInteger(current.amountPaise)
            ? current.amountPaise
            : Math.round(Number(current.amount || 0) * 100);
          if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
            return {
              ok: false as const,
              status: 409,
              error: 'Refund request has an invalid amount',
            };
          }
          transaction.update(refundRef, {
            status: fullyApproved ? 'approved' : 'pending',
            approvedAt: fullyApproved ? now : null,
            updatedAt: now,
            approvers,
          });
          return {
            ok: true as const,
            fullyApproved,
            pendingApprovals: Math.max(0, approversRequired - approvers.length),
            refund: { ...current, amountPaise },
            originalPaymentId,
          };
        });
        if (!approval.ok) {
          return reply.status(approval.status).send({ error: approval.error });
        }

        await fastify.writeAuditLog({
          action: 'refund.approve',
          actorUid: actor.uid,
          actorRole: actor.role || null,
          entityType: 'refund',
          entityId: id,
          requestId: request.id,
          payload: {
            orderId: approval.refund.orderId,
            amountPaise: approval.refund.amountPaise,
            fullyApproved: approval.fullyApproved,
            ip: request.ip,
          },
        });

        if (!approval.fullyApproved) {
          return {
            success: true,
            approved: false,
            pendingApprovals: approval.pendingApprovals,
            status: 'pending',
          };
        }

        const settled = await settleRefund(fastify, {
          refundId: id,
          orderId: approval.refund.orderId,
          amountPaise: approval.refund.amountPaise,
          razorpayPaymentId: approval.originalPaymentId,
          fullyRefunded: Boolean(approval.refund.fullyRefunded ?? !approval.refund.isPartial),
          previousStatus,
          actor: { uid: actor.uid, role: actor.role },
          requestId: request.id,
        });

        if (!settled.ok) {
          return reply.status(502).send({ success: false, error: settled.error });
        }

        return {
          success: true,
          approved: true,
          pendingApprovals: 0,
          status: settled.status,
          razorpayRefundId: settled.razorpayRefundId,
        };
      }

      // action === 'reject': restore whatever status the order had before
      // the refund was requested (e.g. `checked_in`), never hardcode it —
      // otherwise a rejected refund on an already-scanned ticket would
      // reopen it for re-entry.
      const rejected = await fastify.db.runTransaction(async (transaction: any) => {
        const refundRef = fastify.db.collection(REFUNDS_COL).doc(id);
        const currentSnapshot = await transaction.get(refundRef);
        if (!currentSnapshot.exists) return false;
        const current = currentSnapshot.data() as any;
        if (current.status !== 'pending') return false;
        transaction.update(refundRef, {
          status: 'rejected',
          rejectionReason: reason,
          rejectedAt: now,
          updatedAt: now,
        });
        transaction.update(fastify.db.collection(ORDERS_COL).doc(current.orderId), {
          status: current.previousStatus || 'confirmed',
          refundStatus: 'rejected',
          updatedAt: now,
        });
        return true;
      });
      if (!rejected) {
        return reply.status(409).send({ error: 'Refund is no longer rejectable' });
      }

      await fastify.writeAuditLog({
        action: 'refund.reject',
        actorUid: actor.uid,
        actorRole: actor.role || null,
        entityType: 'refund',
        entityId: id,
        requestId: request.id,
        payload: {
          orderId: refundData.orderId,
          amountPaise: refundData.amountPaise ?? Math.round(Number(refundData.amount || 0) * 100),
          reason,
          ip: request.ip,
        },
      });

      return { success: true };
    },
  );
}

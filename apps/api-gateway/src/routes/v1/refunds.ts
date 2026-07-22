import { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  decideRefundTransition,
  validateRefundRequest,
} from '@c1rcle/core/payment-refund-contract';

const RequestBody = z
  .object({
    orderId: z.string().min(1).max(200),
    reason: z.string().max(500).optional(),
    amount: z.number().finite().nullable().optional(),
    source: z.string().max(100).optional(),
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
    reason: z.string().max(500).optional(),
  })
  .strict();

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'super']);
const ACTIVE_REFUND_STATUSES = new Set(['requested', 'pending', 'approved', 'processing']);

class RefundRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function requestError(statusCode: number, code: string, message: string): never {
  throw new RefundRequestError(statusCode, code, message);
}

export function rupeesToPaiseExact(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (Number(value.toFixed(2)) !== value) return null;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded)) return null;
  return rounded;
}

function optionalPaise(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', `${field} is invalid`);
  }
  return Number(value);
}

function optionalRupeesAsPaise(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number') {
    requestError(409, 'REFUND_DATA_INCONSISTENT', `${field} is invalid`);
  }
  const amountPaise = rupeesToPaiseExact(value);
  if (amountPaise === null) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', `${field} is invalid`);
  }
  return amountPaise;
}

function resolveOriginalPaymentId(order: any): string {
  const candidates = [
    order.paymentId,
    order.razorpayPaymentId,
    order.payment?.razorpayPaymentId,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  if (candidates.length === 0 || candidates.some((value) => value !== candidates[0])) {
    requestError(409, 'PAYMENT_EVIDENCE_MISSING', 'Original payment identity is unavailable');
  }
  if (!/^pay_[A-Za-z0-9_-]+$/.test(candidates[0])) {
    requestError(409, 'PAYMENT_EVIDENCE_MISSING', 'Original payment identity is invalid');
  }
  return candidates[0];
}

function resolveCapturedAmountPaise(order: any, paymentRecord: any, paymentId: string): number {
  if (
    !paymentRecord ||
    !['verified', 'captured', 'order_paid'].includes(paymentRecord.status) ||
    paymentRecord.razorpayPaymentId !== paymentId ||
    paymentRecord.orderId !== order.id ||
    (paymentRecord.userId &&
      paymentRecord.userId !== order.userId &&
      paymentRecord.userId !== order.customerId)
  ) {
    requestError(409, 'PAYMENT_EVIDENCE_MISSING', 'Verified payment evidence is unavailable');
  }

  const orderTotalPaise = optionalRupeesAsPaise(order.totalAmount, 'order.totalAmount');
  if (orderTotalPaise === null) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Captured order amount is unavailable');
  }

  const explicitPaise = [
    optionalPaise(order.capturedAmountPaise, 'order.capturedAmountPaise'),
    optionalPaise(order.payment?.capturedAmountPaise, 'order.payment.capturedAmountPaise'),
    optionalPaise(order.payment?.amountPaise, 'order.payment.amountPaise'),
    optionalPaise(paymentRecord.amountPaise, 'paymentRecord.amountPaise'),
  ].filter((value): value is number => value !== null);
  const explicitRupees = optionalRupeesAsPaise(order.payment?.amount, 'order.payment.amount');
  if (explicitRupees !== null) explicitPaise.push(explicitRupees);
  const paymentRecordAmountPaise = optionalRupeesAsPaise(
    paymentRecord.amount,
    'paymentRecord.amount',
  );
  if (paymentRecordAmountPaise === null) {
    requestError(409, 'PAYMENT_EVIDENCE_MISSING', 'Verified payment amount is unavailable');
  }
  explicitPaise.push(paymentRecordAmountPaise);

  if (explicitPaise.some((value) => value !== orderTotalPaise)) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Captured payment amount is inconsistent');
  }
  return orderTotalPaise;
}

function resolveProcessedRefundAmountPaise(refund: any): number {
  const paise = optionalPaise(refund.amountPaise, 'processed refund amountPaise');
  const rupees = optionalRupeesAsPaise(refund.amount, 'processed refund amount');
  if (paise === null && rupees === null) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Processed refund amount is unavailable');
  }
  if (paise !== null && rupees !== null && paise !== rupees) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Processed refund amount is inconsistent');
  }
  const resolved = paise ?? (rupees as number);
  if (resolved <= 0) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Processed refund amount is invalid');
  }
  return resolved;
}

function processedRefundSummary(order: any, refundDocs: any[]) {
  const processedEntries = refundDocs
    .filter((doc) => doc.data()?.status === 'processed')
    .map((doc) => ({ id: doc.id, amountPaise: resolveProcessedRefundAmountPaise(doc.data()) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const amountPaise = processedEntries.reduce((sum, entry) => sum + entry.amountPaise, 0);
  if (!Number.isSafeInteger(amountPaise)) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Processed refund total is invalid');
  }

  const aggregateCandidates = [
    optionalPaise(order.processedRefundAmountPaise, 'order.processedRefundAmountPaise'),
    optionalPaise(
      order.refundSummary?.processedAmountPaise,
      'order.refundSummary.processedAmountPaise',
    ),
  ].filter((value): value is number => value !== null);
  if (aggregateCandidates.some((value) => value !== amountPaise)) {
    requestError(409, 'REFUND_DATA_INCONSISTENT', 'Processed refund aggregate is inconsistent');
  }

  const version = processedEntries.length
    ? `v_${createHash('sha256')
        .update(processedEntries.map((entry) => `${entry.id}:${entry.amountPaise}`).join('|'))
        .digest('hex')
        .slice(0, 24)}`
    : 'v0';
  return { amountPaise, version };
}

function refundRequestGeneration(refundDocs: any[]) {
  const terminalEntries = refundDocs
    .map((doc) => ({ id: doc.id, status: String(doc.data()?.status || '') }))
    .filter((entry) => ['failed', 'rejected', 'processed'].includes(entry.status))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (terminalEntries.length === 0) return 'a0';
  return `a_${createHash('sha256')
    .update(terminalEntries.map((entry) => `${entry.id}:${entry.status}`).join('|'))
    .digest('hex')
    .slice(0, 24)}`;
}

function deterministicRefundId(
  orderId: string,
  processedRefundVersion: string,
  requestGeneration: string,
) {
  return `refund_${createHash('sha256')
    .update(`${orderId}:${processedRefundVersion}:${requestGeneration}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function deterministicRefundOutboxId(refund: any) {
  return `refund_process_${createHash('sha256')
    .update(
      `${refund.id}:${refund.orderId}:${refund.processedRefundVersion}:${refund.requestGeneration}`,
    )
    .digest('hex')
    .slice(0, 40)}`;
}

function sameRefundRequest(existing: any, expected: any): boolean {
  return (
    existing.orderId === expected.orderId &&
    existing.amountPaise === expected.amountPaise &&
    existing.reason === expected.reason &&
    existing.source === expected.source &&
    existing.requestedBy?.uid === expected.requestedBy.uid &&
    existing.processedRefundVersion === expected.processedRefundVersion &&
    existing.requestGeneration === expected.requestGeneration
  );
}

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
      const normalizedReason = reason.trim();
      const requestedAmountPaise = amount === null ? null : rupeesToPaiseExact(amount);
      if (amount !== null && requestedAmountPaise === null) {
        return reply.status(400).send({
          error: 'Refund amount must be positive and have at most two decimal places',
          code: 'INVALID_REFUND_AMOUNT',
        });
      }

      try {
        const outcome = await fastify.db.runTransaction(async (transaction: any) => {
          const orderRef = fastify.db.collection(ORDERS_COL).doc(orderId);
          const orderDoc = await transaction.get(orderRef);
          if (!orderDoc.exists) requestError(404, 'ORDER_NOT_FOUND', 'Order not found');
          const order = { id: orderDoc.id, ...orderDoc.data() } as any;
          const actorRole = String(requestedBy.role || '').toLowerCase();
          const isAdmin = ADMIN_ROLES.has(actorRole);
          const isOwner =
            order.userId === requestedBy.uid || order.customerId === requestedBy.uid;
          if (!isAdmin && !isOwner) {
            requestError(403, 'REFUND_NOT_OWNER', 'You can only refund your own order');
          }

          const refundQuery = fastify.db.collection(REFUNDS_COL).where('orderId', '==', orderId);
          const refundSnapshot = await transaction.get(refundQuery);
          const refundDocs = refundSnapshot.docs || [];
          const paymentId = resolveOriginalPaymentId(order);
          const paymentQuery = fastify.db
            .collection('payments')
            .where('razorpayPaymentId', '==', paymentId)
            .limit(2);
          const paymentSnapshot = await transaction.get(paymentQuery);
          if (paymentSnapshot.docs?.length !== 1) {
            requestError(409, 'PAYMENT_EVIDENCE_MISSING', 'Verified payment evidence is ambiguous');
          }
          const capturedAmountPaise = resolveCapturedAmountPaise(
            order,
            paymentSnapshot.docs[0].data(),
            paymentId,
          );
          const processed = processedRefundSummary(order, refundDocs);
          const requestGeneration = refundRequestGeneration(refundDocs);
          const validation = validateRefundRequest({
            actor: { uid: requestedBy.uid, role: actorRole },
            order: {
              userId: order.userId,
              customerId: order.customerId,
              capturedAmountMinor: capturedAmountPaise,
              processedRefundAmountMinor: processed.amountPaise,
            },
            requestedAmountMinor: requestedAmountPaise,
          });
          if (!validation.valid) {
            const statusCode = validation.code === 'REFUND_NOT_OWNER' ? 403 : 400;
            requestError(statusCode, validation.code, 'Refund request is invalid');
          }

          const id = deterministicRefundId(orderId, processed.version, requestGeneration);
          const source = isAdmin ? 'admin' : 'user';
          const now = new Date().toISOString();
          const refundRequest: any = {
            id,
            orderId,
            eventId: order.eventId,
            customerId: order.customerId || order.userId,
            amount: validation.amountMinor / 100,
            amountPaise: validation.amountMinor,
            currency: 'INR',
            capturedAmountPaise,
            processedRefundAmountPaiseBefore: processed.amountPaise,
            remainingRefundableAmountPaiseBefore: validation.remainingRefundableAmountMinor,
            processedRefundVersion: processed.version,
            requestGeneration,
            orderStatusBeforeRequest: order.status,
            isPartial: validation.amountMinor < validation.remainingRefundableAmountMinor,
            reason: normalizedReason,
            source,
            requestedBy: {
              uid: requestedBy.uid,
              role: isAdmin ? actorRole : 'user',
            },
            status: 'requested',
            approvalStatus: 'pending',
            approvalType: validation.amountMinor < 500_000 ? 'single' : 'dual',
            approversRequired: validation.amountMinor < 500_000 ? 1 : 2,
            approvers: [],
            paymentDetails: { originalPaymentId: paymentId },
            idempotencyKey: `refund:${orderId}:${processed.version}:${requestGeneration}`,
            audit: {
              status: 'pending',
              idempotencyKey: `refund-request-audit:${id}`,
            },
            createdAt: now,
            updatedAt: now,
          };

          const refundRef = fastify.db.collection(REFUNDS_COL).doc(id);
          const deterministicDoc = await transaction.get(refundRef);
          const activeRequests = refundDocs.filter((doc: any) =>
            ACTIVE_REFUND_STATUSES.has(String(doc.data()?.status || '')),
          );
          if (deterministicDoc.exists) {
            const existing = { id: deterministicDoc.id, ...deterministicDoc.data() } as any;
            if (
              ACTIVE_REFUND_STATUSES.has(String(existing.status || '')) &&
              sameRefundRequest(existing, refundRequest) &&
              order.status === 'refund_requested' &&
              order.refundRequestId === id
            ) {
              return { created: false, replayed: true, refundRequest: existing };
            }
            requestError(409, 'ACTIVE_REFUND_CONFLICT', 'An active refund request already exists');
          }
          if (activeRequests.length > 0) {
            requestError(409, 'ACTIVE_REFUND_CONFLICT', 'An active refund request already exists');
          }
          if (!['confirmed', 'checked_in'].includes(order.status)) {
            requestError(400, 'ORDER_NOT_REFUNDABLE', 'Order is not in a refundable state');
          }

          transaction.set(refundRef, refundRequest);
          transaction.update(orderRef, {
            status: 'refund_requested',
            refundRequestId: id,
            refundRequestVersion: processed.version,
            refundRequestGeneration: requestGeneration,
            updatedAt: now,
          });
          return { created: true, replayed: false, refundRequest };
        });

        let auditRecorded = outcome.refundRequest.audit?.status === 'recorded';
        if (outcome.created && !auditRecorded) {
          try {
            await fastify.writeAuditLog({
              action: 'refund.request',
              actorUid: requestedBy.uid,
              actorRole: requestedBy.role || null,
              entityType: 'order',
              entityId: orderId,
              requestId: request.id,
              payload: {
                refundId: outcome.refundRequest.id,
                auditIdempotencyKey: outcome.refundRequest.audit?.idempotencyKey,
                amountPaise: outcome.refundRequest.amountPaise,
                autoApproved: false,
                ip: request.ip,
              },
            });
            auditRecorded = true;

            try {
              await fastify.db.runTransaction(async (transaction: any) => {
                const refundRef = fastify.db
                  .collection(REFUNDS_COL)
                  .doc(outcome.refundRequest.id);
                const refundDoc = await transaction.get(refundRef);
                if (!refundDoc.exists) return;
                transaction.update(refundRef, {
                  audit: {
                    status: 'recorded',
                    idempotencyKey: outcome.refundRequest.audit?.idempotencyKey,
                    recordedAt: new Date().toISOString(),
                  },
                });
              });
              outcome.refundRequest.audit = {
                ...outcome.refundRequest.audit,
                status: 'recorded',
              };
            } catch (markerError: any) {
              fastify.log.error(
                { refundId: outcome.refundRequest.id, error: markerError.message },
                'Refund audit marker update failed',
              );
            }
          } catch (auditError: any) {
            fastify.log.error(
              { refundId: outcome.refundRequest.id, error: auditError.message },
              'Refund request committed but audit log write failed',
            );
          }
        }

        return {
          success: true,
          refundRequest: outcome.refundRequest,
          autoApproved: false,
          replayed: outcome.replayed,
          auditRecorded,
        };
      } catch (error: any) {
        if (error instanceof RefundRequestError) {
          return reply.status(error.statusCode).send({ error: error.message, code: error.code });
        }
        fastify.log.error(`Refund request failed: ${error.message}`);
        return reply.status(500).send({ error: 'Internal server error' });
      }
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
      let q: any = fastify.db
        .collection(REFUNDS_COL)
        .where('status', 'in', ['requested', 'pending']);
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
      const { action } = request.body;
      const reason = String(request.body.reason || '').trim();
      const actor = request.user;
      const actorRole = String(actor?.role || '').toLowerCase();
      if (!actor || !ADMIN_ROLES.has(actorRole)) {
        return reply.status(403).send({ error: 'Only admins can respond to refunds' });
      }
      if (action === 'reject' && !reason) {
        return reply.status(400).send({
          error: 'A rejection reason is required',
          code: 'REFUND_REJECTION_REASON_REQUIRED',
        });
      }

      try {
        const outcome = await fastify.db.runTransaction(async (transaction: any) => {
          const refundRef = fastify.db.collection(REFUNDS_COL).doc(id);
          const refundDoc = await transaction.get(refundRef);
          if (!refundDoc.exists) requestError(404, 'REFUND_NOT_FOUND', 'Refund not found');
          const refund = { id: refundDoc.id, ...refundDoc.data() } as any;

          if (refund.status !== 'requested' || refund.approvalStatus !== 'pending') {
            requestError(
              409,
              'ILLEGAL_REFUND_TRANSITION',
              `Refund is already ${refund.status || 'in an unknown state'}`,
            );
          }
          const approversRequired = Number(refund.approversRequired);
          const expectedApprovers = refund.approvalType === 'dual' ? 2 : 1;
          if (
            !['single', 'dual'].includes(refund.approvalType) ||
            ![1, 2].includes(approversRequired) ||
            expectedApprovers !== approversRequired ||
            !Array.isArray(refund.approvers) ||
            !Number.isSafeInteger(refund.amountPaise) ||
            refund.amountPaise <= 0 ||
            !/^pay_[A-Za-z0-9_-]+$/.test(
              String(refund.paymentDetails?.originalPaymentId || ''),
            ) ||
            !['confirmed', 'checked_in'].includes(refund.orderStatusBeforeRequest) ||
            typeof refund.processedRefundVersion !== 'string' ||
            typeof refund.requestGeneration !== 'string'
          ) {
            requestError(409, 'REFUND_DATA_INCONSISTENT', 'Refund approval data is inconsistent');
          }
          const approvers = refund.approvers as Array<{ uid: string; role: string; at: string }>;
          const uniqueApproverIds = new Set(approvers.map((entry) => entry.uid));
          if (
            uniqueApproverIds.size !== approvers.length ||
            approvers.length >= approversRequired ||
            approvers.some(
              (entry) =>
                !entry.uid ||
                !ADMIN_ROLES.has(String(entry.role || '').toLowerCase()) ||
                typeof entry.at !== 'string',
            )
          ) {
            requestError(409, 'REFUND_DATA_INCONSISTENT', 'Refund approvals are inconsistent');
          }

          const orderRef = fastify.db.collection(ORDERS_COL).doc(refund.orderId);
          const orderDoc = await transaction.get(orderRef);
          if (!orderDoc.exists) {
            requestError(409, 'ORDER_REFUND_POINTER_MISMATCH', 'Refund order is unavailable');
          }
          const order = { id: orderDoc.id, ...orderDoc.data() } as any;
          if (
            order.status !== 'refund_requested' ||
            order.refundRequestId !== id ||
            order.refundRequestVersion !== refund.processedRefundVersion ||
            order.refundRequestGeneration !== refund.requestGeneration
          ) {
            requestError(
              409,
              'ORDER_REFUND_POINTER_MISMATCH',
              'Order no longer points at this active refund',
            );
          }

          const outboxId = deterministicRefundOutboxId(refund);
          const outboxRef = fastify.db.collection('refund_provider_outbox').doc(outboxId);
          const outboxDoc = await transaction.get(outboxRef);
          if (outboxDoc.exists) {
            requestError(
              409,
              'REFUND_PROVIDER_JOB_CONFLICT',
              'Refund provider processing is already queued',
            );
          }

          const now = new Date().toISOString();
          if (action === 'reject') {
            const transition = decideRefundTransition('requested', 'rejected');
            if (!transition.allowed) {
              requestError(409, transition.code, 'Refund cannot be rejected from this state');
            }
            const auditKey = `rejection_${actor.uid}`;
            const auditMarker = {
              status: 'pending',
              idempotencyKey: `refund-action-audit:${id}:${auditKey}`,
            };
            transaction.update(refundRef, {
              status: transition.to,
              approvalStatus: 'rejected',
              rejectionReason: reason,
              rejectedAt: now,
              rejectedBy: { uid: actor.uid, role: actorRole },
              actionAudits: { ...(refund.actionAudits || {}), [auditKey]: auditMarker },
              updatedAt: now,
            });
            transaction.update(orderRef, {
              status: refund.orderStatusBeforeRequest,
              refundRequestId: null,
              refundRequestVersion: null,
              refundRequestGeneration: null,
              updatedAt: now,
            });
            return {
              action,
              auditKey,
              auditMarker,
              orderId: refund.orderId,
              amountPaise: refund.amountPaise,
              status: transition.to,
              fullyApproved: false,
              approvalsCollected: approvers.length,
              approversRequired,
              outboxJobId: null,
              orderRestored: true,
            };
          }

          if (refund.requestedBy?.uid === actor.uid) {
            requestError(
              403,
              'SELF_APPROVAL_FORBIDDEN',
              'Requester cannot approve their own refund',
            );
          }
          if (uniqueApproverIds.has(actor.uid)) {
            requestError(409, 'DUPLICATE_REFUND_APPROVAL', 'Admin has already approved this refund');
          }

          const nextApprovers = [
            ...approvers,
            { uid: actor.uid, role: actorRole, at: now },
          ];
          const fullyApproved = nextApprovers.length === approversRequired;
          const auditKey = `approval_${nextApprovers.length}_${actor.uid}`;
          const auditMarker = {
            status: 'pending',
            idempotencyKey: `refund-action-audit:${id}:${auditKey}`,
          };
          const actionAudits = { ...(refund.actionAudits || {}), [auditKey]: auditMarker };

          if (!fullyApproved) {
            transaction.update(refundRef, {
              approvers: nextApprovers,
              actionAudits,
              updatedAt: now,
            });
            return {
              action,
              auditKey,
              auditMarker,
              orderId: refund.orderId,
              amountPaise: refund.amountPaise,
              status: 'requested',
              fullyApproved: false,
              approvalsCollected: nextApprovers.length,
              approversRequired,
              outboxJobId: null,
              orderRestored: false,
            };
          }

          const transition = decideRefundTransition('requested', 'approved');
          if (!transition.allowed) {
            requestError(409, transition.code, 'Refund cannot be approved from this state');
          }
          const providerIdempotencyKey = `razorpay-refund:${id}`;
          transaction.update(refundRef, {
            status: transition.to,
            approvalStatus: 'approved',
            approvers: nextApprovers,
            approvedAt: now,
            providerOutboxJobId: outboxId,
            actionAudits,
            updatedAt: now,
          });
          transaction.set(outboxRef, {
            id: outboxId,
            type: 'razorpay_refund_process',
            status: 'pending',
            refundId: id,
            orderId: refund.orderId,
            paymentId: refund.paymentDetails?.originalPaymentId,
            amountPaise: refund.amountPaise,
            currency: refund.currency || 'INR',
            providerIdempotencyKey,
            approvals: nextApprovers,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
          return {
            action,
            auditKey,
            auditMarker,
            orderId: refund.orderId,
            amountPaise: refund.amountPaise,
            status: transition.to,
            fullyApproved: true,
            approvalsCollected: nextApprovers.length,
            approversRequired,
            outboxJobId: outboxId,
            orderRestored: false,
          };
        });

        let auditRecorded = false;
        try {
          await fastify.writeAuditLog({
            action: `refund.${action}`,
            actorUid: actor.uid,
            actorRole,
            entityType: 'refund',
            entityId: id,
            requestId: request.id,
            payload: {
              orderId: outcome.orderId,
              amountPaise: outcome.amountPaise,
              reason,
              fullyApproved: outcome.fullyApproved,
              outboxJobId: outcome.outboxJobId,
              auditIdempotencyKey: outcome.auditMarker.idempotencyKey,
              ip: request.ip,
            },
          });
          auditRecorded = true;

          try {
            await fastify.db.runTransaction(async (transaction: any) => {
              const refundRef = fastify.db.collection(REFUNDS_COL).doc(id);
              const refundDoc = await transaction.get(refundRef);
              if (!refundDoc.exists) return;
              const refund = refundDoc.data() as any;
              transaction.update(refundRef, {
                actionAudits: {
                  ...(refund.actionAudits || {}),
                  [outcome.auditKey]: {
                    ...outcome.auditMarker,
                    status: 'recorded',
                    recordedAt: new Date().toISOString(),
                  },
                },
              });
            });
          } catch (markerError: any) {
            fastify.log.error(
              { refundId: id, auditKey: outcome.auditKey, error: markerError.message },
              'Refund action audit marker update failed',
            );
          }
        } catch (auditError: any) {
          fastify.log.error(
            { refundId: id, auditKey: outcome.auditKey, error: auditError.message },
            'Refund action committed but audit log write failed',
          );
        }

        return { success: true, ...outcome, auditRecorded };
      } catch (error: any) {
        if (error instanceof RefundRequestError) {
          return reply.status(error.statusCode).send({ error: error.message, code: error.code });
        }
        fastify.log.error(`Refund action failed: ${error.message}`);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );
}

import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import { z } from 'zod';
// @ts-ignore
import { flagPaymentFailure } from '@c1rcle/core/surge';
import { logPaymentEvent } from '../../lib/securityLogger';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const PaymentOrderBody = z
  .object({
    orderId: z.string(),
  })
  .strict();

const PaymentVerifyBody = z
  .object({
    orderId: z.string(),
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
  })
  .strict();

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

function getRazorpayKeySecret() {
  return process.env.RAZORPAY_KEY_SECRET;
}

function getRazorpayWebhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function allowMockRazorpay() {
  return !isProductionRuntime() && process.env.C1RCLE_ALLOW_MOCK_RAZORPAY === 'true';
}

function isMockRazorpayPayload(orderId: string, paymentId: string, signature: string) {
  return (
    orderId.startsWith('order_mock_') ||
    paymentId.startsWith('pay_mock_') ||
    signature.startsWith('sig_mock_')
  );
}

function getPaymentConfig() {
  return {
    key: getRazorpayKeyId() || 'rzp_test_DEVELOPMENT',
    currency: 'INR',
    name: 'THE C1RCLE',
    description: 'Event Tickets',
    theme: { color: '#1d1d1f' },
  };
}

function buildWebhookRawBody(request: any): string {
  if (request.rawBody) return request.rawBody;
  if (typeof request.body === 'string') return request.body;
  if (Buffer.isBuffer(request.body)) return request.body.toString('utf8');
  return JSON.stringify(request.body || {});
}

/**
 * Constant-time comparison of two hex signatures. Returns false on any length
 * mismatch instead of letting timingSafeEqual throw, and avoids the early-exit
 * timing leak of `!==`.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: any, body, done) => {
      _req.rawBody = (body as Buffer).toString('utf8');
      try {
        done(null, JSON.parse(_req.rawBody));
      } catch (err: any) {
        done(err, undefined);
      }
    },
  );

  /**
   * GET /api/v1/payments/config
   * Get Razorpay client configuration
   */
  fastify.get('/payments/config', async (_request, _reply) => {
    return buildSuccessResponse({ config: getPaymentConfig() });
  });

  /**
   * POST /api/v1/payments/order
   * Create a Razorpay order from a pending system order
   */
  fastify.post(
    '/payments/order',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: PaymentOrderBody })],
    },
    async (request: { body: any; user: any }, reply) => {
      const { orderId } = request.body;
      const userId = request.user?.uid;

      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: (request as any).id,
          }),
        );

      const idempotencyKey = (request as any).headers['x-idempotency-key'] as string;

      try {
        const work = async () => {
          const result = await (fastify as any).checkoutService.preparePayment(orderId, userId, {
            keyId: getRazorpayKeyId(),
            keySecret: getRazorpayKeySecret(),
            allowMockPayment: allowMockRazorpay(),
          });
          return {
            success: true,
            ...result,
            config: getPaymentConfig(),
          };
        };

        let result;
        if (idempotencyKey && (fastify as any).idempotencyService?.executeOnce) {
          result = await (fastify as any).idempotencyService.executeOnce(
            idempotencyKey,
            userId,
            work,
          );
          if (result.cached) return result.body;
        } else {
          result = await work();
        }

        logPaymentEvent(request as any, 'PAYMENT_ORDER_CREATED', {
          orderId,
          userId,
          razorpayOrderId: result?.razorpayOrderId,
        });
        return result;
      } catch (error: any) {
        fastify.log.error(`Payment order failed: ${error.message}`);
        const status =
          error.message === 'Forbidden'
            ? 403
            : error.message === 'Order not found'
              ? 404
              : error.message === 'Order is already confirmed'
                ? 409
                : error.message?.startsWith('Order is ')
                  ? 409
                  : 500;
        return reply.status(status).send(
          buildErrorResponse({
            code:
              status === 403
                ? 'FORBIDDEN'
                : status === 404
                  ? 'NOT_FOUND'
                  : status === 409
                    ? 'CONFLICT'
                    : 'INTERNAL_ERROR',
            message: error.message || 'Payment processing failed',
            requestId: (request as any).id,
          }),
        );
      }
    },
  );

  /**
   * PATCH /api/v1/payments/verify
   * Verify payment and confirm order
   */
  fastify.patch(
    '/payments/verify',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: PaymentVerifyBody })],
    },
    async (request: { body: any; user: any }, reply) => {
      const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;
      const userId = request.user?.uid;

      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: (request as any).id,
          }),
        );

      const idempotencyKey =
        ((request as any).headers['x-idempotency-key'] as string) ||
        `verify:${razorpay_payment_id}`;

      try {
        const work = async () => {
          // Reject mock payment IDs in production
          const isMockPayload = isMockRazorpayPayload(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
          );
          if (process.env.NODE_ENV === 'production' && isMockPayload) {
            throw new Error('Mock payments are disabled');
          }

          // Verify Signature — required; 503 if key unavailable
          const razorpayKeySecret = getRazorpayKeySecret();
          if (!razorpayKeySecret && !isMockPayload) {
            throw new Error('Payment verification is not configured');
          }

          if (razorpayKeySecret && !isMockPayload) {
            const data = `${razorpay_order_id}|${razorpay_payment_id}`;
            const expected = crypto
              .createHmac('sha256', razorpayKeySecret)
              .update(data)
              .digest('hex');
            if (!timingSafeEqualHex(expected, razorpay_signature)) {
              logPaymentEvent(request as any, 'SIGNATURE_MISMATCH', {
                orderId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
              });
              throw new Error('Invalid signature');
            }
          }

          // Atomic Confirmation via Service
          const result = await (fastify as any).checkoutService.verifyPayment({
            orderId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            userId,
            paymentGatewayConfig: {
              keyId: getRazorpayKeyId(),
              keySecret: getRazorpayKeySecret(),
              allowMockPayment: allowMockRazorpay(),
            },
          });

          if (result?.success === false) {
            const verificationError = new Error(result.error || 'Payment verification failed');
            (verificationError as any).code = 'PAYMENT_VERIFICATION_REJECTED';
            (verificationError as any).payload = result;
            throw verificationError;
          }

          return {
            success: true,
            alreadyConfirmed: Boolean(result?.alreadyConfirmed),
            order: result?.order || null,
            message: result?.alreadyConfirmed ? 'Order already confirmed' : 'Order confirmed',
          };
        };

        let finalResult;
        if (idempotencyKey && (fastify as any).idempotencyService?.executeOnce) {
          finalResult = await (fastify as any).idempotencyService.executeOnce(
            idempotencyKey,
            userId,
            work,
          );
          if (finalResult.cached) return finalResult.body;
        } else {
          finalResult = await work();
        }

        logPaymentEvent(
          request as any,
          finalResult?.alreadyConfirmed ? 'PAYMENT_VERIFY_DUPLICATE' : 'PAYMENT_VERIFIED',
          {
            orderId,
            userId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
          },
        );

        return finalResult;
      } catch (error: any) {
        fastify.log.error(`Payment verification failed: ${error.message}`);
        if ((error as any).code === 'PAYMENT_VERIFICATION_REJECTED') {
          return reply.status(409).send((error as any).payload);
        }
        const status =
          error.message === 'Order not found'
            ? 404
            : error.message === 'Unauthorized'
              ? 403
              : error.message === 'Invalid signature'
                ? 400
                : error.message === 'Payment order not found'
                  ? 404
                  : error.message === 'Payment amount mismatch'
                    ? 409
                    : error.message === 'Payment does not belong to this Razorpay order'
                      ? 409
                      : error.message === 'Payment already linked to another order'
                        ? 409
                        : error.message === 'Payment is not successful'
                          ? 409
                          : error.message === 'Mock payments are disabled'
                            ? 400
                            : 500;
        return reply.status(status).send(
          buildErrorResponse({
            code:
              status === 404
                ? 'NOT_FOUND'
                : status === 403
                  ? 'FORBIDDEN'
                  : status === 400
                    ? 'BAD_REQUEST'
                    : status === 409
                      ? 'CONFLICT'
                      : 'INTERNAL_ERROR',
            message: error.message || 'Internal server error',
            requestId: (request as any).id,
          }),
        );
      }
    },
  );

  fastify.post('/payments/webhook', async (request: any, reply) => {
    const rawBody = buildWebhookRawBody(request);
    const signature = request.headers['x-razorpay-signature'] as string | undefined;

    const webhookSecret = getRazorpayWebhookSecret();
    if (!webhookSecret) {
      fastify.log.error('RAZORPAY_WEBHOOK_SECRET is not configured');
      return reply
        .status(500)
        .send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Webhook not configured' }));
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!signature || !timingSafeEqualHex(expected, signature)) {
      logPaymentEvent(request, 'SIGNATURE_MISMATCH', {});
      return reply
        .status(401)
        .send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Invalid signature' }));
    }

    let payload: any;
    try {
      payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    } catch {
      return reply
        .status(400)
        .send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'Invalid payload' }));
    }

    const eventType = payload?.event || payload?.type;
    const paymentEntity = payload?.payload?.payment?.entity || payload?.payment || payload;
    const paymentId = paymentEntity?.id || null;
    const orderId = paymentEntity?.notes?.orderId || payload?.orderId || null;
    const razorpayOrderId = paymentEntity?.order_id || payload?.razorpay_order_id || null;

    try {
      if (
        (eventType === 'payment.captured' || eventType === 'payment_success') &&
        orderId &&
        razorpayOrderId &&
        paymentId
      ) {
        const result = await fastify.checkoutService.verifyPayment({
          orderId,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
          userId: null,
          paymentGatewayConfig: {
            keyId: getRazorpayKeyId(),
            keySecret: getRazorpayKeySecret(),
            allowMockPayment: allowMockRazorpay(),
          },
        });

        if (result?.success === false) {
          logPaymentEvent(request, 'WEBHOOK_REJECTED', {
            orderId,
            razorpayOrderId,
            razorpayPaymentId: paymentId,
            eventType,
            reason: result.error || 'verification_rejected',
          });

          return {
            success: false,
            handled: true,
            orderId,
            reason: result.error || 'verification_rejected',
          };
        }

        logPaymentEvent(
          request,
          result?.alreadyConfirmed ? 'WEBHOOK_DUPLICATE' : 'WEBHOOK_CONFIRMED',
          {
            orderId,
            razorpayOrderId,
            razorpayPaymentId: paymentId,
            eventType,
          },
        );

        if (!result?.alreadyConfirmed && result?.eventId) {
          fastify.broadcast(
            {
              type: 'ORDER_CONFIRMED',
              payload: { orderId, eventId: result.eventId },
            },
            `event:${result.eventId}`,
          );
        }

        return {
          success: true,
          alreadyConfirmed: Boolean(result?.alreadyConfirmed),
          orderId,
        };
      }

      if (eventType === 'payment.failed' && orderId) {
        const order = await (fastify as any).orderRepo.getOrderById(orderId);
        if (order) {
          await (fastify as any).checkoutService.recordPaymentFailure(
            orderId,
            razorpayOrderId,
            paymentId,
          );

          if (
            (order.status === 'payment_pending' || order.status === 'pending_payment') &&
            order.queueId
          ) {
            await flagPaymentFailure(fastify.db, order.queueId);
          }
        }

        logPaymentEvent(request, 'PAYMENT_FAILED', {
          orderId,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
          eventType,
        });

        return { success: true, orderId, status: 'payment_pending' };
      }

      const refundEntity = payload?.payload?.refund?.entity || payload?.refund || null;

      if ((eventType === 'refund.processed' || eventType === 'refund.failed') && refundEntity?.id) {
        const refundsSnap = await fastify.db
          .collection('refund_requests')
          .where('razorpayRefundId', '==', refundEntity.id)
          .limit(1)
          .get();

        if (refundsSnap.empty) {
          fastify.log.warn(`Webhook ${eventType} received for unknown refund ${refundEntity.id}`);
          return { success: true, ignored: true, reason: 'refund_not_found' };
        }

        const refundDoc = refundsSnap.docs[0];
        const refundData = refundDoc.data() as any;
        const now = new Date().toISOString();

        if (eventType === 'refund.processed') {
          if (refundData.status !== 'completed') {
            await fastify.db.runTransaction(async (t: any) => {
              t.update(refundDoc.ref, { status: 'completed', updatedAt: now });
              t.update(fastify.db.collection('orders').doc(refundData.orderId), {
                refundStatus: 'completed',
                updatedAt: now,
              });
            });
          }
        } else if (refundData.status !== 'failed') {
          const previousStatus = refundData.previousStatus || 'confirmed';
          const orderUpdate: any = { refundStatus: 'failed', updatedAt: now };
          if (refundData.fullyRefunded) {
            orderUpdate.status = previousStatus;
          }
          await fastify.db.runTransaction(async (t: any) => {
            t.update(refundDoc.ref, {
              status: 'failed',
              failureReason: 'Razorpay reported refund.failed',
              updatedAt: now,
            });
            t.update(fastify.db.collection('orders').doc(refundData.orderId), orderUpdate);
          });
        }

        logPaymentEvent(request, `WEBHOOK_${eventType.toUpperCase().replace('.', '_')}`, {
          orderId: refundData.orderId,
          razorpayRefundId: refundEntity.id,
          eventType,
        });

        return { success: true, orderId: refundData.orderId, eventType };
      }

      const payoutEntity = payload?.payload?.payout?.entity || payload?.payout || null;

      if (eventType === 'payout.processed' && payoutEntity) {
        const requestId = payoutEntity.reference_id || payoutEntity.notes?.payoutRequestId;
        if (!requestId) {
          fastify.log.warn('Webhook payout.processed received but missing requestId');
          return { success: true, ignored: true, reason: 'missing_request_id' };
        }

        const ref = fastify.db.collection('payout_requests').doc(requestId);

        // Transaction so two concurrent payout.processed deliveries can't both
        // pass the status check and double-write the ledger.
        const payoutResult = await fastify.db.runTransaction(async (t: any) => {
          const snap = await t.get(ref);
          if (!snap.exists) {
            return { success: true, ignored: true, reason: 'payout_request_not_found' };
          }
          const data = snap.data() as any;
          if (data.status === 'completed') {
            return { success: true, alreadyProcessed: true };
          }

          t.update(ref, { status: 'completed', completedAt: new Date().toISOString() });

          const ledgerRef = fastify.db.collection('partner_ledger').doc();
          t.set(ledgerRef, {
            toPartnerId: data.promoterId,
            type: 'payout',
            amount: -data.amountPaise,
            currency: 'INR',
            status: 'settled',
            referenceId: requestId,
            createdAt: new Date().toISOString(),
          });

          const auditRef = fastify.db.collection('promoter_audit_logs').doc();
          t.set(auditRef, {
            promoterId: data.promoterId,
            action: 'PAYOUT_PROCESSED',
            targetId: requestId,
            amountPaise: data.amountPaise,
            timestamp: new Date().toISOString(),
            performedBy: 'system_webhook',
          });

          return { success: true, requestId, status: 'completed' };
        });

        return payoutResult;
      }

      if ((eventType === 'payout.failed' || eventType === 'payout.reversed') && payoutEntity) {
        const requestId = payoutEntity.reference_id || payoutEntity.notes?.payoutRequestId;
        if (!requestId) return { success: true, ignored: true };

        const ref = fastify.db.collection('payout_requests').doc(requestId);
        const doc = await ref.get();
        if (doc.exists && (doc.data() as any).status !== 'failed') {
          const batch = fastify.db.batch();
          batch.update(ref, { status: 'failed', failedAt: new Date().toISOString() });

          const auditRef = fastify.db.collection('promoter_audit_logs').doc();
          batch.set(auditRef, {
            promoterId: (doc.data() as any).promoterId,
            action: 'PAYOUT_FAILED',
            targetId: requestId,
            amountPaise: (doc.data() as any).amountPaise,
            timestamp: new Date().toISOString(),
            performedBy: 'system_webhook',
          });

          await batch.commit();
        }
        return { success: true, requestId, status: 'failed' };
      }

      return { success: true, ignored: true, eventType };
    } catch (error: any) {
      fastify.log.error(`Payment webhook failed: ${error.message}`);
      return reply
        .status(500)
        .send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error' }));
    }
  });
}

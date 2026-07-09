import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import { z } from 'zod';
// @ts-ignore
import { flagPaymentFailure } from '@c1rcle/core/surge';
// @ts-ignore
import { verifyCheckoutPayment } from '@c1rcle/core/workflows/ticketing';
// @ts-ignore
import { finalizeRazorpayTicketPurchase } from '@c1rcle/core/ticket-checkout-wallet-service';
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
          const result = await verifyCheckoutPayment({
            db: fastify.db,
            userId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paymentGatewayConfig: {
              keySecret: getRazorpayKeySecret(),
              allowMockPayment: allowMockRazorpay(),
            },
          });

          if (result?.order?.id && result.order.id !== orderId) {
            const verificationError = new Error('Payment order mismatch');
            (verificationError as any).code = 'CONFLICT';
            throw verificationError;
          }

          return {
            success: true,
            alreadyConfirmed: Boolean(result?.alreadyVerified),
            alreadyVerified: Boolean(result?.alreadyVerified),
            order: result?.order || null,
            tickets: result?.tickets || [],
            ticketsCount: result?.ticketsCount || 0,
            razorpayOrderId: result?.razorpayOrderId || razorpay_order_id,
            razorpayPaymentId: result?.razorpayPaymentId || razorpay_payment_id,
            chatUnlocked: Boolean(result?.chatUnlocked),
            redisReleased: Boolean(result?.redisReleased),
            message: result?.alreadyVerified ? 'Order already confirmed' : 'Order confirmed',
          };
        };

        let finalResult;
        if (idempotencyKey && (fastify as any).idempotencyService?.executeOnce) {
          finalResult = await (fastify as any).idempotencyService.executeOnce(
            idempotencyKey,
            userId,
            work,
          );
          if (finalResult.cached) {
            reply.header('Deprecation', 'true');
            reply.header('Link', '</api/v1/checkout/verify>; rel="successor-version"');
            return finalResult.body;
          }
        } else {
          finalResult = await work();
        }

        logPaymentEvent(
          request as any,
          finalResult?.alreadyVerified ? 'PAYMENT_VERIFY_DUPLICATE' : 'PAYMENT_VERIFIED',
          {
            orderId,
            userId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
          },
        );

        reply.header('Deprecation', 'true');
        reply.header('Link', '</api/v1/checkout/verify>; rel="successor-version"');
        return finalResult;
      } catch (error: any) {
        fastify.log.error(`Payment verification failed: ${error.message}`);
        let status = 500;
        if (error.code === 'UNAUTHORIZED') status = 401;
        else if (error.code === 'FORBIDDEN') status = 403;
        else if (error.code === 'NOT_FOUND' || error.message === 'Order not found') status = 404;
        else if (
          error.code === 'INVALID_SIGNATURE' ||
          error.code === 'BAD_REQUEST' ||
          error.message === 'Invalid signature' ||
          error.message === 'Mock payments are disabled'
        )
          status = 400;
        else if (
          error.code === 'CONFLICT' ||
          error.message === 'Payment amount mismatch' ||
          error.message === 'Payment does not belong to this Razorpay order' ||
          error.message === 'Payment already linked to another order' ||
          error.message === 'Payment is not successful'
        )
          status = 409;
        else if (error.message === 'Payment order not found') status = 404;
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
    if (!signature || expected !== signature) {
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
        const result = await finalizeRazorpayTicketPurchase({
          db: fastify.db,
          checkoutService: fastify.checkoutService,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
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

        const eventId = result?.order?.eventId || null;
        if (!result?.alreadyConfirmed && eventId) {
          fastify.broadcast(
            {
              type: 'ORDER_CONFIRMED',
              payload: { orderId, eventId },
            },
            `event:${eventId}`,
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

      const payoutEntity = payload?.payload?.payout?.entity || payload?.payout || null;

      if (eventType === 'payout.processed' && payoutEntity) {
        const requestId = payoutEntity.reference_id || payoutEntity.notes?.payoutRequestId;
        if (!requestId) {
          fastify.log.warn('Webhook payout.processed received but missing requestId');
          return { success: true, ignored: true, reason: 'missing_request_id' };
        }

        const ref = fastify.db.collection('payout_requests').doc(requestId);
        const doc = await ref.get();
        if (!doc.exists) {
          return { success: true, ignored: true, reason: 'payout_request_not_found' };
        }

        const data = doc.data() as any;
        if (data.status === 'completed') {
          return { success: true, alreadyProcessed: true };
        }

        const batch = fastify.db.batch();
        batch.update(ref, { status: 'completed', completedAt: new Date().toISOString() });

        const ledgerRef = fastify.db.collection('partner_ledger').doc();
        batch.set(ledgerRef, {
          toPartnerId: data.promoterId,
          type: 'payout',
          amount: -data.amountPaise,
          currency: 'INR',
          status: 'settled',
          referenceId: requestId,
          createdAt: new Date().toISOString(),
        });

        const auditRef = fastify.db.collection('promoter_audit_logs').doc();
        batch.set(auditRef, {
          promoterId: data.promoterId,
          action: 'PAYOUT_PROCESSED',
          targetId: requestId,
          amountPaise: data.amountPaise,
          timestamp: new Date().toISOString(),
          performedBy: 'system_webhook',
        });

        await batch.commit();
        return { success: true, requestId, status: 'completed' };
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

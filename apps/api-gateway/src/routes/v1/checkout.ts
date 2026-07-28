import { FastifyInstance } from 'fastify';
// @ts-ignore
import { validatePromoCode } from '@c1rcle/core/promo-service';
// @ts-ignore
import { calculatePricing, getEffectivePrice } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { flagPaymentFailure } from '@c1rcle/core/surge';
// @ts-ignore
import {
  calculateEffectiveInventory,
  releaseReservation,
  InventoryReadError,
  InventoryUnavailableError,
  LockAcquisitionError,
  ReservationCommitError,
} from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { verifyCheckoutPayment } from '@c1rcle/core/workflows/ticketing';
// @ts-ignore
import {
  finalizeRazorpayTicketPurchase,
  verifyRazorpayWebhookSignature,
} from '@c1rcle/core/ticket-checkout-wallet-service';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { enforcePublicRateLimit } from '../../utils/public-rate-limit';
import { publishTicketPurchaseSync } from '../../lib/ticketPurchaseSync';

function allowMockRazorpay() {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  return !isProduction && process.env.C1RCLE_ALLOW_MOCK_RAZORPAY === 'true';
}

function forceMockRazorpay() {
  return allowMockRazorpay() && process.env.C1RCLE_FORCE_MOCK_RAZORPAY === 'true';
}

function buildWebhookRawBody(request: any): string {
  if (request.rawBody) return request.rawBody;
  if (typeof request.body === 'string') return request.body;
  if (Buffer.isBuffer(request.body)) return request.body.toString('utf8');
  return JSON.stringify(request.body || {});
}

const CheckoutItem = z.object({
  tierId: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(100),
});

const GuestInput = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
  })
  .strict();

const CheckoutCalculateBody = z.object({
  eventId: z.string().min(1).max(64).optional(),
  reservationId: z.string().min(1).max(128).optional(),
  items: z.array(CheckoutItem).max(20).optional(),
  promoCode: z.string().min(2).max(50).optional().nullable(),
  promoterCode: z.string().min(2).max(50).optional().nullable(),
  linkId: z.string().min(1).max(128).optional().nullable(),
});

const CheckoutValidateBody = z
  .object({
    eventId: z.string().min(1).max(64),
    items: z.array(CheckoutItem).max(20).optional(),
  })
  .strict();

const CheckoutPromoBody = z
  .object({
    eventId: z.string().min(1).max(64),
    code: z.string().min(2).max(50),
    items: z.array(CheckoutItem).max(20).optional(),
  })
  .strict();

const CheckoutReserveBody = z
  .object({
    eventId: z.string().min(1).max(64),
    items: z.array(CheckoutItem).min(1).max(20),
    deviceId: z.string().max(128).optional(),
    admissionToken: z.string().max(256).optional(),
  })
  .strict();

const CheckoutIntentBody = z
  .object({
    eventId: z.string().min(1).max(64),
    tierId: z.string().min(1).max(64),
    quantity: z.number().int().positive().max(20),
  })
  .strict();

const CheckoutVerifyBody = z
  .object({
    razorpay_payment_id: z.string().min(1).max(128),
    razorpay_order_id: z.string().min(1).max(128),
    razorpay_signature: z.string().min(1).max(256),
  })
  .strict();

const CheckoutInitiateBody = z
  .object({
    eventId: z.string().min(1).max(64).optional(),
    items: z.array(CheckoutItem).max(20).optional(),
    reservationId: z.string().min(1).max(128).optional(),
    promoCode: z.string().min(2).max(50).optional().nullable(),
    promoterCode: z.string().min(2).max(50).optional().nullable(),
    linkId: z.string().min(1).max(128).optional().nullable(),
    deviceId: z.string().max(128).optional(),
    guestInputs: z.array(GuestInput).max(20).optional(),
    userId: z.string().max(128).optional(),
    userName: z.string().max(120).optional(),
    userEmail: z.string().email().max(254).optional(),
    userPhone: z.string().max(20).optional(),
    hostUpdatesOptIn: z.boolean().optional(),
  })
  .strict();

const CheckoutCancelBody = z
  .object({
    reservationId: z.string().optional(),
    orderId: z.string().optional(),
  })
  .strict();

const CheckoutFailureBody = z
  .object({
    admissionToken: z.string(),
  })
  .strict();

function extractQueueId(admissionToken?: string | null): string | null {
  if (!admissionToken) return null;
  const parts = String(admissionToken).split(':');
  if (parts.length !== 4) return null;
  return parts[2] || null;
}

async function buildCheckoutQuote(event: any, items: any[], pricing: any, db: any, redis: any) {
  const tiers = event.ticketCatalog?.tiers || event.tickets || [];
  const selectedByTier = new Map(
    (items || []).map((item: any) => [item.tierId, Number(item.quantity) || 0]),
  );
  const minTickets = event.isRSVP ? 1 : Number(event.minTicketsPerOrder || 1);
  const maxTickets = event.isRSVP ? 1 : Number(event.maxTicketsPerOrder || 10);
  const totalQuantity = [...selectedByTier.values()].reduce((sum, quantity) => sum + quantity, 0);
  const eventDocRef = db?.collection?.('events')?.doc?.(event.id);
  const inventoryDb = typeof eventDocRef?.collection === 'function' ? db : null;

  const tierConstraints = await Promise.all(
    tiers.map(async (tier: any) => {
      // Use the authoritative effective inventory — same source as reservation enforcement
      const available = await calculateEffectiveInventory(tier, event, null, inventoryDb);
      const isFree = Number(tier.basePrice ?? tier.price ?? 0) === 0;
      const perOrderLimit = isFree ? 1 : maxTickets;

      return {
        tierId: tier.id,
        name: tier.name || tier.label || tier.id,
        description: tier.description || tier.summary || null,
        selectedQuantity: selectedByTier.get(tier.id) || 0,
        available,
        minPerOrder: 0,
        maxPerOrder: Math.max(0, Math.min(available || perOrderLimit, perOrderLimit)),
        isFree,
        soldOut: available <= 0,
        unitPrice: getEffectivePrice(tier).price,
      };
    }),
  );

  return {
    pricing,
    constraints: {
      order: {
        minTickets,
        maxTickets,
        totalQuantity,
        canProceed: totalQuantity >= minTickets && totalQuantity <= maxTickets,
      },
      tiers: tierConstraints,
    },
    cta: {
      state:
        totalQuantity === 0
          ? 'empty'
          : totalQuantity < minTickets
            ? 'below_minimum'
            : totalQuantity > maxTickets
              ? 'above_maximum'
              : pricing?.isFree
                ? 'issue'
                : 'pay',
      requiresPayment: !pricing?.isFree,
    },
  };
}

function isInventoryError(e: any): boolean {
  return (
    e instanceof InventoryReadError ||
    e instanceof InventoryUnavailableError ||
    e instanceof LockAcquisitionError ||
    e instanceof ReservationCommitError
  );
}

function buildReservationSnapshot(reservation: any) {
  if (!reservation?.id) return null;
  return {
    reservationId: reservation.id,
    eventId: reservation.eventId || null,
    expiresAt: reservation.expiresAt || null,
    status: reservation.status || null,
    items: Array.isArray(reservation.items) ? reservation.items : [],
  };
}

export default async function checkoutRoutes(fastify: FastifyInstance) {
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
   * Calculate server-side pricing (discounts, fees, grand total)
   * POST /checkout/calculate
   */
  fastify.post(
    '/checkout/calculate',
    {
      preHandler: [fastify.validate({ body: CheckoutCalculateBody })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user?.uid;
        await enforcePublicRateLimit(
          fastify,
          request,
          `checkout:calculate:${userId ?? 'anon'}`,
          30,
          60,
        );

        let { eventId, reservationId, items, promoCode = null, promoterCode = null } = request.body;
        let reservationSnapshot = null;

        // If reservationId provided, batch-load both reservation and event in parallel
        if (reservationId) {
          const resDoc = await fastify.db.collection('cart_reservations').doc(reservationId).get();
          if (!resDoc.exists)
            return reply.status(404).send({ success: false, error: 'Reservation not found' });
          const res = resDoc.data() as any;
          if (res.status !== 'active')
            return reply
              .status(400)
              .send({ success: false, error: `Reservation is ${res.status}` });
          if (new Date(res.expiresAt) < new Date())
            return reply.status(400).send({ success: false, error: 'Reservation has expired' });
          reservationSnapshot = buildReservationSnapshot({ id: resDoc.id, ...res });
          eventId = res.eventId;
          items = res.items;
        }

        if (!eventId)
          return reply.status(400).send({ success: false, error: 'eventId is required' });
        items = Array.isArray(items) ? items : [];

        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists)
          return reply.status(404).send({ success: false, error: 'Event not found' });
        const event = { id: eventDoc.id, ...eventDoc.data() };

        // Validate and resolve promoterCode against active links
        let resolvedLinkId: string | null = (request.body as any).linkId || null;
        if (promoterCode) {
          const linkSnap = await fastify.db
            .collection('promoter_links')
            .where('code', '==', promoterCode)
            .where('eventId', '==', eventId)
            .where('isActive', '==', true)
            .limit(1)
            .get()
            .catch(() => null);
          if (!linkSnap || linkSnap.empty) {
            // Invalid or inactive code — strip it silently, don't block checkout
            promoterCode = null;
            resolvedLinkId = null;
            fastify.log.info(
              { eventId, promoterCode: request.body.promoterCode },
              'Promoter code invalid/inactive — stripped from checkout',
            );
          } else {
            resolvedLinkId = resolvedLinkId || linkSnap.docs[0].id;
          }
        }

        const pricingResult = await calculatePricing({ event, items, promoCode, promoterCode });
        const pricing = pricingResult?.pricing || pricingResult;
        const quote = await buildCheckoutQuote(event, items, pricing, fastify.db, fastify.redis);
        return {
          success: true,
          pricing,
          quote,
          reservation: reservationSnapshot,
          linkId: resolvedLinkId,
        };
      } catch (error: any) {
        if (error.code === 'COVER_WALLET_UNFUNDED') {
          return reply.status(400).send({ success: false, code: error.code, error: error.message });
        }
        if (isInventoryError(error)) {
          fastify.log.warn(`Inventory service unavailable during calculate: ${error.message}`);
          reply.header('Retry-After', '5');
          return reply.status(503).send({
            success: false,
            error: 'Inventory service temporarily unavailable, please retry.',
          });
        }
        fastify.log.error(`Checkout calculate failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  /**
   * Validate pricing for a set of items
   * POST /checkout/validate
   */
  fastify.post(
    '/checkout/validate',
    {
      preHandler: [fastify.validate({ body: CheckoutValidateBody })],
    },
    async (request: any, reply) => {
      try {
        const workspaceId = request.workspaceId;
        const result = await fastify.checkoutService.validatePricing(request.body, workspaceId);
        return result;
      } catch (error: any) {
        fastify.log.error(`Pricing validation failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  /**
   * Validate Promo Code
   * POST /checkout/promo
   * Requires auth to prevent anonymous brute-forcing of promo codes.
   */
  fastify.post(
    '/checkout/promo',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutPromoBody })],
    },
    async (request: { body: any; user: any }, reply) => {
      const { eventId, code, items } = request.body;
      const userId = request.user?.uid || null;

      try {
        await enforcePublicRateLimit(
          fastify,
          request as any,
          `checkout:promo:${userId ?? 'anon'}:${eventId}`,
          10,
          60,
        );
        const priced = await fastify.checkoutService.validatePricing(
          {
            eventId,
            items: (items || []).map((item: any) => ({
              tierId: item.tierId,
              quantity: item.quantity,
            })),
          },
          (request as any).workspaceId || null,
        );

        const authoritativeItems = priced?.pricing?.items || [];
        const result = await validatePromoCode(eventId, code, userId, authoritativeItems);
        if (result.valid) {
          return {
            success: true,
            valid: true,
            discountAmount: result.discountAmount,
            label: result.message,
          };
        } else {
          return {
            success: true,
            valid: false,
            error: result.error || 'Invalid promo code',
          };
        }
      } catch (error: any) {
        fastify.log.error(`Promo validation failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    },
  );

  /**
   * Reserve Inventory
   * POST /checkout/reserve
   */
  fastify.post(
    '/checkout/reserve',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutReserveBody })],
    },
    async (request: any, reply) => {
      const { eventId, items, deviceId, admissionToken } = request.body;
      const userId = request.user?.uid;
      if (!userId) {
        return reply
          .status(401)
          .send({ success: false, error: 'Authentication required to reserve tickets' });
      }

      const idempotencyKey = request.headers['x-idempotency-key'] as string;

      try {
        await enforcePublicRateLimit(fastify, request, `checkout:reserve:${userId}`, 5, 60);

        const work = async () => {
          return await fastify.checkoutService.reserveItems({
            eventId,
            userId,
            deviceId: deviceId || null,
            items,
            workspaceId: request.workspaceId || null,
            options: { queueId: extractQueueId(admissionToken) },
          });
        };

        let result;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          result = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (result.cached) return result.body;
        } else {
          result = await work();
        }

        request.log.info(
          {
            eventId,
            userId,
            reservationId: result?.reservationId,
            workspaceId: request.workspaceId || null,
            queueId: extractQueueId(admissionToken),
          },
          'Checkout reservation created',
        );

        return result;
      } catch (error: any) {
        if (isInventoryError(error)) {
          fastify.log.warn(`Inventory service unavailable during reserve: ${error.message}`);
          reply.header('Retry-After', '5');
          return reply.status(503).send({
            success: false,
            error: 'Inventory service temporarily unavailable, please retry.',
          });
        }
        fastify.log.error(`Reservation failed: ${error.message}`);
        return reply.status(409).send({ success: false, error: 'Request conflict' });
      }
    },
  );

  /**
   * Create zero-trust payment intent
   * POST /checkout/intent
   */
  fastify.post(
    '/checkout/intent',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutIntentBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      const idempotencyKey = request.headers['x-idempotency-key'] as string;

      try {
        await enforcePublicRateLimit(fastify, request, `checkout:intent:${userId}`, 5, 60);

        const work = async () =>
          fastify.checkoutService.createCheckoutIntent({
            eventId: request.body.eventId,
            tierId: request.body.tierId,
            quantity: request.body.quantity,
            user: {
              id: userId,
              name: request.user?.displayName || request.user?.name || null,
              email: request.user?.email || null,
              phone: request.user?.phoneNumber || request.user?.phone || null,
            },
            deviceId: request.headers['user-agent'] || null,
            workspaceId: request.workspaceId || null,
            reservationMinutes: 5,
            paymentGatewayConfig: {
              keyId: process.env.RAZORPAY_KEY_ID,
              keySecret: process.env.RAZORPAY_KEY_SECRET,
              allowMockPayment: allowMockRazorpay(),
              forceMockPayment: forceMockRazorpay(),
            },
          });

        let result: any;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          result = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (result.cached) return result.body;
        } else {
          result = await work();
        }

        request.log.info(
          {
            eventId: request.body.eventId,
            tierId: request.body.tierId,
            quantity: request.body.quantity,
            orderId: result?.orderId,
            reservationId: result?.reservationId,
            userId,
          },
          'Checkout intent created',
        );

        return {
          success: true,
          razorpayOrderId: result.razorpayOrderId,
          amount: result.amount,
          amountPaise: result.amountPaise,
          currency: result.currency,
          expiresAt: result.expiresAt,
          orderId: result.orderId,
          reservationId: result.reservationId,
          key: result.key,
        };
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED') {
          reply.header('Retry-After', '60');
          return reply
            .status(429)
            .send({ success: false, error: 'Too many requests, please slow down.' });
        }

        if (error.code === 'SOLD_OUT') {
          return reply.status(409).send({ success: false, error: 'Sold Out' });
        }

        if (error.code === 'NOT_FOUND' || error.message === 'Event not found') {
          return reply.status(404).send({ success: false, error: 'Event not found' });
        }

        if (error.code === 'BAD_REQUEST' || error.code === 'COVER_WALLET_UNFUNDED') {
          return reply.status(400).send({ success: false, error: error.message });
        }

        if (error.code === 'FORBIDDEN') {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }

        if (isInventoryError(error)) {
          reply.header('Retry-After', '5');
          return reply.status(503).send({
            success: false,
            error: 'Inventory service temporarily unavailable, please retry.',
          });
        }

        fastify.log.error(`Checkout intent failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  /**
   * Razorpay server-to-server success webhook.
   * POST /checkout/webhook
   */
  fastify.post(
    '/checkout/webhook',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request: any, reply) => {
      const rawBody = buildWebhookRawBody(request);
      const signature = request.headers['x-razorpay-signature'] as string | undefined;

      try {
        verifyRazorpayWebhookSignature({
          rawBody,
          signature,
          webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
        });

        const payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
        const eventType = payload?.event || payload?.type;
        const paymentEntity = payload?.payload?.payment?.entity || payload?.payment || payload;
        const razorpayPaymentId = paymentEntity?.id || payload?.razorpay_payment_id || null;
        const razorpayOrderId = paymentEntity?.order_id || payload?.razorpay_order_id || null;

        if (eventType !== 'payment.captured' && eventType !== 'payment_success') {
          return { success: true, ignored: true, eventType };
        }

        if (!razorpayOrderId || !razorpayPaymentId) {
          return reply.status(400).send({
            success: false,
            error: 'Webhook missing Razorpay order or payment id',
          });
        }

        const result = await finalizeRazorpayTicketPurchase({
          db: fastify.db,
          requestId: request.id,
          razorpayOrderId,
          razorpayPaymentId,
          providerPayment: paymentEntity,
          paymentGatewayConfig: {
            keyId: process.env.RAZORPAY_KEY_ID,
            keySecret: process.env.RAZORPAY_KEY_SECRET,
            allowMockPayment: allowMockRazorpay(),
          },
        });
        await publishTicketPurchaseSync(fastify, result);

        request.log.info(
          {
            razorpayOrderId,
            razorpayPaymentId,
            orderId: result?.order?.id,
            ticketsCount: result?.ticketsCount,
            alreadyFinalized: result?.alreadyFinalized,
          },
          'Checkout webhook finalized tickets',
        );

        return {
          success: true,
          alreadyConfirmed: Boolean(result?.alreadyFinalized),
          alreadyFinalized: Boolean(result?.alreadyFinalized),
          orderId: result?.order?.id || null,
          ticketsCount: result?.ticketsCount || 0,
          ticketIds: result?.ticketIds || [],
          entitlementIds: result?.entitlementIds || [],
          ledgerMarkerId: result?.ledgerMarkerId || null,
        };
      } catch (error: any) {
        const status =
          error.code === 'PAYMENT_SIGNATURE_INVALID'
            ? 401
            : error.code === 'NOT_FOUND'
              ? 404
              : [
                    'CONFLICT',
                    'PAYMENT_AMOUNT_MISMATCH',
                    'PAYMENT_ALREADY_LINKED',
                    'ORDER_ATTRIBUTION_MISSING',
                    'ORDER_NOT_FINALIZABLE',
                    'LEDGER_IDEMPOTENCY_CONFLICT',
                    'INVENTORY_CONFLICT',
                    'TICKET_TRANSACTION_LIMIT_EXCEEDED',
                  ].includes(error.code)
                ? 409
                : error.code === 'FINALIZATION_RETRY_REQUIRED'
                  ? 503
                  : error.code === 'PAYMENT_NOT_CONFIGURED'
                    ? 500
                    : 500;

        if (status >= 500) {
          fastify.log.error(`Checkout webhook failed: ${error.message}`);
        } else {
          fastify.log.warn(`Checkout webhook rejected: ${error.message}`);
        }

        return reply.status(status).send({
          success: false,
          error: status >= 500 ? 'Internal server error' : error.message,
        });
      }
    },
  );

  /**
   * Verify Razorpay checkout and issue tickets
   * POST /checkout/verify
   */
  fastify.post(
    '/checkout/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutVerifyBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      try {
        await enforcePublicRateLimit(fastify, request, `checkout:verify:${userId}`, 10, 60);

        const result = await verifyCheckoutPayment({
          db: fastify.db,
          userId,
          razorpay_order_id: request.body.razorpay_order_id,
          razorpay_payment_id: request.body.razorpay_payment_id,
          razorpay_signature: request.body.razorpay_signature,
          paymentGatewayConfig: {
            keySecret: process.env.RAZORPAY_KEY_SECRET,
            allowMockPayment: allowMockRazorpay(),
          },
          requestId: request.id,
        });
        await publishTicketPurchaseSync(fastify, result);

        request.log.info(
          {
            userId,
            orderId: result.order?.id,
            razorpayOrderId: result.razorpayOrderId,
            alreadyVerified: result.alreadyVerified,
            ticketsCount: result.ticketsCount,
            chatUnlocked: result.chatUnlocked,
            redisReleased: result.redisReleased,
          },
          'Checkout payment verified',
        );

        return {
          success: true,
          alreadyVerified: Boolean(result.alreadyVerified),
          alreadyFinalized: Boolean(result.alreadyFinalized),
          orderId: result.orderId,
          paymentId: result.paymentId,
          status: result.status,
          ticketIds: result.ticketIds,
          entitlementIds: result.entitlementIds,
          ledgerMarkerId: result.ledgerMarkerId,
          reservationReleased: result.reservationReleased,
          outboxEventId: result.outboxEventId,
          order: result.order,
          tickets: result.tickets,
          ticketsCount: result.ticketsCount,
          razorpayOrderId: result.razorpayOrderId,
          razorpayPaymentId: result.razorpayPaymentId,
          chatUnlocked: result.chatUnlocked,
          chat: result.chat,
          redisReleased: result.redisReleased,
        };
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED') {
          reply.header('Retry-After', '60');
          return reply
            .status(429)
            .send({ success: false, error: 'Too many requests, please slow down.' });
        }

        const status =
          error.code === 'UNAUTHORIZED'
            ? 401
            : error.code === 'FORBIDDEN'
              ? 403
              : error.code === 'NOT_FOUND'
                ? 404
                : error.code === 'PAYMENT_SIGNATURE_INVALID' || error.code === 'BAD_REQUEST'
                  ? 400
                  : [
                        'CONFLICT',
                        'PAYMENT_AMOUNT_MISMATCH',
                        'PAYMENT_ALREADY_LINKED',
                        'ORDER_ATTRIBUTION_MISSING',
                        'ORDER_NOT_FINALIZABLE',
                        'LEDGER_IDEMPOTENCY_CONFLICT',
                        'INVENTORY_CONFLICT',
                        'TICKET_TRANSACTION_LIMIT_EXCEEDED',
                      ].includes(error.code)
                    ? 409
                    : error.code === 'FINALIZATION_RETRY_REQUIRED'
                      ? 503
                      : error.code === 'PAYMENT_NOT_CONFIGURED'
                        ? 500
                        : 500;

        if (status >= 500) {
          fastify.log.error(`Checkout verification failed: ${error.message}`);
        } else {
          fastify.log.warn(`Checkout verification rejected: ${error.message}`);
        }

        return reply.status(status).send({
          success: false,
          error: error.message || 'Payment verification failed',
        });
      }
    },
  );

  /**
   * Initiate Checkout (Orchestration)
   * POST /checkout/initiate
   */
  fastify.post(
    '/checkout/initiate',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutInitiateBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      const idempotencyKey = request.headers['x-idempotency-key'] as string;

      try {
        await enforcePublicRateLimit(fastify, request, `checkout:initiate:${userId}`, 3, 60);

        const work = async () => {
          const result = await fastify.checkoutService.initiateCheckout(
            {
              ...request.body,
              userId,
            },
            request.workspaceId,
          );

          if (!result?.requiresPayment || !result?.order?.id) {
            return result;
          }

          const payment = await fastify.checkoutService.preparePayment(
            result.order.id,
            userId,
            {
              keyId: process.env.RAZORPAY_KEY_ID,
              keySecret: process.env.RAZORPAY_KEY_SECRET,
              allowMockPayment: allowMockRazorpay(),
              forceMockPayment: forceMockRazorpay(),
            },
            result.order,
          );

          return {
            success: true,
            requiresPayment: true,
            order: {
              id: result.order.id,
              totalAmount: result.pricing?.grandTotal ?? result.order.totalAmount,
            },
            pricing: result.pricing,
            razorpay: {
              orderId: payment.razorpayOrderId,
              amount: payment.amount,
              amountPaise: payment.amountPaise,
              currency: payment.currency,
              key: payment.key,
            },
          };
        };

        let finalResult: any;
        if (idempotencyKey && fastify.idempotencyService?.executeOnce) {
          finalResult = await fastify.idempotencyService.executeOnce(idempotencyKey, userId, work);
          if (finalResult.cached) return finalResult.body;
        } else {
          finalResult = await work();
        }

        request.log.info(
          {
            eventId: finalResult?.order?.eventId || request.body?.eventId,
            orderId: finalResult?.order?.id,
            reservationId: request.body?.reservationId,
            userId,
            workspaceId: finalResult?.order?.workspaceId || request.workspaceId || null,
          },
          'Checkout initiated',
        );

        return finalResult;
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED') {
          reply.header('Retry-After', '60');
          return reply
            .status(429)
            .send({ success: false, error: 'Too many requests, please slow down.' });
        }

        const isContention =
          error.code === 10 ||
          error.code === 'ABORTED' ||
          (error.message || '').toUpperCase().includes('ABORTED');

        if (isContention) {
          fastify.log.warn(
            `Firestore transaction contention on checkout initiate: ${error.message}`,
          );
          Sentry.captureException(error, {
            level: 'warning',
            tags: { type: 'firestore_contention', route: 'checkout_initiate' },
            extra: {
              userId,
              reservationId: request.body?.reservationId,
              eventId: request.body?.eventId,
            },
          });
          return reply
            .status(409)
            .send({ success: false, error: 'Checkout temporarily unavailable, please retry.' });
        }

        if (
          error.message === 'Payment gateway is not configured' ||
          error.message === 'Payment verification is not configured'
        ) {
          // Distinguish a real misconfiguration (missing RAZORPAY_KEY_ID/SECRET)
          // from a generic failure so it's diagnosable from logs/alerts instead
          // of looking identical to an unrelated 500 — the guest-facing message
          // stays generic on purpose.
          fastify.log.error(
            `Checkout initiate blocked: Razorpay is not configured on this environment (${error.message})`,
          );
          Sentry.captureException(error, {
            level: 'error',
            tags: { type: 'payment_gateway_misconfigured', route: 'checkout_initiate' },
          });
          return reply.status(503).send({
            success: false,
            error: 'Payments are temporarily unavailable. Please try again shortly.',
          });
        }

        fastify.log.error(`Initiate checkout failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  fastify.post(
    '/checkout/failure',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutFailureBody })],
    },
    async (request: any, reply) => {
      const queueId = extractQueueId(request.body?.admissionToken);
      if (!queueId) {
        return reply.status(400).send({ success: false, error: 'Invalid token' });
      }

      try {
        await flagPaymentFailure(fastify.db, queueId);
        request.log.info({ queueId }, 'Checkout payment failure retry window restored');
        return { success: true, message: 'Retry window activated' };
      } catch (error: any) {
        fastify.log.error(`Checkout failure restore failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    },
  );

  /**
   * Cancel Reservation
   * POST /checkout/cancel
   * Requires auth and verifies the reservation/order belongs to the authenticated user.
   */
  fastify.post(
    '/checkout/cancel',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: CheckoutCancelBody })],
    },
    async (request: any, reply) => {
      const { reservationId, orderId } = request.body;
      const userId = request.user.uid;

      // Verify ownership before cancelling
      let orderData: any = null;

      if (reservationId) {
        const resDoc = await fastify.db.collection('cart_reservations').doc(reservationId).get();
        if (!resDoc.exists)
          return reply.status(404).send({ success: false, error: 'Reservation not found' });
        const reservation = resDoc.data() as any;
        const reservationOwnerId = reservation.customerId || reservation.userId || null;
        if (reservationOwnerId !== userId) {
          fastify.log.warn(
            { uid: userId, reservationId, ip: request.ip },
            'SECURITY: Unauthorized cancel attempt on reservation',
          );
          return reply
            .status(403)
            .send({ success: false, error: 'Forbidden: Not your reservation' });
        }
      } else if (orderId) {
        const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists)
          return reply.status(404).send({ success: false, error: 'Order not found' });
        const order = orderDoc.data() as any;
        if (order.userId !== userId && order.customerId !== userId) {
          fastify.log.warn(
            { uid: userId, orderId, ip: request.ip },
            'SECURITY: Unauthorized cancel attempt on order',
          );
          return reply.status(403).send({ success: false, error: 'Forbidden: Not your order' });
        }
        orderData = { id: orderId, ...order };
      }

      try {
        let result: any;
        if (reservationId) {
          // Release a cart reservation (user never paid — just free the held inventory)
          await releaseReservation(reservationId);
          result = { success: true, message: 'Reservation released' };
        } else {
          // Cancel a confirmed order — fetch event, delegate to checkout service
          const eventDoc = await fastify.db.collection('events').doc(orderData.eventId).get();
          const event = eventDoc.exists
            ? { id: orderData.eventId, ...(eventDoc.data() as any) }
            : { id: orderData.eventId };
          result = await fastify.checkoutService.cancelOrder({
            order: orderData,
            event,
            cancelledBy: userId,
            cancelledByType: 'user',
          });
        }
        await fastify.writeAuditLog({
          action: 'checkout.cancel',
          actorUid: userId,
          entityType: reservationId ? 'reservation' : 'order',
          entityId: (reservationId || orderId) as string,
          requestId: request.id,
          payload: { reservationId, orderId, ip: request.ip },
        });
        return result;
      } catch (error: any) {
        fastify.log.error(`Checkout cancel failed: ${error.message}`);
        return reply.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    },
  );
}

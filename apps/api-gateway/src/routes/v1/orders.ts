import { FastifyInstance } from 'fastify';
import { hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';
import { logPaymentEvent } from '../../lib/securityLogger';
import { buildErrorResponse } from '../../lib/api-contracts';
import { getEventCommerceMetrics } from '../../lib/canonicalCommerceMetrics';
import { finalizeProcessedRefund } from '../../lib/refundLedger';

const OrderEventParam = z
  .object({
    eventId: z.string(),
  })
  .strict();

const OrderEventQuery = z
  .object({
    limit: z.string().optional(),
  })
  .strict();

const OrderIdParam = z
  .object({
    id: z.string(),
  })
  .strict();

const OrderLookupQuery = z
  .object({
    includeEvent: z.enum(['true', 'false']).optional(),
  })
  .strict();

const CancelOrderBody = z.object({
  reason: z.string().optional(),
});

async function resolveOrderAccess(
  fastify: FastifyInstance,
  orderId: string,
  actorId?: string | null,
  options: { includeEvent?: boolean } = {},
) {
  const { includeEvent = true } = options;
  const order = await fastify.orderRepo.getOrderById(orderId);
  if (!order) return { order: null, event: null, allowed: false as const };

  if (actorId && order.userId === actorId) {
    if (!includeEvent) {
      return { order, event: null, allowed: true as const };
    }
  }

  const eventDoc = await fastify.db.collection('events').doc(order.eventId).get();
  const event = eventDoc.exists ? ({ id: eventDoc.id, ...eventDoc.data() } as any) : null;

  if (actorId && order.userId === actorId) {
    return { order, event, allowed: true as const };
  }

  if (actorId && event?.venueId) {
    const canView = await hasStaffPermission(fastify.db, event.venueId, actorId, 'viewFinance');
    if (canView) return { order, event, allowed: true as const };
  }

  return { order, event, allowed: false as const };
}

async function revokeCancelledOrderAdmission(
  fastify: FastifyInstance,
  orderId: string,
  revokedAt: string,
) {
  await fastify.db.runTransaction(async (transaction: any) => {
    const [ticketsSnapshot, entitlementsSnapshot] = await Promise.all([
      transaction.get(fastify.db.collection('tickets').where('orderId', '==', orderId)),
      transaction.get(fastify.db.collection('entitlements').where('orderId', '==', orderId)),
    ]);
    for (const ticket of ticketsSnapshot.docs) {
      transaction.update(ticket.ref, {
        status: 'cancelled',
        revokedAt,
        revokedReason: 'ORDER_CANCELLED',
        updatedAt: revokedAt,
      });
    }
    for (const entitlement of entitlementsSnapshot.docs) {
      transaction.update(entitlement.ref, {
        state: 'REVOKED',
        revokedAt,
        revokedReason: 'ORDER_CANCELLED',
        updatedAt: revokedAt,
      });
    }
  });
}

export default async function orderRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/orders
   * Fetch the current user's own orders (confirmed + rsvp)
   */
  fastify.get('/', async (request: any, reply) => {
    const userId = request.user?.uid;
    if (!userId)
      return reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );

    try {
      // Cache-aside: user-scoped order list, TTL 120s
      const cached = await fastify.cache.get('orders', userId);
      if (cached) return { success: true, orders: cached };

      const [ordersSnap, rsvpsSnap] = await Promise.all([
        fastify.db.collection('orders').where('userId', '==', userId).get(),
        fastify.db.collection('rsvp_orders').where('userId', '==', userId).get(),
      ]);

      const orders = ordersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const rsvps = rsvpsSnap.docs.map((d: any) => ({ id: d.id, ...d.data(), isRSVP: true }));
      const all = [...orders, ...rsvps].sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Enrich with event metadata
      const eventIds = [...new Set(all.map((o: any) => o.eventId).filter(Boolean))] as string[];
      const eventDocs = await Promise.all(
        eventIds.map((id: string) => fastify.db.collection('events').doc(id).get()),
      );
      const eventsById: Record<string, any> = {};
      eventDocs.forEach((d: any) => {
        if (d.exists) eventsById[d.id] = { id: d.id, ...d.data() };
      });

      const enriched = all.map((o: any) => ({
        ...o,
        event: eventsById[o.eventId] || null,
      }));

      await fastify.cache.set('orders', userId, enriched, 120);

      return { success: true, orders: enriched };
    } catch (error: any) {
      fastify.log.error(`GET /orders failed: ${error.message}`);
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get(
    '/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: OrderIdParam, querystring: OrderLookupQuery })],
    },
    async (request: any, reply) => {
      const { id: orderId } = request.params;
      const actorId = request.user?.uid;
      if (!actorId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      try {
        const includeEvent = request.query?.includeEvent !== 'false';
        const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, actorId, {
          includeEvent,
        });
        if (!order)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (!allowed)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Unauthorized',
              requestId: request.id,
            }),
          );

        return {
          success: true,
          order: {
            ...order,
            status: order.status === 'pending_payment' ? 'payment_pending' : order.status,
          },
          event,
        };
      } catch (error: any) {
        fastify.log.error(`GET /orders/${orderId} failed: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/:id/cancel',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: OrderIdParam })],
    },
    async (request: any, reply) => {
      const { id: orderId } = request.params;
      const actorId = request.user?.uid;
      if (!actorId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );

      try {
        const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, actorId);
        if (!order)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (!allowed || order.userId !== actorId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Unauthorized',
              requestId: request.id,
            }),
          );

        const decision = await fastify.checkoutService.getCancellationDecision(order, event);
        return { success: true, ...decision };
      } catch (error: any) {
        fastify.log.error(`GET /orders/${orderId}/cancel failed: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/orders/:id/cancel
   * Cancel a user's own order and release inventory
   */
  fastify.post(
    '/:id/cancel',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: OrderIdParam, body: CancelOrderBody })],
    },
    async (request: any, reply) => {
      const { id: orderId } = request.params;
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      try {
        const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, userId);
        if (!order)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (!allowed || order.userId !== userId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'You can only cancel your own orders',
              requestId: request.id,
            }),
          );

        const result = await fastify.checkoutService.cancelOrder(
          {
            order,
            event,
            reason: request.body?.reason,
            cancelledBy: userId,
            cancelledByType: 'guest',
          },
          {
            refundPayment: async ({
              paymentId,
              orderId: refundOrderId,
              eventId,
              reason,
              refundPercentage,
              refundAmount,
            }: {
              paymentId: string;
              orderId: string;
              eventId: string;
              reason: string;
              refundPercentage: number;
              refundAmount: number;
            }) => {
              if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                throw Object.assign(new Error('Razorpay refund configuration is unavailable'), {
                  code: 'REFUND_PROVIDER_UNAVAILABLE',
                });
              }

              const refundId = `cancel_${refundOrderId}`;
              const refundRef = fastify.db.collection('refund_requests').doc(refundId);
              const claimed = await fastify.db.runTransaction(async (transaction: any) => {
                const existing = await transaction.get(refundRef);
                if (existing.exists) {
                  const data = existing.data() as any;
                  if (data.razorpayRefundId) {
                    return {
                      claimed: false,
                      existing: {
                        id: data.razorpayRefundId,
                        status: data.providerStatus || data.status,
                        refundRequestId: refundId,
                      },
                    };
                  }
                  if (data.status === 'settling') {
                    throw Object.assign(new Error('Refund is already being processed'), {
                      code: 'REFUND_ALREADY_PROCESSING',
                    });
                  }
                }
                const amountPaise = Math.round(Number(refundAmount || 0) * 100);
                transaction.set(
                  refundRef,
                  {
                    id: refundId,
                    orderId: refundOrderId,
                    eventId,
                    customerId: userId,
                    amount: refundAmount,
                    amountPaise,
                    fullyRefunded: refundPercentage === 100,
                    revokeAdmission: true,
                    terminalOrderStatus: 'cancelled',
                    reason,
                    source: 'order_cancellation',
                    requestedBy: { uid: userId, role: request.user?.role || 'guest' },
                    previousStatus: order.status,
                    paymentDetails: { originalPaymentId: order.paymentId },
                    status: 'settling',
                    idempotencyKey: `refund:${refundOrderId}:cancellation`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true },
                );
                return { claimed: true, existing: null };
              });
              if (!claimed.claimed && claimed.existing) return claimed.existing;

              const authHeader = Buffer.from(
                `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
              ).toString('base64');
              const refundAmountPaise = Math.round(Number(refundAmount || 0) * 100);
              const response = await fetch(
                `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${authHeader}`,
                  },
                  body: JSON.stringify({
                    amount: refundAmountPaise,
                    notes: {
                      orderId: refundOrderId,
                      eventId,
                      reason,
                      refundPercentage,
                      initiatedBy: 'guest',
                      refundRequestId: refundId,
                    },
                  }),
                },
              );

              if (response.ok) {
                const providerRefund = (await response.json()) as any;
                await refundRef.update({
                  status: providerRefund.status === 'processed' ? 'approved' : 'processing',
                  providerStatus: providerRefund.status,
                  razorpayRefundId: providerRefund.id,
                  updatedAt: new Date().toISOString(),
                });
                return { ...providerRefund, refundRequestId: refundId };
              }

              const refundError = await response.text();
              await refundRef.update({
                status: 'failed',
                failureReason: refundError,
                updatedAt: new Date().toISOString(),
              });
              throw Object.assign(new Error('Razorpay refund failed'), {
                code: 'REFUND_PROVIDER_ERROR',
              });
            },
          },
        );

        if (!result.success) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'CANCELLATION_DENIED',
              message: result.error || 'Cancellation not allowed',
              requestId: request.id,
            }),
          );
        }

        // Bust cached order list for this user
        await revokeCancelledOrderAdmission(fastify, orderId, new Date().toISOString());
        await fastify.cache.delete('orders', userId);
        if (
          result.refund?.providerStatus === 'processed' &&
          result.refund?.refundRequestId &&
          result.refund?.razorpayRefundId
        ) {
          await finalizeProcessedRefund({
            db: fastify.db,
            refundId: result.refund.refundRequestId,
            providerRefundId: result.refund.razorpayRefundId,
          });
        }
        logPaymentEvent(request, 'ORDER_CANCELLED', {
          orderId,
          userId,
          refundPercentage: result.refund?.percentage || 0,
          razorpayRefundId: result.refund?.razorpayRefundId || null,
        });

        return result;
      } catch (error: any) {
        fastify.log.error(`POST /orders/${orderId}/cancel failed: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/orders/:id/reissue
   * Re-trigger fulfillment for a confirmed order with no issued entitlements
   */
  const REISSUE_MIN_AGE_MS = 5 * 60 * 1000;
  fastify.post(
    '/:id/reissue',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: OrderIdParam })],
    },
    async (request: any, reply) => {
      const { id: orderId } = request.params;
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      try {
        const { order, allowed } = await resolveOrderAccess(fastify, orderId, userId);
        if (!order)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (!allowed || order.userId !== userId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        if (order.status !== 'confirmed')
          return reply.status(409).send(
            buildErrorResponse({
              code: 'CONFLICT',
              message: 'Order is not confirmed',
              requestId: request.id,
            }),
          );
        const confirmedAt = order.confirmedAt ? new Date(order.confirmedAt).getTime() : 0;
        if (Date.now() - confirmedAt < REISSUE_MIN_AGE_MS) {
          return reply.status(429).send(
            buildErrorResponse({
              code: 'TOO_SOON',
              message: 'Please wait at least 5 minutes after confirmation before re-sending.',
              requestId: request.id,
            }),
          );
        }
        await (fastify as any).checkoutService.reissueFulfillment(order);
        await fastify.cache.delete('orders', userId);
        return { success: true, message: 'Ticket re-send triggered.' };
      } catch (error: any) {
        fastify.log.error(`POST /orders/${orderId}/reissue failed: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/orders/event/:eventId
   */
  fastify.get(
    '/event/:eventId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: OrderEventParam, querystring: OrderEventQuery })],
    },
    async (request: any, reply) => {
      const { eventId } = request.params;
      const { limit = 100 } = request.query as any;
      const actorId = request.user?.uid;

      // 1. Fetch Event to get venueId
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );
      const eventData = eventDoc.data();
      if (!eventData)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event data missing',
            requestId: request.id,
          }),
        );

      // 2. RBAC Check
      const hasAccess = await hasStaffPermission(
        fastify.db,
        eventData.venueId,
        actorId,
        'viewEvents',
      );
      if (!hasAccess)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      // 3. Fetch Orders and RSVPs
      const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        fastify.db.collection('orders').where('eventId', '==', eventId).limit(Number(limit)).get(),
        fastify.db
          .collection('rsvp_orders')
          .where('eventId', '==', eventId)
          .limit(Number(limit))
          .get(),
      ]);

      const orders = ordersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      const rsvps = rsvpsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        isRSVP: true,
      }));

      const allOrders = [...orders, ...rsvps].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return { success: true, orders: allOrders.slice(0, Number(limit)) };
    },
  );

  /**
   * GET /api/v1/orders/stats/:eventId
   */
  fastify.get(
    '/stats/:eventId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        fastify.validate({ params: OrderEventParam }),
        fastify.requireRoles(['admin', 'partner', 'host']),
      ],
    },
    async (request: any, reply) => {
      const { eventId } = request.params;
      const actorId = request.user?.uid;

      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );
      const eventData = eventDoc.data();
      if (!eventData)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event data missing',
            requestId: request.id,
          }),
        );

      const hasAccess = await hasStaffPermission(
        fastify.db,
        eventData.venueId,
        actorId,
        'viewFinance',
      );
      if (!hasAccess)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      const commerce = await getEventCommerceMetrics(fastify.db, eventId);
      const stats = {
        totalOrders: commerce.orderCount,
        totalRevenue: commerce.netRevenue,
        totalRevenuePaise: commerce.netRevenuePaise,
        ticketsSold: commerce.ticketsSold,
      };

      return { success: true, stats };
    },
  );
}

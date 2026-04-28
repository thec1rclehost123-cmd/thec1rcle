import { FastifyInstance } from 'fastify';
import { hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';
import { logPaymentEvent } from '../../lib/securityLogger';

const OrderEventParam = z.object({
    eventId: z.string()
}).strict();

const OrderEventQuery = z.object({
    limit: z.string().optional()
}).strict();

const OrderIdParam = z.object({
    id: z.string()
}).strict();

const OrderLookupQuery = z.object({
    includeEvent: z.enum(['true', 'false']).optional()
}).strict();

const CancelOrderBody = z.object({
    reason: z.string().optional()
});

async function resolveOrderAccess(
    fastify: FastifyInstance,
    orderId: string,
    actorId?: string | null,
    options: { includeEvent?: boolean } = {}
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

export default async function orderRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/orders
     * Fetch the current user's own orders (confirmed + rsvp)
     */
    fastify.get('/', async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

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
            const all = [...orders, ...rsvps].sort((a: any, b: any) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Enrich with event metadata
            const eventIds = [...new Set(all.map((o: any) => o.eventId).filter(Boolean))] as string[];
            const eventDocs = await Promise.all(
                eventIds.map((id: string) => fastify.db.collection('events').doc(id).get())
            );
            const eventsById: Record<string, any> = {};
            eventDocs.forEach((d: any) => { if (d.exists) eventsById[d.id] = { id: d.id, ...d.data() }; });

            const enriched = all.map((o: any) => ({
                ...o,
                event: eventsById[o.eventId] || null,
            }));

            await fastify.cache.set('orders', userId, enriched, 120);

            return { success: true, orders: enriched };
        } catch (error: any) {
            fastify.log.error(`GET /orders failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/:id', {
        preHandler: [fastify.validate({ params: OrderIdParam, querystring: OrderLookupQuery })]
    }, async (request: any, reply) => {
        const { id: orderId } = request.params;
        const actorId = request.user?.uid;
        if (!actorId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const includeEvent = request.query?.includeEvent !== 'false';
            const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, actorId, { includeEvent });
            if (!order) return reply.status(404).send({ error: 'Order not found' });
            if (!allowed) return reply.status(403).send({ error: 'Unauthorized' });

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
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/:id/cancel', {
        preHandler: [fastify.validate({ params: OrderIdParam })]
    }, async (request: any, reply) => {
        const { id: orderId } = request.params;
        const actorId = request.user?.uid;
        if (!actorId) return reply.status(401).send({ error: 'Authentication required' });

        try {
            const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, actorId);
            if (!order) return reply.status(404).send({ error: 'Order not found' });
            if (!allowed || order.userId !== actorId) return reply.status(403).send({ error: 'Unauthorized' });

            return fastify.checkoutService.getCancellationDecision(order, event);
        } catch (error: any) {
            fastify.log.error(`GET /orders/${orderId}/cancel failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * POST /api/v1/orders/:id/cancel
     * Cancel a user's own order and release inventory
     */
    fastify.post('/:id/cancel', {
        preHandler: [fastify.validate({ params: OrderIdParam, body: CancelOrderBody })]
    }, async (request: any, reply) => {
        const { id: orderId } = request.params;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const { order, event, allowed } = await resolveOrderAccess(fastify, orderId, userId);
            if (!order) return reply.status(404).send({ error: 'Order not found' });
            if (!allowed || order.userId !== userId) return reply.status(403).send({ error: 'You can only cancel your own orders' });

            const result = await fastify.checkoutService.cancelOrder({
                order,
                event,
                reason: request.body?.reason,
                cancelledBy: userId,
                cancelledByType: 'guest',
            }, {
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
                        return { id: `refund_mock_${Date.now()}`, status: 'processing' };
                    }

                    const authHeader = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
                    const refundAmountPaise = Math.round(Number(refundAmount || 0) * 100);
                    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
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
                            }
                        })
                    });

                    if (response.ok) {
                        return response.json();
                    }

                    const refundError = await response.text();
                    return { status: 'failed', error: refundError };
                }
            });

            if (!result.success) {
                return reply.status(400).send({ error: result.error, cancellationAllowed: false });
            }

            // Bust cached order list for this user
            await fastify.cache.delete('orders', userId);
            logPaymentEvent(request, 'ORDER_CANCELLED', {
                orderId,
                userId,
                refundPercentage: result.refund?.percentage || 0,
                razorpayRefundId: result.refund?.razorpayRefundId || null,
            });

            return result;
        } catch (error: any) {
            fastify.log.error(`POST /orders/${orderId}/cancel failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });


    /**
     * POST /api/v1/orders/:id/reissue
     * Re-trigger fulfillment for a confirmed order with no issued entitlements
     */
    const REISSUE_MIN_AGE_MS = 5 * 60 * 1000;
    fastify.post('/:id/reissue', {
        preHandler: [fastify.validate({ params: OrderIdParam })]
    }, async (request: any, reply) => {
        const { id: orderId } = request.params;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
        try {
            const { order, allowed } = await resolveOrderAccess(fastify, orderId, userId);
            if (!order) return reply.status(404).send({ error: 'Order not found' });
            if (!allowed || order.userId !== userId) return reply.status(403).send({ error: 'Forbidden' });
            if (order.status !== 'confirmed') return reply.status(409).send({ error: 'Order is not confirmed' });
            const confirmedAt = order.confirmedAt ? new Date(order.confirmedAt).getTime() : 0;
            if (Date.now() - confirmedAt < REISSUE_MIN_AGE_MS) {
                return reply.status(429).send({ error: 'Please wait at least 5 minutes after confirmation before re-sending.' });
            }
            await (fastify as any).checkoutService.reissueFulfillment(order);
            await fastify.cache.delete('orders', userId);
            return { success: true, message: 'Ticket re-send triggered.' };
        } catch (error: any) {
            fastify.log.error(`POST /orders/${orderId}/reissue failed: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/orders/event/:eventId
     */
    fastify.get('/event/:eventId', {
        preHandler: [fastify.validate({ params: OrderEventParam, querystring: OrderEventQuery })]
    }, async (request: any, reply) => {
        const { eventId } = request.params;
        const { limit = 100 } = request.query as any;
        const actorId = request.user?.uid;

        // 1. Fetch Event to get venueId
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: "Event not found" });
        const eventData = eventDoc.data();
        if (!eventData) return reply.status(404).send({ error: "Event data missing" });

        // 2. RBAC Check
        const hasAccess = await hasStaffPermission(fastify.db, eventData.venueId, actorId, 'viewEvents');
        if (!hasAccess) return reply.status(403).send({ error: "Unauthorized" });

        // 3. Fetch Orders and RSVPs
        const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
            fastify.db.collection('orders').where("eventId", "==", eventId).limit(Number(limit)).get(),
            fastify.db.collection('rsvp_orders').where("eventId", "==", eventId).limit(Number(limit)).get()
        ]);

        const orders = ordersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const rsvps = rsvpsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data(), isRSVP: true }));

        const allOrders = [...orders, ...rsvps].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return { success: true, orders: allOrders.slice(0, Number(limit)) };
    });

    /**
     * GET /api/v1/orders/stats/:eventId
     */
    fastify.get('/stats/:eventId', {
        preHandler: [
            fastify.validate({ params: OrderEventParam }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: any, reply) => {
        const { eventId } = request.params;
        const actorId = request.user?.uid;

        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: "Event not found" });
        const eventData = eventDoc.data();
        if (!eventData) return reply.status(404).send({ error: "Event data missing" });

        const hasAccess = await hasStaffPermission(fastify.db, eventData.venueId, actorId, 'viewFinance');
        if (!hasAccess) return reply.status(403).send({ error: "Unauthorized" });

        const ordersSnapshot = await fastify.db.collection('orders')
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed")
            .get();

        const stats = {
            totalOrders: ordersSnapshot.size,
            totalRevenue: 0,
            ticketsSold: 0
        };

        ordersSnapshot.docs.forEach((doc: any) => {
            const order = doc.data();
            stats.totalRevenue += (order.totalAmount || 0);
            (order.tickets || []).forEach((t: any) => {
                stats.ticketsSold += (t.quantity || 0);
            });
        });

        return { success: true, stats };
    });
}

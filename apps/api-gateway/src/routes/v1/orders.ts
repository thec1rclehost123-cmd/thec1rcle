import { FastifyInstance } from 'fastify';
import { hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';

const OrderEventParam = z.object({
    eventId: z.string()
}).strict();

const OrderEventQuery = z.object({
    limit: z.string().optional()
}).strict();

const OrderIdParam = z.object({
    id: z.string()
}).strict();

const CancelOrderBody = z.object({
    reason: z.string().optional()
});

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
            const orderRef = fastify.db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            // Try rsvp_orders if not found in orders
            let isRsvp = false;
            let resolvedRef = orderRef;
            let order: any = null;

            if (!orderDoc.exists) {
                const rsvpRef = fastify.db.collection('rsvp_orders').doc(orderId);
                const rsvpDoc = await rsvpRef.get();
                if (!rsvpDoc.exists) return reply.status(404).send({ error: 'Order not found' });
                order = { id: rsvpDoc.id, ...rsvpDoc.data() };
                resolvedRef = rsvpRef;
                isRsvp = true;
            } else {
                order = { id: orderDoc.id, ...orderDoc.data() };
            }

            if (order.userId !== userId) return reply.status(403).send({ error: 'You can only cancel your own orders' });
            if (order.status === 'cancelled') return reply.status(409).send({ error: 'Order is already cancelled', alreadyCancelled: true });
            if (!['confirmed', 'pending_payment', 'reserved'].includes(order.status)) {
                return reply.status(400).send({ error: `Orders with status "${order.status}" cannot be cancelled` });
            }

            // Check event hasn't started
            const eventDoc = await fastify.db.collection('events').doc(order.eventId).get();
            if (eventDoc.exists) {
                const event = eventDoc.data() as any;
                const eventStart = new Date(event.startDate || event.date);
                if (eventStart <= new Date()) {
                    return reply.status(400).send({ error: 'Cannot cancel — the event has already started' });
                }
            }

            const reason = request.body?.reason || 'User requested cancellation';
            const now = new Date().toISOString();

            await resolvedRef.update({
                status: 'cancelled',
                cancelledAt: now,
                cancellationReason: reason,
                cancelledBy: userId,
                cancelledByType: 'guest',
                updatedAt: now,
            });

            // Bust cached order list for this user
            await fastify.cache.delete('orders', userId);

            return {
                success: true,
                orderId,
                status: 'cancelled',
                message: 'Order cancelled. Refund will be processed per event policy within 5-7 business days.',
            };
        } catch (error: any) {
            fastify.log.error(`POST /orders/${orderId}/cancel failed: ${error.message}`);
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

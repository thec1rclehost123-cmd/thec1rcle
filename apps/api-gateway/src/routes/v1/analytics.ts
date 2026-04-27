import { FastifyInstance } from 'fastify';
import { getVenueAnalytics, getHostAnalytics, getPromoterFunnel } from '@c1rcle/core/analytics-engine';
import { PROMOTER_COMMISSION_TIERS } from '../../lib/rbac-permissions';

export default async function analyticsRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/analytics/venue/:id
     * Gets performance analytics for a venue
     */
    fastify.get('/venue/:id', {
        preHandler: [fastify.requirePartnerAccess((req) => (req.params as any).id)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { range } = request.query as { range?: string };

        try {
            const cacheKey = JSON.stringify({ id, range });
            const cached = await fastify.cache.get('analytics:venue', cacheKey);
            if (cached) return cached;

            const stats = await getVenueAnalytics(id, range);

            await fastify.cache.set('analytics:venue', cacheKey, stats, 120); // 120s TTL
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/host/:id
     * Gets performance analytics for a host
     */
    fastify.get('/host/:id', {
        preHandler: [fastify.requirePartnerAccess((req) => (req.params as any).id)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const cached = await fastify.cache.get('analytics:host', id);
            if (cached) return cached;

            const stats = await getHostAnalytics(id);

            await fastify.cache.set('analytics:host', id, stats, 120); // 120s TTL
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/promoter/:id
     * Gets funnel analytics for a promoter
     */
    fastify.get('/promoter/:id', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { id } = request.params as { id: string };
        // Promoter analytics: caller must be the promoter themselves or a partner they belong to
        if (request.user.uid !== id && request.user.role !== 'admin') {
            const membership = await fastify.db.collection('partner_memberships')
                .where('uid', '==', request.user.uid)
                .where('promoterId', '==', id)
                .limit(1).get();
            if (membership.empty) return reply.status(403).send({ error: 'Forbidden' });
        }

        try {
            const cached = await fastify.cache.get('analytics:promoter', id);
            if (cached) return cached;

            const funnel = await getPromoterFunnel(id);
            const result = { ...funnel, commissionTiers: PROMOTER_COMMISSION_TIERS };

            await fastify.cache.set('analytics:promoter', id, result, 120); // 120s TTL
            return result;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/event/:id/computed
     * Returns pre-computed analytics metrics for a single event.
     * Consolidates overview + finance data and derives all KPIs server-side.
     * Frontend must render these values — never compute metrics locally.
     */
    fastify.get('/event/:id/computed', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { id: eventId } = request.params as { id: string };

        // Resolve the event's partner for access check
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
        const partnerId = (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId;
        if (partnerId) {
            try { await fastify.verifyPartnerAccess(request, partnerId); }
            catch { return reply.status(403).send({ error: 'Forbidden' }); }
        }

        try {
            const cacheKey = `event:${eventId}:computed`;
            const cached = await fastify.cache.get('analytics:event', cacheKey);
            if (cached) return cached;

            // Fetch raw overview and finance data in parallel
            const [overviewSnap, ordersSnap] = await Promise.all([
                fastify.db.collection('event_analytics').doc(eventId).get(),
                fastify.db.collection('orders')
                    .where('eventId', '==', eventId)
                    .where('status', 'in', ['confirmed', 'checked_in'])
                    .get(),
            ]);

            const overview = overviewSnap.exists ? overviewSnap.data() as Record<string, any> : {};
            const orders = ordersSnap.docs.map(d => d.data());
            const grossRevenue = orders.reduce((s: number, o: any) => s + (Number(o.totalAmount) || 0), 0);
            const ticketsSold = orders.reduce((s: number, o: any) => s + (o.tickets?.length || 0), 0);
            const totalCheckedIn = Number(overview.totalCheckedIn ?? 0);
            const capacity = Number(overview.capacity ?? 0);
            const views = Number(overview.views ?? 0);
            const guestlistSignups = Number(overview.guestListSize ?? 0);
            const refundAmount = Number(overview.refundAmount ?? 0);
            const uniqueAttendees = Number(overview.uniqueAttendees ?? 0);
            const repeatGuests = Number(overview.repeatGuests ?? 0);

            const result = {
                totalRevenue: grossRevenue,
                ticketsSold,
                totalCheckIns: totalCheckedIn,
                guestlistSignups,
                capacity,
                views,
                avgTicketPrice: ticketsSold > 0 ? grossRevenue / ticketsSold : 0,
                occupancyRate: capacity > 0 ? (totalCheckedIn / capacity) * 100 : 0,
                sellThroughRate: Number(overview.sellThrough ?? 0),
                refundAmount,
                refundRate: grossRevenue > 0 ? (refundAmount / grossRevenue) * 100 : 0,
                noShowRate: ticketsSold > 0 ? (Math.max(ticketsSold - Math.min(totalCheckedIn, ticketsSold), 0) / ticketsSold) * 100 : 0,
                repeatGuests,
                repeatGuestRate: uniqueAttendees > 0 ? (repeatGuests / uniqueAttendees) * 100 : 0,
                firstTimeGuestRate: uniqueAttendees > 0 ? (Number(overview.firstTimeGuests ?? 0) / uniqueAttendees) * 100 : 0,
                viewToPurchase: views > 0 ? (ticketsSold / views) * 100 : 0,
                viewToGuestlist: views > 0 ? (guestlistSignups / views) * 100 : 0,
                purchaseToArrival: ticketsSold > 0 ? (Math.min(totalCheckedIn, ticketsSold) / ticketsSold) * 100 : 0,
                guestlistToArrival: guestlistSignups > 0 ? (Math.min(totalCheckedIn, guestlistSignups) / guestlistSignups) * 100 : 0,
                salesTimeline: overview.salesTimeline ?? [],
                hourlyTimeline: overview.hourlyTimeline ?? [],
                ticketMix: overview.ticketMix ?? [],
                peakCheckInHour: overview.peakCheckInHour ?? null,
            };

            await fastify.cache.set('analytics:event', cacheKey, result, 60);
            return result;
        } catch (error: any) {
            fastify.log.error(`Event computed analytics error: ${error.message}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/v1/analytics/:type/:id/:subCategory
     * NOTE: This catch-all route is not actively used by any frontend. Subcategory analytics
     * are served by the explicit /venue/:id, /host/:id, /promoter/:id routes above.
     * Returns 404 to prevent silent failures from dynamic method dispatch.
     */
    fastify.get('/:type/:id/:subCategory', async (_request, reply) => {
        reply.status(404).send({ error: 'Use /analytics/venue/:id, /analytics/host/:id, or /analytics/promoter/:id' });
    });
}

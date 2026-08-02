import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getVenueAnalytics, getPromoterFunnel } from '@c1rcle/core/analytics-engine';
import { PROMOTER_COMMISSION_TIERS } from '../../lib/rbac-permissions';
import { getEventCommerceMetrics } from '../../lib/canonicalCommerceMetrics';
import { aggregateAudience } from '../../lib/analyticsAudience';
import { HostService } from '../../services/unified/host-service.js';
import type { OverviewRange, PartnerContext } from '../../services/unified/types.js';

const AnalyticsRangeSchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y']).optional(),
});

const VenueClickSchema = z
  .object({
    venueId: z.string().min(1),
    visitorId: z.string().min(1),
  })
  .strict();

const HostClickSchema = z
  .object({
    hostId: z.string().min(1),
    visitorId: z.string().min(1),
  })
  .strict();

export default async function analyticsRoutes(fastify: FastifyInstance) {
  const hostService = new HostService({
    db: fastify.db,
    log: fastify.log,
    redis: fastify.redis,
  });

  /**
   * POST /api/v1/analytics/host-click
   * Tracks genuine host clicks, implements duplicate prevention (24h TTL), and publishes events.
   */
  fastify.post(
    '/host-click',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: HostClickSchema })],
    },
    async (request, reply) => {
      const { hostId, visitorId } = request.body as z.infer<typeof HostClickSchema>;

      try {
        // Validate host exists
        const hostDoc = await fastify.db.collection('hosts').doc(hostId).get();
        if (!hostDoc.exists) {
          return reply.status(400).send({ error: 'Host not found' });
        }

        const sessionId = `${visitorId}_${hostId}`;
        const sessionDoc = await fastify.db.collection('host_visit_sessions').doc(sessionId).get();

        if (sessionDoc.exists) {
          const session = sessionDoc.data();
          if (session && new Date(session.expiresAt) > new Date()) {
            return { success: true, duplicate: true };
          }
        }

        // Set or update the duplicate prevention session
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await fastify.db.collection('host_visit_sessions').doc(sessionId).set({
          visitorId,
          hostId,
          lastVisitedAt: new Date().toISOString(),
          expiresAt,
        });

        // Publish to Inngest background queue
        await fastify.sendInngestEvent(fastify.InngestEvents.HOST_CLICK, {
          hostId,
          visitorId,
          timestamp: new Date().toISOString(),
        });

        return { success: true, duplicate: false };
      } catch (error: any) {
        fastify.log.error(`Error in POST /analytics/host-click: ${error.message}`);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /api/v1/analytics/venue-click
   * Tracks genuine venue clicks, implements duplicate prevention (24h TTL), and publishes events.
   */
  fastify.post(
    '/venue-click',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: VenueClickSchema })],
    },
    async (request, reply) => {
      const { venueId, visitorId } = request.body as z.infer<typeof VenueClickSchema>;

      try {
        // Validate venue exists
        const venueDoc = await fastify.db.collection('venues').doc(venueId).get();
        if (!venueDoc.exists) {
          return reply.status(400).send({ error: 'Venue not found' });
        }

        const sessionId = `${visitorId}_${venueId}`;
        const sessionDoc = await fastify.db.collection('venue_visit_sessions').doc(sessionId).get();

        if (sessionDoc.exists) {
          const session = sessionDoc.data();
          if (session && new Date(session.expiresAt) > new Date()) {
            return { success: true, duplicate: true };
          }
        }

        // Set or update the duplicate prevention session
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await fastify.db.collection('venue_visit_sessions').doc(sessionId).set({
          visitorId,
          venueId,
          lastVisitedAt: new Date().toISOString(),
          expiresAt,
        });

        // Publish to Inngest background queue
        await fastify.sendInngestEvent(fastify.InngestEvents.VENUE_CLICK, {
          venueId,
          visitorId,
          timestamp: new Date().toISOString(),
        });

        return { success: true, duplicate: false };
      } catch (error: any) {
        fastify.log.error(`Error in POST /analytics/venue-click: ${error.message}`);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /api/v1/analytics/venue/:id
   * Gets performance analytics for a venue
   */
  fastify.get(
    '/venue/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        fastify.requirePartnerAccess((req) => (req.params as any).id),
        fastify.validate({ querystring: AnalyticsRangeSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { range } = request.query as z.infer<typeof AnalyticsRangeSchema>;

      try {
        const cacheKey = JSON.stringify({ id, range });
        const cached = await fastify.cache.get('analytics:venue', cacheKey);
        if (cached) return cached;

        const stats = await getVenueAnalytics(id, range);

        await fastify.cache.set('analytics:venue', cacheKey, stats, 120); // 120s TTL
        return stats;
      } catch (error: any) {
        reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /api/v1/analytics/host/:id
   * Gets performance analytics for a host
   */
  fastify.get(
    '/host/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        fastify.requirePartnerAccess((req) => (req.params as any).id),
        fastify.validate({ querystring: AnalyticsRangeSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { range } = request.query as z.infer<typeof AnalyticsRangeSchema>;

      try {
        const overviewRange: OverviewRange =
          range === '7d' ? '1w' : range === '90d' || range === '1y' ? 'all' : '1m';
        const cacheKey = `${id}:${overviewRange}:ledger-projection-v1`;
        const cached = await fastify.cache.get('analytics:host', cacheKey);
        if (cached) return { ...(cached as Record<string, unknown>), fromCache: true };

        const ctx: PartnerContext = {
          partnerId: id,
          uid: String((request as any).user?.uid || ''),
          type: 'host',
          roles: ['host_owner'],
          venueIds: [],
          displayName: String((request as any).user?.displayName || 'Host'),
        };
        const windowStart = new Date();
        if (overviewRange === '1w') windowStart.setDate(windowStart.getDate() - 7);
        else if (overviewRange === 'all') windowStart.setMonth(windowStart.getMonth() - 6);
        else windowStart.setDate(windowStart.getDate() - 30);
        const fromIso = windowStart.toISOString();
        const [performance, statsSnap, audience] = await Promise.all([
          hostService.getPerformance(ctx, overviewRange, 'tickets'),
          fastify.db.collection('host_stats').doc(id).get(),
          aggregateAudience(fastify.db, { hostId: id }, fromIso),
        ]);
        const hostStats = statsSnap.exists ? (statsSnap.data() as Record<string, any>) : {};
        const totalRevenue = performance.series.reduce((sum, point) => sum + point.revenue, 0);
        const paidTickets = performance.series.reduce((sum, point) => sum + point.ticketsSold, 0);
        // Guest RSVPs are written without hostId (guest-order-engine), so resolve
        // them via the host's events instead of filtering rsvp_orders by hostId.
        const eventsSnap = await fastify.db
          .collection('events')
          .where('hostId', '==', id)
          .limit(500)
          .get()
          .catch(() => ({ docs: [] as any[] }));
        const eventIds = ((eventsSnap as any).docs || []).map((d: any) => d.id);
        const rsvpDocs: any[] = [];
        for (let i = 0; i < eventIds.length; i += 30) {
          const batch = eventIds.slice(i, i + 30);
          const snap = await fastify.db
            .collection('rsvp_orders')
            .where('eventId', 'in', batch)
            .limit(2000)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          rsvpDocs.push(...((snap as any).docs || []));
        }
        const rsvpTickets = rsvpDocs.reduce((count: number, doc: any) => {
          const rsvp = doc.data() || {};
          const created = rsvp.createdAt?.toDate?.()
            ? rsvp.createdAt.toDate().toISOString()
            : rsvp.createdAt;
          if (rsvp.status !== 'confirmed') return count;
          if (created && created < fromIso) return count;
          return count + (Number(rsvp.ticketCount || rsvp.quantity || 1) || 1);
        }, 0);
        const ticketsSold = paidTickets + rsvpTickets;
        const result = {
          role: 'host',
          rangeLabel:
            overviewRange === '1w'
              ? 'Last 7 days'
              : overviewRange === 'all'
                ? 'Last 6 months'
                : 'Last 30 days',
          lastUpdatedAt: String(hostStats.lastUpdatedAt || new Date().toISOString()),
          dataReady: totalRevenue > 0 || ticketsSold > 0,
          totalRevenue,
          ticketsSold,
          totalTicketsSold: ticketsSold,
          ticketsSoldPaid: paidTickets,
          ticketsSoldRsvp: rsvpTickets,
          totalCheckIns: Number(hostStats.totalCheckIns || 0),
          guestlistSignups: Number(hostStats.guestlistSignups || hostStats.totalRsvps || 0),
          revenueTimeline: performance.series.map((point) => ({
            date: point.date,
            label: point.label,
            revenue: point.revenue,
          })),
          ticketsTimeline: performance.series.map((point) => ({
            date: point.date,
            label: point.label,
            tickets: point.ticketsSold,
          })),
          genderRatio: audience.genderRatio,
          ageBands: audience.ageBands,
        };

        await fastify.cache.set('analytics:host', cacheKey, result, 120);
        return result;
      } catch (error: any) {
        fastify.log.error(
          { error: error?.message, hostId: id },
          'Canonical host analytics read failed',
        );
        const statusCode = Number(error?.statusCode) || 500;
        reply.status(statusCode).send({
          error:
            statusCode === 503
              ? 'Canonical host analytics data is unavailable'
              : 'Internal server error',
          code: error?.code || 'HOST_ANALYTICS_FAILED',
        });
      }
    },
  );

  /**
   * GET /api/v1/analytics/promoter/:id
   * Gets funnel analytics for a promoter
   */
  fastify.get(
    '/promoter/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      // Promoter analytics: caller must be the promoter themselves or a partner they belong to
      if (request.user.uid !== id && request.user.role !== 'admin') {
        const membership = await fastify.db
          .collection('partner_memberships')
          .where('uid', '==', request.user.uid)
          .where('partnerId', '==', id)
          .where('partnerType', '==', 'promoter')
          .limit(1)
          .get();
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
        reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /api/v1/analytics/event/:id/computed
   * Returns pre-computed analytics metrics for a single event.
   * Consolidates overview + finance data and derives all KPIs server-side.
   * Frontend must render these values — never compute metrics locally.
   */
  fastify.get(
    '/event/:id/computed',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { id: eventId } = request.params as { id: string };

      // Resolve the event's partner for access check
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const partnerId = (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId;
      if (partnerId) {
        try {
          await fastify.verifyPartnerAccess(request, partnerId);
        } catch {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      try {
        const cacheKey = `event:${eventId}:computed`;
        const cached = await fastify.cache.get('analytics:event', cacheKey);
        if (cached) return cached;

        // Finance and admission truth come from the canonical ledger and tickets.
        const [overviewSnap, commerce] = await Promise.all([
          fastify.db.collection('event_analytics').doc(eventId).get(),
          getEventCommerceMetrics(fastify.db, eventId),
        ]);

        const overview = overviewSnap.exists ? (overviewSnap.data() as Record<string, any>) : {};
        const grossRevenue = commerce.grossRevenue;
        const netRevenue = commerce.netRevenue;
        const ticketsSold = commerce.ticketsSold;
        const totalCheckedIn = Number(overview.totalCheckedIn ?? 0);
        const capacity = Number(overview.capacity ?? 0);
        const views = Number(overview.views ?? 0);
        const guestlistSignups = Number(overview.guestListSize ?? 0);
        const refundAmount = commerce.refundAmount;
        const uniqueAttendees = Number(overview.uniqueAttendees ?? 0);
        const repeatGuests = Number(overview.repeatGuests ?? 0);

        const result = {
          totalRevenue: netRevenue,
          ticketsSold,
          totalCheckIns: totalCheckedIn,
          guestlistSignups,
          capacity,
          views,
          avgTicketPrice: ticketsSold > 0 ? netRevenue / ticketsSold : 0,
          occupancyRate: capacity > 0 ? (totalCheckedIn / capacity) * 100 : 0,
          sellThroughRate: Number(overview.sellThrough ?? 0),
          refundAmount,
          refundRate: grossRevenue > 0 ? (refundAmount / grossRevenue) * 100 : 0,
          noShowRate:
            ticketsSold > 0
              ? (Math.max(ticketsSold - Math.min(totalCheckedIn, ticketsSold), 0) / ticketsSold) *
                100
              : 0,
          repeatGuests,
          repeatGuestRate: uniqueAttendees > 0 ? (repeatGuests / uniqueAttendees) * 100 : 0,
          firstTimeGuestRate:
            uniqueAttendees > 0
              ? (Number(overview.firstTimeGuests ?? 0) / uniqueAttendees) * 100
              : 0,
          viewToPurchase: views > 0 ? (ticketsSold / views) * 100 : 0,
          viewToGuestlist: views > 0 ? (guestlistSignups / views) * 100 : 0,
          purchaseToArrival:
            ticketsSold > 0 ? (Math.min(totalCheckedIn, ticketsSold) / ticketsSold) * 100 : 0,
          guestlistToArrival:
            guestlistSignups > 0
              ? (Math.min(totalCheckedIn, guestlistSignups) / guestlistSignups) * 100
              : 0,
          salesTimeline: overview.salesTimeline ?? [],
          hourlyTimeline: overview.hourlyTimeline ?? [],
          ticketMix: overview.ticketMix ?? [],
          peakCheckInHour: overview.peakCheckInHour ?? null,
        };

        await fastify.cache.set('analytics:event', cacheKey, result, 300);
        return result;
      } catch (error: any) {
        fastify.log.error(`Event computed analytics error: ${error.message}`);
        reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /api/v1/analytics/:type/:id/:subCategory
   * NOTE: This catch-all route is not actively used by any frontend. Subcategory analytics
   * are served by the explicit /venue/:id, /host/:id, /promoter/:id routes above.
   * Returns 404 to prevent silent failures from dynamic method dispatch.
   */
  fastify.get('/:type/:id/:subCategory', async (_request, reply) => {
    reply
      .status(404)
      .send({ error: 'Use /analytics/venue/:id, /analytics/host/:id, or /analytics/promoter/:id' });
  });
}

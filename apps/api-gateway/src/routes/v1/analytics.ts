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

      // Resolve the event's partner for access check (allows either host or venue partner)
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const eventData = eventDoc.data() as any;
      const hostId =
        eventData.hostId || (eventData.creatorRole === 'host' ? eventData.creatorId : null);
      const venueId =
        eventData.venueId || (eventData.creatorRole === 'venue' ? eventData.creatorId : null);

      let allowed = false;
      if (hostId) {
        try {
          await fastify.verifyPartnerAccess(request, hostId);
          allowed = true;
        } catch {
          // User might be the venue partner for this event
        }
      }
      if (!allowed && venueId) {
        try {
          await fastify.verifyPartnerAccess(request, venueId);
          allowed = true;
        } catch {
          // User is neither host nor venue
        }
      }

      if (!allowed && (hostId || venueId)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      try {
        const cacheKey = `event:${eventId}:computed`;
        const cached = await fastify.cache.get('analytics:event', cacheKey);
        if (cached) return cached;

        // Finance and admission truth come from the canonical ledger and tickets.
        const [overviewSnap, eventSnap, commerce, ordersSnap, checkinsCountSnap] =
          await Promise.all([
            fastify.db.collection('event_analytics').doc(eventId).get(),
            fastify.db.collection('events').doc(eventId).get(),
            getEventCommerceMetrics(fastify.db, eventId),
            fastify.db
              .collection('orders')
              .where('eventId', '==', eventId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('ticket_scans')
              .where('eventId', '==', eventId)
              .count()
              .get()
              .catch(() => null),
          ]);

        const overview = overviewSnap.exists ? (overviewSnap.data() as Record<string, any>) : {};
        const eventData = eventSnap.exists ? (eventSnap.data() as Record<string, any>) : {};

        // Derive the per-phase breakdown from canonical orders + ledger so the
        // values stay refund-aware and net-consistent with the KPI figures.
        const orderDocs = (ordersSnap as any).docs || [];
        const computedPhaseBreakdown: Record<string, { ticketsSold: number; revenue: number }> = {};
        for (const orderDoc of orderDocs) {
          const o = orderDoc.data() as Record<string, any>;
          const orderNet = Number(commerce.orderRevenuePaise[orderDoc.id]?.netPaise ?? 0) / 100;
          const lines = Array.isArray(o.tickets) ? o.tickets : [];
          const lineGrossTotal = lines.reduce(
            (sum, line) =>
              sum +
              (Number(line.total ?? line.subtotal ?? line.price * Number(line.quantity || 1)) || 0),
            0,
          );
          for (const line of lines) {
            const phase = String(line.priceLabel || 'Regular');
            const qty = Number(line.quantity) || 1;
            const gross = Number(line.total ?? line.subtotal ?? line.price * qty) || 0;
            const share =
              lineGrossTotal > 0 ? gross / lineGrossTotal : lines.length > 0 ? 1 / lines.length : 0;
            const entry = computedPhaseBreakdown[phase] || { ticketsSold: 0, revenue: 0 };
            entry.ticketsSold += qty;
            entry.revenue += orderNet * share;
            computedPhaseBreakdown[phase] = entry;
          }
        }
        const salesByPhase =
          Object.keys(computedPhaseBreakdown).length > 0
            ? computedPhaseBreakdown
            : (overview.salesByPhase ?? eventData.stats?.salesByPhase ?? {});

        // Daily sales timeline from canonical tickets + ledger (refund-aware, net).
        const salesByDate = new Map<string, { tickets: number; revenue: number }>();
        for (const ticket of commerce.soldTickets) {
          const date = String(ticket.issuedAt || ticket.createdAt || '').slice(0, 10);
          if (!date) continue;
          if (!salesByDate.has(date)) salesByDate.set(date, { tickets: 0, revenue: 0 });
          salesByDate.get(date)!.tickets += 1;
        }
        for (const ledgerEntry of [...commerce.revenueEntries, ...commerce.refundEntries]) {
          const date = String(ledgerEntry.createdAt || '').slice(0, 10);
          if (!date) continue;
          if (!salesByDate.has(date)) salesByDate.set(date, { tickets: 0, revenue: 0 });
          salesByDate.get(date)!.revenue += Number(ledgerEntry.amountPaise || 0) / 100;
        }
        const salesTimeline = Array.from(salesByDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, b]) => ({
            date,
            label: new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            }),
            tickets: b.tickets,
            revenue: b.revenue,
          }));

        // Ticket mix from canonical tickets, allocating net order revenue per ticket.
        const soldCountByOrder: Record<string, number> = {};
        for (const t of commerce.soldTickets) {
          soldCountByOrder[t.orderId] = (soldCountByOrder[t.orderId] || 0) + 1;
        }
        const tierMap = new Map<string, { tierName: string; sold: number; revenue: number }>();
        for (const ticket of commerce.soldTickets) {
          const tierId = String(ticket.tierId || ticket.metadata?.tierId || 'unknown');
          const tierName = String(ticket.tierName || ticket.metadata?.tierName || 'Ticket');
          if (!tierMap.has(tierId)) tierMap.set(tierId, { tierName, sold: 0, revenue: 0 });
          const entry = tierMap.get(tierId)!;
          entry.sold += 1;
          const orderNet = Number(commerce.orderRevenuePaise[ticket.orderId]?.netPaise ?? 0) / 100;
          const count = soldCountByOrder[ticket.orderId] || 1;
          entry.revenue += orderNet / count;
        }
        const ticketMix = Array.from(tierMap.entries()).map(([tierId, v]) => ({
          tierId,
          tierName: v.tierName,
          revenue: v.revenue,
          sold: v.sold,
        }));
        const grossRevenue = commerce.grossRevenue;
        const netRevenue = commerce.netRevenue;
        const ticketsSold = commerce.ticketsSold;
        const totalCheckedIn = checkinsCountSnap
          ? Number(checkinsCountSnap.data().count ?? 0)
          : Number(overview.totalCheckedIn ?? 0);
        const tierCapacity = Array.isArray(eventData.tiers)
          ? eventData.tiers.reduce(
              (sum: number, t: any) => sum + Number(t.capacity ?? t.quantity ?? 0),
              0,
            )
          : 0;
        const capacity =
          tierCapacity > 0 ? tierCapacity : Number(eventData.capacity ?? overview.capacity ?? 0);
        const views = Number(eventData.stats?.views ?? overview.views ?? 0);
        const guestlistSignups = Number(overview.guestListSize ?? 0);
        const refundAmount = commerce.refundAmount;
        const buyerIds = new Set<string>();
        for (const doc of orderDocs) {
          const d = doc.data() as any;
          if (d.userId) buyerIds.add(d.userId);
        }

        let repeatGuestsVal = Number(overview.repeatGuests ?? 0);
        const uniqueAttendeesVal = Number(overview.uniqueAttendees ?? 0) || buyerIds.size;

        if (buyerIds.size > 0 && (!overview.repeatGuests || overview.repeatGuests === 0)) {
          const partnerField = hostId ? 'hostId' : 'venueId';
          const partnerId = hostId || venueId;
          const otherOrders = await fastify.db
            .collection('orders')
            .where(partnerField, '==', partnerId)
            .limit(1000)
            .get()
            .catch(() => ({ docs: [] }));

          const repeatIds = new Set<string>();
          for (const doc of otherOrders.docs) {
            const data = doc.data() || {};
            if (data.eventId === eventId) continue;
            if (!['confirmed', 'paid'].includes(String(data.status || ''))) continue;
            const uid = data.userId;
            if (uid && buyerIds.has(uid)) {
              repeatIds.add(uid);
            }
          }
          repeatGuestsVal = repeatIds.size;
        }

        const firstTimeGuestsVal =
          uniqueAttendeesVal > repeatGuestsVal ? uniqueAttendeesVal - repeatGuestsVal : 0;

        const result = {
          totalRevenue: netRevenue,
          ticketsSold,
          totalCheckIns: totalCheckedIn,
          guestlistSignups,
          capacity,
          views,
          avgTicketPrice: ticketsSold > 0 ? netRevenue / ticketsSold : 0,
          occupancyRate: capacity > 0 ? (totalCheckedIn / capacity) * 100 : 0,
          sellThroughRate: capacity > 0 ? (ticketsSold / capacity) * 100 : 0,
          refundAmount,
          refundRate: grossRevenue > 0 ? (refundAmount / grossRevenue) * 100 : 0,
          noShowRate:
            ticketsSold > 0
              ? (Math.max(ticketsSold - Math.min(totalCheckedIn, ticketsSold), 0) / ticketsSold) *
                100
              : 0,
          repeatGuests: repeatGuestsVal,
          repeatGuestRate:
            uniqueAttendeesVal > 0 ? (repeatGuestsVal / uniqueAttendeesVal) * 100 : 0,
          firstTimeGuestRate:
            uniqueAttendeesVal > 0
              ? (Number(overview.firstTimeGuests ?? firstTimeGuestsVal) / uniqueAttendeesVal) * 100
              : 0,
          viewToPurchase: views > 0 ? (ticketsSold / views) * 100 : 0,
          viewToGuestlist: views > 0 ? (guestlistSignups / views) * 100 : 0,
          purchaseToArrival:
            ticketsSold > 0 ? (Math.min(totalCheckedIn, ticketsSold) / ticketsSold) * 100 : 0,
          guestlistToArrival:
            guestlistSignups > 0
              ? (Math.min(totalCheckedIn, guestlistSignups) / guestlistSignups) * 100
              : 0,
          salesTimeline,
          hourlyTimeline: overview.hourlyTimeline ?? [],
          ticketMix,
          salesByPhase,
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

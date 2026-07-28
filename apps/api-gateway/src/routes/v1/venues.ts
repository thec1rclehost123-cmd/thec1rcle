import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAdminStorage } from '@c1rcle/core/admin';
import {
  signStorageUrl,
  enrichVenueProfileWithSignedUrls,
  cleanVenueProfilePatch,
} from '../../lib/signed-urls.js';
import { decrypt } from '../../lib/encryption.js';
import {
  getEventCommerceMetrics,
  getPartnerCommerceRows,
} from '../../lib/canonicalCommerceMetrics';
import { isBlockingCalendarEvent } from '../../lib/calendar-visibility.js';
import { generateReconciliation } from '@c1rcle/core/cover-charge-engine';
import { loadVenueScopedEvent } from '../../lib/venueEventScope.js';
import { getPermissionsForRole } from '../../lib/rbac-permissions.js';

const VenueIdQuery = z.object({ venueId: z.string() });
const VenueCrmQuery = z.object({
  venueId: z.string(),
  limit: z.string().optional().default('50'),
  cursor: z.string().optional(),
});
const VenueProfilePatch = z.object({ venueId: z.string(), patch: z.record(z.string(), z.any()) });
const VenueOrdersQuery = z.object({
  venueId: z.string(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  status: z.string().optional(),
});
const VenueFinanceQuery = z.object({
  venueId: z.string(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
const NotificationsReadBody = z.object({
  venueId: z.string(),
  notificationId: z.string().optional(),
  markAllRead: z.boolean().optional(),
});
const ALLOWED_VENUE_PROFILE_FIELDS = [
  'name',
  'description',
  'bio',
  'tagline',
  'address',
  'city',
  'state',
  'capacity',
  'amenities',
  'photos',
  'coverImage',
  'profileImage',
  'contactEmail',
  'contactPhone',
  'socialLinks',
  'operatingHours',
  'dressCode',
  'ageRestriction',
  'instagramHandle',
  'youtubeHandle',
  'spotifyHandle',
];
const TimeSeriesSchema = z.object({
  venueId: z.string(),
  range: z.enum(['1d', '1w', '1m', 'all']),
  metric: z.enum(['tickets', 'revenue']),
});
const DineInBodySchema = z.any();
const VenueEventsSchema = z.object({
  venueId: z.string(),
  limit: z.string().optional().default('20'),
  status: z.string().optional().default('all'),
});

const AVAILABILITY_SLOTS_COLLECTION = 'availability_slots';

function normalizeSlotRecord(doc: any): any {
  const data = (doc.data() || {}) as Record<string, any>;
  const requestedDate = data.requestedDate || data.date || null;
  const requestedStartTime = data.requestedStartTime || data.startTime || null;
  const requestedEndTime = data.requestedEndTime || data.endTime || null;
  const isActive = data.isActive !== false;

  return {
    id: doc.id,
    ...data,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    status: data.status || 'pending',
    isActive,
  };
}

function isVenueBlock(slot: Record<string, any>) {
  return (
    String(slot.source || '').toLowerCase() === 'venue_block' ||
    String(slot.status || '').toLowerCase() === 'blocked'
  );
}

function slotRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Fetch all confirmed/paid orders for a venue.
 * Orders may or may not carry a venueId field (field added later; older orders lack it).
 * Strategy: query by venueId directly, then union with orders found via the venue's eventIds.
 */
async function fetchVenueOrders(db: any, venueId: string): Promise<any[]> {
  const [byVenue, eventsSnap] = await Promise.all([
    db.collection('orders').where('venueId', '==', venueId).get(),
    db.collection('events').where('venueId', '==', venueId).select('id').limit(100).get(),
  ]);

  const directIds = new Set<string>(byVenue.docs.map((d: any) => d.id));
  const directOrders: any[] = byVenue.docs.map((d: any) => d.data());

  const eventIds: string[] = eventsSnap.docs.map((d: any) => d.id);
  if (eventIds.length === 0) return directOrders;

  // Batch in groups of 30 (Firestore 'in' limit)
  const extraOrders: any[] = [];
  for (let i = 0; i < eventIds.length; i += 30) {
    const batch = eventIds.slice(i, i + 30);
    const snap = await db.collection('orders').where('eventId', 'in', batch).get();
    for (const d of snap.docs) {
      if (!directIds.has(d.id)) {
        directIds.add(d.id);
        extraOrders.push(d.data());
      }
    }
  }

  return [...directOrders, ...extraOrders];
}

/**
 * Venue Routes (discovery + partner management)
 */
export default async function venueRoutes(fastify: FastifyInstance) {
  // ── Venue Profile (Partner) ──────────────────────────────────────────────

  fastify.get(
    '/venue/profile',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const doc = await fastify.db.collection('venues').doc(venueId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Venue not found' });
      const enriched = await enrichVenueProfileWithSignedUrls({ id: doc.id, ...doc.data() });
      return { venue: enriched };
    },
  );

  fastify.patch(
    '/venue/profile',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: VenueProfilePatch })],
    },
    async (request: any, reply) => {
      const { venueId, patch } = request.body;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const safe: Record<string, any> = {};
      for (const k of ALLOWED_VENUE_PROFILE_FIELDS) {
        if (patch[k] !== undefined) safe[k] = patch[k];
      }

      // Clean signatures before saving
      cleanVenueProfilePatch(safe);

      safe.updatedAt = new Date().toISOString();
      await fastify.db.collection('venues').doc(venueId).update(safe);
      await fastify.publicDiscoveryService.syncVenueReadModels(venueId).catch(() => {});
      await fastify.invalidatePublicDiscovery('all').catch(() => {});
      const doc = await fastify.db.collection('venues').doc(venueId).get();
      const enriched = await enrichVenueProfileWithSignedUrls({ id: doc.id, ...doc.data() });
      return { venue: enriched };
    },
  );

  // ── Venue Partnerships (Partner) ─────────────────────────────────────────

  fastify.get(
    '/venue/partnerships',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('partnerships')
        .where('venueId', '==', venueId)
        .get();
      const partners = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      partners.sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      return { partnerships: partners };
    },
  );

  fastify.patch(
    '/venue/partnerships/:partnershipId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { partnershipId } = request.params as any;
      const { action } = request.body as any;
      if (!['approve', 'reject'].includes(action))
        return reply.status(400).send({ error: 'action must be approve or reject' });
      const ref = fastify.db.collection('partnerships').doc(partnershipId);
      const doc = await ref.get();
      if (!doc.exists) return reply.status(404).send({ error: 'Partnership not found' });
      const p = doc.data() as any;
      await fastify.verifyPartnerAccess(request, p.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      await ref.update({
        status: action === 'approve' ? 'active' : 'rejected',
        updatedAt: new Date().toISOString(),
      });
      return { success: true, status: action === 'approve' ? 'active' : 'rejected' };
    },
  );

  // ── Venue Notifications (Partner) ────────────────────────────────────────

  fastify.get(
    '/venue/notifications',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      await fastify.enrichAuthContext(request);
      const membership = request.authContext?.memberships?.find(
        (candidate: any) =>
          String(candidate.partnerId) === String(venueId) &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const permissions = getPermissionsForRole(
        membership?.partnerType || 'venue',
        membership?.role || '',
      );
      if (!permissions.includes('VIEW_FINANCIALS')) {
        return reply.status(403).send({ error: 'VIEW_FINANCIALS permission is required' });
      }

      try {
        // Remove orderBy to avoid indexing requirements, sort in memory
        const snap = await fastify.db
          .collection('notifications')
          .where('recipientId', '==', venueId)
          .limit(100)
          .get();

        const notifications = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        notifications.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        return { notifications: notifications.slice(0, 50) };
      } catch (err) {
        return { notifications: [] };
      }
    },
  );

  fastify.patch(
    '/venue/notifications/read',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: NotificationsReadBody })],
    },
    async (request: any, reply) => {
      const { venueId, notificationId, markAllRead } = request.body as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      if (markAllRead) {
        const snap = await fastify.db
          .collection('notifications')
          .where('recipientId', '==', venueId)
          .where('read', '==', false)
          .get();
        const batch = fastify.db.batch();
        snap.docs.forEach((d: any) => batch.update(d.ref, { read: true }));
        await batch.commit();
        return { success: true, markedCount: snap.size };
      }
      if (notificationId) {
        await fastify.db.collection('notifications').doc(notificationId).update({ read: true });
        return { success: true, markedCount: 1 };
      }
      return reply.status(400).send({ error: 'notificationId or markAllRead required' });
    },
  );

  // ── Venue Orders (Partner) ───────────────────────────────────────────────

  fastify.get(
    '/venue/orders',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueOrdersQuery })],
    },
    async (request: any, reply) => {
      const { venueId, limit = '20', cursor, status } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      await fastify.enrichAuthContext(request);
      const membership = request.authContext?.memberships?.find(
        (candidate: any) =>
          String(candidate.partnerId) === String(venueId) &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const permissions = getPermissionsForRole(
        membership?.partnerType || 'venue',
        membership?.role || '',
      );
      if (!permissions.includes('VIEW_FINANCIALS')) {
        return reply.status(403).send({ error: 'VIEW_FINANCIALS permission is required' });
      }

      try {
        const pageSize = Math.min(parseInt(limit), 100);

        let orders = await fetchVenueOrders(fastify.db, venueId);
        if (status) orders = orders.filter((o: any) => o.status === status);

        // Strip PII and sort newest-first in memory
        orders = orders.map((o: any) => ({ ...o, buyerEmail: undefined, buyerPhone: undefined }));
        orders.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        const sliced = orders.slice(0, pageSize);
        const hasMore = orders.length > pageSize;

        return {
          orders: sliced,
          hasMore,
          nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
        };
      } catch (err) {
        return { orders: [], hasMore: false };
      }
    },
  );

  fastify.get(
    '/venue/analytics/time-series',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: TimeSeriesSchema })],
    },
    async (request: any, reply) => {
      const { venueId, range, metric } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      try {
        const now = new Date();

        // Determine cutoff date and bucket count
        let cutoff: Date;
        let points: number;
        if (range === '1d') {
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          points = 24;
        } else if (range === '1w') {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          points = 7;
        } else if (range === '1m') {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          points = 30;
        } else {
          cutoff = new Date(0);
          points = 12;
        } // 'all' → 12 months

        const commerce = await getPartnerCommerceRows(fastify.db, venueId, 'venueId');

        // Build bucket map keyed by bucket identifier
        const buckets = new Map<string, { date: Date; tickets: number; revenue: number }>();

        if (range === '1d') {
          for (let i = 0; i < 24; i++) {
            const d = new Date(now);
            d.setMinutes(0, 0, 0);
            d.setHours(now.getHours() - (23 - i));
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
            buckets.set(key, { date: d, tickets: 0, revenue: 0 });
          }
        } else if (range === 'all') {
          for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            buckets.set(key, { date: d, tickets: 0, revenue: 0 });
          }
        } else {
          for (let i = 0; i < points; i++) {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(now.getDate() - (points - 1 - i));
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            buckets.set(key, { date: d, tickets: 0, revenue: 0 });
          }
        }

        for (const entry of commerce.ledger.filter((row) => row.type === 'venue_share')) {
          const ts = new Date(entry.createdAtIso || 0);
          if (range !== 'all' && ts < cutoff) continue;
          let key: string;
          if (range === '1d')
            key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}-${ts.getHours()}`;
          else if (range === 'all') key = `${ts.getFullYear()}-${ts.getMonth()}`;
          else key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;

          const bucket = buckets.get(key);
          if (!bucket) continue;
          bucket.revenue += Number(entry.amountPaise || 0) / 100;
        }

        for (const ticket of commerce.tickets) {
          const ts = new Date(ticket.createdAtIso || 0);
          if (range !== 'all' && ts < cutoff) continue;
          let key: string;
          if (range === '1d')
            key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}-${ts.getHours()}`;
          else if (range === 'all') key = `${ts.getFullYear()}-${ts.getMonth()}`;
          else key = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;

          const bucket = buckets.get(key);
          if (bucket) bucket.tickets += 1;
        }

        // Serialise into series array
        const series = Array.from(buckets.values()).map(({ date, tickets, revenue }) => {
          let label: string;
          if (range === '1d') label = `${date.getHours()}:00`;
          else if (range === 'all')
            label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return {
            date: date.toISOString(),
            label,
            value: metric === 'revenue' ? revenue : tickets,
            revenue,
            ticketsSold: tickets,
          };
        });

        const total = series.reduce((a, b) => a + b.value, 0);
        return { series, total };
      } catch (error: any) {
        fastify.log.error(`time-series failed: ${error.message}`);
        return reply.status(500).send({ error: 'Failed to fetch analytics' });
      }
    },
  );

  fastify.get(
    '/venue/analytics/overview',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [eventsSnap, commerceRows, checkinsSnap] = await Promise.all([
        fastify.db
          .collection('events')
          .where('venueId', '==', venueId)
          .get()
          .catch(() => ({ docs: [] as any[], size: 0 })),
        getPartnerCommerceRows(fastify.db, venueId, 'venueId'),
        fastify.db
          .collection('check_ins')
          .where('venueId', '==', venueId)
          .where('checkedInAt', '>=', thirtyDaysAgo)
          .get()
          .catch(() => ({ size: 0 })),
      ]);
      const totalRevenuePaise = commerceRows.ledger
        .filter((entry) => !entry.createdAtIso || entry.createdAtIso >= thirtyDaysAgo)
        .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
      const totalTickets = commerceRows.tickets.filter(
        (ticket) => !ticket.createdAtIso || ticket.createdAtIso >= thirtyDaysAgo,
      ).length;
      const totalCheckIns = (checkinsSnap as any).size || 0;
      const eventCount = (eventsSnap as any).size || ((eventsSnap as any).docs || []).length;
      return reply.send({
        period: '30d',
        totalRevenue: totalRevenuePaise / 100,
        totalTicketsSold: totalTickets,
        totalCheckIns,
        totalEvents: eventCount,
        events: { total: eventCount },
        revenue: { totalPaise: totalRevenuePaise, total: totalRevenuePaise / 100 },
        tickets: { sold: totalTickets },
        attendance: { checkedIn: totalCheckIns },
      });
    },
  );

  fastify.get(
    '/venue/overview/summary',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const cacheKey = `overview:${venueId}`;
      const cached = await fastify.cache.get('venue:overview', cacheKey);
      if (cached) {
        return reply.header('Cache-Control', 'private, max-age=120').send(cached);
      }

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [eventsSnap, allOrders, commerce] = await Promise.all([
        fastify.db.collection('events').where('venueId', '==', venueId).get(),
        fetchVenueOrders(fastify.db, venueId),
        getPartnerCommerceRows(fastify.db, venueId, 'venueId'),
      ]);

      const recentEvents = eventsSnap.docs
        .map((d: any) => d.data())
        .filter((e: any) => e.startDate && e.startDate >= weekAgo.toISOString());

      const confirmedOrders = allOrders.filter((o: any) => o.status === 'confirmed');

      const thisWeekOrders = confirmedOrders.filter((o: any) => {
        const ts = new Date(o.confirmedAt || o.createdAt || 0).getTime();
        return ts >= weekAgo.getTime();
      });
      const prevWeekOrders = confirmedOrders.filter((o: any) => {
        const ts = new Date(o.confirmedAt || o.createdAt || 0).getTime();
        return ts >= twoWeeksAgo.getTime() && ts < weekAgo.getTime();
      });

      const venueRevenueEntries = commerce.ledger.filter((entry) => entry.type === 'venue_share');
      const weekendRevenue =
        venueRevenueEntries
          .filter((entry) => new Date(entry.createdAtIso || 0).getTime() >= weekAgo.getTime())
          .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
      const prevRevenue =
        venueRevenueEntries
          .filter((entry) => {
            const timestamp = new Date(entry.createdAtIso || 0).getTime();
            return timestamp >= twoWeeksAgo.getTime() && timestamp < weekAgo.getTime();
          })
          .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
      const revenueTrendPct =
        prevRevenue === 0
          ? weekendRevenue > 0
            ? 100
            : 0
          : Math.round(((weekendRevenue - prevRevenue) / prevRevenue) * 100);

      const allGuestIds = new Set(confirmedOrders.map((o: any) => o.userId).filter(Boolean));
      const newGuestIds = new Set(thisWeekOrders.map((o: any) => o.userId).filter(Boolean));

      const summary = {
        weekendRevenue,
        revenueTrend: `${revenueTrendPct > 0 ? '+' : ''}${revenueTrendPct}%`,
        revenueTrendDirection: revenueTrendPct >= 0 ? 'up' : 'down',
        activeEventsCount: recentEvents.length,
        avgEntryVelocity: 0,
        totalGuestProfiles: allGuestIds.size,
        newGuestsThisWeek: newGuestIds.size,
      };

      await fastify.cache.set('venue:overview', cacheKey, summary, 120);
      return reply.header('Cache-Control', 'private, max-age=120').send(summary);
    },
  );

  fastify.get(
    '/venue/overview',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      // Return a combined or basic overview if called directly
      return reply.redirect(`/api/v1/venue/overview/summary?venueId=${venueId}`);
    },
  );

  fastify.get(
    '/venue/overview/tonight',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { eventId } = request.query as any;
      if (!eventId) return reply.status(400).send({ error: 'eventId required' });

      // Fetch event to get venueId for access check
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const eventData = eventDoc.data() as any;
      await fastify.verifyPartnerAccess(request, eventData.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const [commerce, checkinsSnap] = await Promise.all([
        getEventCommerceMetrics(fastify.db, eventId),
        fastify.db.collection('check_ins').where('eventId', '==', eventId).get(),
      ]);

      const revenue = commerce.netRevenue;
      const ticketsSold = commerce.ticketsSold;

      return {
        id: eventId,
        revenue,
        checkedIn: checkinsSnap.size,
        expected: ticketsSold, // Simple heuristic
        ticketsSold: ticketsSold,
        entryVelocity: 0,
        entryRate: 0,
        entryHistory: [],
      };
    },
  );

  fastify.get(
    '/venue/page',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const doc = await fastify.db.collection('venue_pages').doc(venueId).get();
      if (!doc.exists) {
        // Return default/minimal config
        return {
          venueId,
          theme: { primary: '#FF5A5F', secondary: '#000000' },
          sections: [],
          isActive: true,
        };
      }
      return { id: doc.id, ...doc.data() };
    },
  );

  fastify.post(
    '/venue/page',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, ...config } = request.body as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const now = new Date().toISOString();
      await fastify.db
        .collection('venue_pages')
        .doc(venueId)
        .set(
          {
            ...config,
            venueId,
            updatedAt: now,
          },
          { merge: true },
        );

      return { success: true };
    },
  );

  fastify.get(
    '/venue/crm/online',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueCrmQuery })],
    },
    async (request: any, reply) => {
      const { venueId, limit: limitStr, cursor } = request.query as any;
      const pageSize = Math.min(parseInt(limitStr) || 50, 100);
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      try {
        let q: any = fastify.db
          .collection('attendees')
          .where('venueId', '==', venueId)
          .limit(pageSize + 1);

        if (cursor) {
          const cursorDoc = await fastify.db.collection('attendees').doc(cursor).get();
          if (cursorDoc.exists) q = q.startAfter(cursorDoc);
        }

        const snap = await q.get();
        const docs = snap.docs.slice(0, pageSize);
        const hasMore = snap.docs.length > pageSize;

        const customers = docs.map((doc: any) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name || d.customerName || 'Anonymous',
            email: d.email || '',
            phone: d.phone || '',
            age: d.age || null,
            gender: d.gender || null,
            eventName: d.eventName || 'Event',
            entryTime: d.checkedInAt || d.createdAt || null,
            status: d.status || 'unknown',
          };
        });

        return { customers, hasMore, nextCursor: hasMore ? docs[docs.length - 1].id : null };
      } catch (error: any) {
        return { customers: [], hasMore: false };
      }
    },
  );

  fastify.get(
    '/venue/events',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueEventsSchema })],
    },
    async (request: any, reply) => {
      const { venueId, limit } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      try {
        // Primary query by venueId; secondary by creatorId for events saved before venueId fallback fix
        const [snap1, snap2] = await Promise.all([
          fastify.db.collection('events').where('venueId', '==', venueId).limit(100).get(),
          fastify.db.collection('events').where('creatorId', '==', venueId).limit(100).get(),
        ]);
        const seen = new Set<string>();
        const events: any[] = [];
        for (const snap of [snap1, snap2]) {
          for (const doc of snap.docs || []) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              events.push({ id: doc.id, ...doc.data() });
            }
          }
        }
        events.sort((a: any, b: any) => {
          const dateA = new Date(a.startDate || 0).getTime();
          const dateB = new Date(b.startDate || 0).getTime();
          return dateA - dateB;
        });

        return { events: events.slice(0, parseInt(limit)) };
      } catch (error: any) {
        return reply.status(500).send({ error: 'Failed to fetch events' });
      }
    },
  );

  fastify.patch(
    '/venue/events',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { eventId, action, data } = request.body;
      // Verify access to the event's venue
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const eventData = eventDoc.data() as any;
      await fastify.verifyPartnerAccess(request, eventData.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const now = new Date().toISOString();
      const statusMap: Record<string, string> = {
        approve: 'scheduled',
        reject: 'denied',
        pause: 'paused',
        resume: 'scheduled',
      };

      const newStatus = statusMap[action];
      if (!newStatus) return reply.status(400).send({ error: 'Invalid action' });

      await fastify.db
        .collection('events')
        .doc(eventId)
        .update({
          lifecycle: newStatus,
          updatedAt: now,
          ...(action === 'approve' ? { approvedAt: now } : {}),
        });

      return { success: true, status: newStatus };
    },
  );

  fastify.get(
    '/venue/events/requests',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const snap = await fastify.db
        .collection(AVAILABILITY_SLOTS_COLLECTION)
        .where('venueId', '==', venueId)
        .where('status', '==', 'pending')
        .limit(100)
        .get();

      const requests = snap.docs
        .map((doc: any) => normalizeSlotRecord(doc))
        .filter((slot) => !isVenueBlock(slot));
      requests.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      return { slotRequests: requests, requests };
    },
  );

  fastify.get(
    '/venue/orders/latest',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('latest_orders_feed')
        .where('venueId', '==', venueId)
        .limit(50)
        .get();
      const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      orders.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      return { orders: orders.slice(0, 20) };
    },
  );

  // ── Venue Finance (Partner) ──────────────────────────────────────────────

  // ── Venue Team (Staff) ───────────────────────────────────────────────────

  // ── Venue Team (Staff) ───────────────────────────────────────────────────
  // Bridged to /venue/staff to match Dashboard calls

  fastify.get(
    '/venue/staff',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: VenueIdQuery })],
    },
    async (request: any, reply) => {
      const { venueId, isActive } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      let q: any = fastify.db.collection('venue_staff').where('venueId', '==', venueId);
      if (isActive === 'true') q = q.where('isActive', '==', true);
      else if (isActive === 'false') q = q.where('isActive', '==', false);

      const snap = await q.get();
      return { staff: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.get(
    '/venue/staff-profiles',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('staff_profiles')
        .where('venueId', '==', venueId)
        .get();
      return { profiles: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.get(
    '/venue/staff-profiles/assignments',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('staff_assignments')
        .where('venueId', '==', venueId)
        .get();
      return { assignments: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.post(
    '/venue/staff-profiles/assign',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, profileId, memberId } = request.body as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const now = new Date().toISOString();
      await fastify.db
        .collection('staff_assignments')
        .add({ venueId, profileId, memberId, createdAt: now });
      return { success: true };
    },
  );

  fastify.post(
    '/venue/staff',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, email, role, name } = request.body as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const now = new Date().toISOString();
      const res = await fastify.db.collection('venue_staff').add({
        venueId,
        email: email.toLowerCase().trim(),
        name: name || '',
        role,
        status: 'invited',
        verified: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      return { success: true, id: res.id };
    },
  );

  fastify.patch(
    '/venue/staff',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, staffId, memberId, action, ...patch } = request.body as any;
      const targetId = staffId || memberId;
      if (!targetId) return reply.status(400).send({ error: 'staffId required' });

      const ref = fastify.db.collection('venue_staff').doc(targetId);
      const doc = await ref.get();
      if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
      const m = doc.data() as any;
      await fastify.verifyPartnerAccess(request, m.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const now = new Date().toISOString();
      const updates: any = { updatedAt: now };

      if (action === 'suspend') ((updates.status = 'suspended'), (updates.isActive = false));
      if (action === 'reactivate') ((updates.status = 'active'), (updates.isActive = true));
      if (action === 'verify') updates.verified = true;

      if (patch.role !== undefined) updates.role = patch.role;
      if (patch.isActive !== undefined) updates.isActive = patch.isActive;

      await ref.update(updates);
      return { success: true };
    },
  );

  fastify.delete(
    '/venue/staff',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { staffId, memberId } = request.query as any;
      const targetId = staffId || memberId;
      if (!targetId) return reply.status(400).send({ error: 'staffId required' });

      const doc = await fastify.db.collection('venue_staff').doc(targetId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
      const m = doc.data() as any;
      await fastify.verifyPartnerAccess(request, m.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      await fastify.db.collection('venue_staff').doc(targetId).update({
        isActive: false,
        status: 'removed',
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    },
  );

  fastify.patch(
    '/venue/staff/:memberId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { memberId } = request.params as any;
      const patch = request.body as any;
      const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
      const m = doc.data() as any;
      await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const safe: Record<string, any> = {};
      if (patch.role !== undefined) safe.role = patch.role;
      if (patch.isActive !== undefined) safe.isActive = patch.isActive;
      safe.updatedAt = new Date().toISOString();
      await fastify.db.collection('partner_memberships').doc(memberId).update(safe);
      return { success: true };
    },
  );

  fastify.delete(
    '/venue/staff/:memberId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { memberId } = request.params as any;
      const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
      const m = doc.data() as any;
      await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      await fastify.db
        .collection('partner_memberships')
        .doc(memberId)
        .update({ isActive: false, removedAt: new Date().toISOString() });
      return { success: true };
    },
  );

  // ── Venue Event Sub-routes ───────────────────────────────────────────────

  fastify.get(
    '/venue/events/:id/tickets',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { id: eventId } = request.params as any;
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const ev = eventDoc.data() as any;
      try {
        await fastify.verifyPartnerAccess(request, ev.venueId || ev.hostId || ev.creatorId);
      } catch {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const tiers = (ev.ticketTiers || ev.tiers || ev.tickets || []).map((t: any) => ({
        id: t.id || t.tierId,
        name: t.name,
        price: t.price,
        quantity: t.quantity || t.maxQuantity || 0,
        sold: t.sold || 0,
        status: t.status || 'active',
      }));
      return { tiers, eventId };
    },
  );

  // ── Slots (Venue Calendar Booking) ───────────────────────────────────────

  fastify.get(
    '/slots',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, hostId, status, limit = '50' } = request.query as any;
      if (!venueId && !hostId)
        return reply.status(400).send({ error: 'venueId or hostId required' });
      const partnerId = venueId || hostId;
      await fastify.verifyPartnerAccess(request, partnerId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      let q: any = fastify.db.collection(AVAILABILITY_SLOTS_COLLECTION);

      if (venueId) q = q.where('venueId', '==', venueId);
      if (hostId) q = q.where('hostId', '==', hostId);
      if (status) q = q.where('status', '==', status);
      q = q.limit(Math.min(parseInt(limit), 100));
      const snap = await q.get();
      const slotRequests = snap.docs
        .map((doc: any) => normalizeSlotRecord(doc))
        .sort((left: any, right: any) => {
          const leftTime = new Date(left.createdAt || 0).getTime();
          const rightTime = new Date(right.createdAt || 0).getTime();
          return rightTime - leftTime;
        });
      return { slotRequests, requests: slotRequests };
    },
  );

  fastify.get(
    '/slots/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const doc = await fastify.db.collection(AVAILABILITY_SLOTS_COLLECTION).doc(id).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Slot request not found' });
      const s: any = normalizeSlotRecord(doc);
      const partnerId = s.venueId || s.hostId;
      await fastify.verifyPartnerAccess(request, partnerId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      return { slotRequest: s };
    },
  );

  fastify.patch(
    '/slots/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const { action, counterDate, counterStartTime, counterEndTime, message, notes } =
        request.body as any;
      const validActions = ['approve', 'reject', 'counter', 'suggest', 'suggest_changes'];
      if (!validActions.includes(action))
        return reply
          .status(400)
          .send({ error: `action must be one of: ${validActions.join(', ')}` });
      const ref = fastify.db.collection(AVAILABILITY_SLOTS_COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return reply.status(404).send({ error: 'Slot request not found' });
      const s: any = normalizeSlotRecord(doc);
      await fastify.verifyPartnerAccess(request, s.venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const now = new Date().toISOString();
      const statusMap: Record<string, string> = {
        approve: 'approved',
        reject: 'rejected',
        counter: 'countered',
        suggest: 'changes_requested',
        suggest_changes: 'changes_requested',
      };
      const nextStatus = statusMap[action];

      const result = await fastify.db.runTransaction(async (transaction: any) => {
        const liveDoc = await transaction.get(ref);
        if (!liveDoc.exists) {
          const notFound: any = new Error('Slot request not found');
          notFound.statusCode = 404;
          notFound.code = 'NOT_FOUND';
          throw notFound;
        }

        const liveSlot: any = normalizeSlotRecord(liveDoc);
        const currentStatus = String(liveSlot.status || '').toLowerCase();
        if (currentStatus === nextStatus) {
          return {
            status: nextStatus,
            eventId: liveSlot.eventId,
            hostId: liveSlot.hostId,
            venueId: liveSlot.venueId,
            venueName: liveSlot.venueName,
            shouldNotify: false,
          };
        }

        const mutableStatuses = new Set(['pending', 'requested', 'countered', 'changes_requested']);
        if (!mutableStatuses.has(currentStatus)) {
          const conflict: any = new Error(`Slot request is already ${currentStatus}`);
          conflict.statusCode = 409;
          conflict.code = 'CONFLICT';
          throw conflict;
        }

        if (action === 'approve') {
          const approvalDate = liveSlot.requestedDate || liveSlot.date || null;
          const approvalStart = liveSlot.requestedStartTime || liveSlot.startTime || null;
          const approvalEnd = liveSlot.requestedEndTime || liveSlot.endTime || null;
          const sameDaySnap = await transaction.get(
            fastify.db
              .collection(AVAILABILITY_SLOTS_COLLECTION)
              .where('venueId', '==', liveSlot.venueId)
              .where('date', '==', approvalDate)
              .limit(100),
          );

          const conflictingApproval = sameDaySnap.docs.some((slotDoc: any) => {
            if (slotDoc.id === id) return false;
            const candidate = normalizeSlotRecord(slotDoc);
            const candidateStatus = String(candidate.status || '').toLowerCase();
            if (!['approved', 'booked', 'blocked'].includes(candidateStatus)) return false;

            const candidateStart = candidate.startTime || candidate.requestedStartTime || null;
            const candidateEnd = candidate.endTime || candidate.requestedEndTime || null;
            if (!candidateStart || !candidateEnd || !approvalStart || !approvalEnd) return true;
            return slotRangesOverlap(candidateStart, candidateEnd, approvalStart, approvalEnd);
          });

          if (conflictingApproval) {
            const conflict: any = new Error('The selected venue time slot is unavailable');
            conflict.statusCode = 409;
            conflict.code = 'CONFLICT';
            throw conflict;
          }
        }

        const updates: Record<string, any> = {
          status: nextStatus,
          updatedAt: now,
          respondedAt: now,
        };
        if (action === 'counter') {
          updates.counterDate = counterDate;
          updates.counterStartTime = counterStartTime;
          updates.counterEndTime = counterEndTime;
        }
        if (action === 'approve') {
          updates.date = liveSlot.requestedDate || liveSlot.date || null;
          updates.startTime = liveSlot.requestedStartTime || liveSlot.startTime || null;
          updates.endTime = liveSlot.requestedEndTime || liveSlot.endTime || null;
        }
        if (message || notes) updates.responseMessage = message || notes;
        transaction.update(ref, updates);

        if (liveSlot.eventId) {
          const eventRef = fastify.db.collection('events').doc(liveSlot.eventId);
          const eventDoc = await transaction.get(eventRef);
          if (eventDoc.exists) {
            const eventUpdates: Record<string, any> = {
              slotStatus: nextStatus,
              slotRespondedAt: now,
              updatedAt: now,
            };
            if (action === 'approve') {
              eventUpdates.lifecycle = 'scheduled';
              eventUpdates.approvedAt = now;
            } else if (action === 'reject') {
              eventUpdates.lifecycle = 'denied';
            }
            transaction.update(eventRef, eventUpdates);
          }
        }

        return {
          status: nextStatus,
          eventId: liveSlot.eventId,
          hostId: liveSlot.hostId,
          venueId: liveSlot.venueId,
          venueName: liveSlot.venueName,
          shouldNotify: action === 'approve' && !!liveSlot.eventId,
        };
      });

      if (result.shouldNotify) {
        await fastify.db.collection('notifications').add({
          recipientId: result.hostId,
          recipientType: 'host',
          type: 'slot_approved',
          slotRequestId: id,
          eventId: result.eventId,
          venueId: result.venueId,
          title: 'Slot Approved',
          message: `Your slot request for ${result.venueName || 'the venue'} has been approved.`,
          read: false,
          createdAt: now,
        });
        // Stamp visibility and sync public discovery index on approval
        if (result.eventId) {
          await fastify.db
            .collection('events')
            .doc(result.eventId)
            .update({ visibility: 'public', updatedAt: now })
            .catch(() => {});
          fastify.publicDiscoveryService.syncEventReadModels(result.eventId).catch(() => {});
        }
      }

      return { success: true, status: result.status };
    },
  );

  // NOTE: Public GET /venues and GET /venues/:id are defined in the
  // "Public Venue Directory" section below (core venue-service backed,
  // { success, data } envelope consumed by the mobile app). The earlier
  // inline Firestore versions were removed to avoid FST_ERR_DUPLICATED_ROUTE.

  // ── Cover Charge Reconciliation ───────────────────────────────────────────

  const CoverReconQuery = z.object({
    venueId: z.string(),
    eventId: z.string().optional(),
  });

  /**
   * GET /api/v1/venue/finance/cover-recon
   * Returns cover-charge wallet reconciliation for an event plus the
   * server-computed payoutTotal so the frontend never calculates the split.
   */
  fastify.get(
    '/venue/finance/cover-recon',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: CoverReconQuery })],
    },
    async (request: any, reply) => {
      const { venueId, eventId } = request.query as { venueId: string; eventId?: string };
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      await fastify.enrichAuthContext(request);
      const membership = request.authContext?.memberships?.find(
        (candidate: any) =>
          String(candidate.partnerId) === String(venueId) &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const permissions = getPermissionsForRole(
        membership?.partnerType || 'venue',
        membership?.role || '',
      );
      if (!permissions.includes('VIEW_FINANCIALS')) {
        return reply.status(403).send({ error: 'VIEW_FINANCIALS permission is required' });
      }

      try {
        // Fetch events for this venue
        const eventsSnap = await fastify.db
          .collection('events')
          .where('venueId', '==', venueId)
          .limit(100)
          .get();

        const events = eventsSnap.docs.map((d: any) => ({
          id: d.id,
          title: d.data().title || d.data().name || 'Untitled Event',
          startDate: d.data().startDate,
        }));

        events.sort((a: any, b: any) => {
          const dateA = new Date(a.startDate || 0).getTime();
          const dateB = new Date(b.startDate || 0).getTime();
          return dateB - dateA; // Descending for past events list
        });

        if (!eventId) {
          return { events, reconciliation: null };
        }

        const scopedEvent = await loadVenueScopedEvent(fastify.db, eventId, venueId);
        if (!scopedEvent) {
          return reply.status(404).send({ error: 'Reconciliation not found' });
        }

        const raw = (await generateReconciliation(eventId, venueId)) as any;
        const summary = raw.summary ?? raw;

        const grossCollection = Number(summary.openingBalancePaise ?? 0);
        const totalRedeemed = Number(
          summary.consumedBalancePaise ?? summary.totalDebitedPaise ?? 0,
        );
        const breakageRevenue = Number(
          summary.netVenueForfeitedValuePaise ?? summary.expiredBalancePaise ?? 0,
        );
        const walletsIssued = Number(summary.walletsIssued ?? 0);

        const commerce = await getEventCommerceMetrics(fastify.db, eventId);
        const ticketRevenuePaise = commerce.netRevenuePaise;
        const canonicalVenueSharePaise = commerce.ledgerEntries
          .filter(
            (entry: any) =>
              entry.type === 'venue_share' && String(entry.toPartnerId) === String(venueId),
          )
          .reduce((sum: number, entry: any) => sum + Number(entry.amountPaise || 0), 0);

        const isLive = scopedEvent.data.status === 'live';

        return {
          events,
          reconciliation: {
            eventId,
            grossCollection,
            totalRedeemed,
            breakageRevenue,
            walletsIssued,
            ticketRevenuePaise,
            canonicalVenueSharePaise,
            payoutTotal: canonicalVenueSharePaise,
            isLive: Boolean(isLive),
            itemDistribution: Array.isArray(raw.itemDistribution) ? raw.itemDistribution : [],
            exceptionList: Array.isArray(summary.exceptionList) ? summary.exceptionList : [],
            reconciliationDifferencePaise: Number(summary.reconciliationDifferencePaise || 0),
          },
        };
      } catch (err: any) {
        fastify.log.error(`Cover-recon error venueId=${venueId}: ${err.message}`);
        return reply.status(500).send({ error: 'Failed to load reconciliation' });
      }
    },
  );

  // ── Venue Calendar ──────────────────────────────────────────────────────

  fastify.get(
    '/venue/calendar',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, startDate, endDate } = request.query as any;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      if (!startDate || !endDate)
        return reply.status(400).send({ error: 'startDate and endDate required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      // Fetch events and availability slots for the range.
      // All scheduling reads come from availability_slots now.
      const [eventsSnap, slotsSnap] = await Promise.all([
        fastify.db.collection('events').where('venueId', '==', venueId).get(),
        fastify.db.collection(AVAILABILITY_SLOTS_COLLECTION).where('venueId', '==', venueId).get(),
      ]);

      const events = eventsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter(
          (e) =>
            isBlockingCalendarEvent(e) &&
            (!startDate || e.startDate >= startDate) &&
            (!endDate || e.startDate <= endDate),
        );
      const slots = slotsSnap.docs
        .map((doc: any) => normalizeSlotRecord(doc))
        .filter((slot) => {
          const slotDate = slot.requestedDate || slot.date;
          return (!startDate || slotDate >= startDate) && (!endDate || slotDate <= endDate);
        });
      const blocks = slots.filter((slot: any) => isVenueBlock(slot));

      const dates: any[] = [];
      let cur = new Date(startDate);
      const end = new Date(endDate);

      while (cur <= end) {
        const ds = cur.toISOString().split('T')[0];
        const dayEvents = events.filter((e: any) => e.startDate.startsWith(ds));
        const daySlots = slots.filter(
          (s: any) => (s.requestedDate || s.date) === ds && !isVenueBlock(s),
        );
        const block = blocks.find((b: any) => b.date === ds);
        const confirmedSlots = daySlots.filter((slot: any) =>
          ['approved', 'booked'].includes(String(slot.status || '').toLowerCase()),
        );

        dates.push({
          date: ds,
          state: block
            ? 'BLOCKED'
            : dayEvents.length > 0 || confirmedSlots.length > 0
              ? 'CONFIRMED'
              : 'OPEN',
          events: dayEvents,
          slots: daySlots,
          block: block || null,
          stats: {
            eventCount: dayEvents.length,
            pendingSlots: daySlots.filter((s: any) => s.status === 'pending').length,
          },
        });
        cur.setDate(cur.getDate() + 1);
      }

      return dates;
    },
  );

  fastify.post(
    '/venue/calendar',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, type, action, date, startTime, endTime, reason, slotId } =
        request.body as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const now = new Date().toISOString();
      const normalizedAction = String(action || type || '').toLowerCase();
      if (normalizedAction === 'block') {
        const blockRef = await fastify.db.collection(AVAILABILITY_SLOTS_COLLECTION).add({
          venueId,
          date,
          requestedDate: date,
          startTime: startTime || null,
          endTime: endTime || null,
          requestedStartTime: startTime || null,
          requestedEndTime: endTime || null,
          reason,
          source: 'venue_block',
          status: 'blocked',
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, slotId: blockRef.id };
      }
      if (normalizedAction === 'unblock') {
        const batch = fastify.db.batch();
        let docs: any[] = [];

        if (slotId) {
          const blockDoc = await fastify.db
            .collection(AVAILABILITY_SLOTS_COLLECTION)
            .doc(slotId)
            .get();
          if (blockDoc.exists) docs = [blockDoc];
        } else {
          const snapshot = await fastify.db
            .collection(AVAILABILITY_SLOTS_COLLECTION)
            .where('venueId', '==', venueId)
            .where('date', '==', date)
            .where('source', '==', 'venue_block')
            .get();
          docs = snapshot.docs.filter((doc) => {
            const data = doc.data() as Record<string, any>;
            if (startTime && data.startTime && data.startTime !== startTime) return false;
            if (endTime && data.endTime && data.endTime !== endTime) return false;
            return true;
          });
        }

        docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        return { success: true, removedCount: docs.length };
      }

      return reply.status(400).send({ error: 'action must be block or unblock' });
    },
  );

  fastify.delete(
    '/venue/calendar',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, date, startTime, endTime, slotId } = request.query as any;
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const batch = fastify.db.batch();
      let docs: any[] = [];

      if (slotId) {
        const blockDoc = await fastify.db
          .collection(AVAILABILITY_SLOTS_COLLECTION)
          .doc(slotId)
          .get();
        if (blockDoc.exists) docs = [blockDoc];
      } else {
        const snapshot = await fastify.db
          .collection(AVAILABILITY_SLOTS_COLLECTION)
          .where('venueId', '==', venueId)
          .where('date', '==', date)
          .where('source', '==', 'venue_block')
          .get();
        docs = snapshot.docs.filter((doc) => {
          const data = doc.data() as Record<string, any>;
          if (startTime && data.startTime && data.startTime !== startTime) return false;
          if (endTime && data.endTime && data.endTime !== endTime) return false;
          return true;
        });
      }

      docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return { success: true, removedCount: docs.length };
    },
  );

  fastify.get('/venue/staff/accept', async (request: any, reply) => {
    const { code, venue } = request.query as any;
    if (!code || !venue) {
      return reply.status(400).send({ error: 'code and venue parameters required' });
    }

    try {
      const snap = await fastify.db
        .collection('venue_staff')
        .where('venueId', '==', venue)
        .where('inviteToken', '==', code)
        .limit(1)
        .get();

      if (snap.empty) {
        return reply.status(404).send({ error: 'Invitation not found or invalid' });
      }

      const staffData = snap.docs[0].data();
      if (staffData.inviteExpires && new Date() > new Date(staffData.inviteExpires)) {
        return reply.status(400).send({ error: 'Invitation has expired' });
      }

      if (staffData.status !== 'invited' && staffData.status !== 'active') {
        return reply.status(400).send({ error: 'Invitation already accepted' });
      }

      const venueDoc = await fastify.db.collection('venues').doc(venue).get();
      const venueName = venueDoc.exists ? venueDoc.data()?.name || 'Venue' : 'Venue';

      return {
        name: staffData.name,
        email: staffData.email,
        role: staffData.role,
        venueName,
        status: staffData.status,
      };
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'GET /venue/staff/accept failed');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/venue/staff/accept', async (request: any, reply) => {
    const { inviteCode, venueId } = request.body as any;
    if (!inviteCode || !venueId) {
      return reply.status(400).send({ error: 'inviteCode and venueId required' });
    }

    try {
      const snap = await fastify.db
        .collection('venue_staff')
        .where('venueId', '==', venueId)
        .where('inviteToken', '==', inviteCode)
        .limit(1)
        .get();

      if (snap.empty) {
        return reply.status(404).send({ error: 'Invitation not found or invalid' });
      }

      const staffDoc = snap.docs[0];
      const staffData = staffDoc.data();

      if (staffData.inviteExpires && new Date() > new Date(staffData.inviteExpires)) {
        return reply.status(400).send({ error: 'Invitation has expired' });
      }

      if (staffData.status === 'active') {
        let customToken = '';
        try {
          const userRecord = await fastify.auth.getUserByEmail(staffData.email);
          customToken = await fastify.auth.createCustomToken(userRecord.uid);
        } catch (tokenErr) {
          fastify.log.error(
            { err: tokenErr },
            'Failed to generate custom token for already active staff',
          );
        }
        return {
          success: true,
          email: staffData.email,
          customToken,
          alreadyAccepted: true,
        };
      }

      if (staffData.status !== 'invited') {
        return reply.status(400).send({ error: 'Invitation already accepted' });
      }

      const email = staffData.email;
      const name = staffData.name;
      const role = staffData.role;
      const tempPassword = decrypt(staffData.tempPassword);

      // 1. Create the user in Firebase Auth if they don't exist
      let userRecord;
      try {
        userRecord = await fastify.auth.getUserByEmail(email);
        // User exists, update password to the new tempPassword
        await fastify.auth.updateUser(userRecord.uid, {
          password: tempPassword,
        });
        // Reset mustChangePassword to true in Firestore user record and update role/approval
        await fastify.db.collection('users').doc(userRecord.uid).update({
          role: 'staff',
          isApproved: true,
          onboardingComplete: true,
          mustChangePassword: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await fastify.auth.createUser({
            email,
            password: tempPassword,
            displayName: name,
          });

          // Seed Firestore user doc immediately with mustChangePassword: true
          await fastify.db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName: name,
            role: 'staff',
            isApproved: true,
            onboardingComplete: true,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          throw e;
        }
      }

      const uid = userRecord.uid;

      // Get venue details for membership record
      const venueDoc = await fastify.db.collection('venues').doc(venueId).get();
      const venueName = venueDoc.exists ? venueDoc.data()?.name || 'Venue' : 'Venue';

      // 2. Create or update the partner_memberships document
      const membershipSnap = await fastify.db
        .collection('partner_memberships')
        .where('partnerId', '==', venueId)
        .where('uid', '==', uid)
        .limit(1)
        .get();

      if (membershipSnap.empty) {
        await fastify.db.collection('partner_memberships').add({
          uid,
          partnerId: venueId,
          partnerName: venueName,
          partnerType: 'venue',
          role,
          isActive: true,
          joinedAt: Date.now(),
          createdAt: new Date().toISOString(),
        });
      } else {
        await membershipSnap.docs[0].ref.update({
          isActive: true,
          role,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Update the venue_staff record status to active
      await staffDoc.ref.update({
        status: 'active',
        verified: true,
        isActive: true,
        userId: uid,
        updatedAt: new Date().toISOString(),
      });

      const customToken = await fastify.auth.createCustomToken(uid);
      return { success: true, email, customToken };
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'POST /venue/staff/accept failed');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post(
    '/venue/upload',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const fields = data.fields as any;
      const venueId = fields.venueId?.value;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const buffer = await data.toBuffer();
      const ext = (data.filename || 'file').split('.').pop() || 'bin';
      const storagePath = `venues/${venueId}/${Date.now()}.${ext}`;
      const bucket = getAdminStorage().bucket();
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        metadata: { contentType: data.mimetype || 'application/octet-stream' },
      });
      await file.makePublic();

      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      const signedUrl = await signStorageUrl(url);

      return {
        success: true,
        url: signedUrl,
        filename: data.filename,
      };
    },
  );

  fastify.get(
    '/venue/presence',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const snap = await fastify.db
        .collection('venue_staff')
        .where('venueId', '==', venueId)
        .where('isActive', '==', true)
        .get();

      const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
      return {
        presence: snap.docs.map((d) => {
          const data = d.data() as any;
          const lastSeen = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0;
          return {
            id: d.id,
            ...data,
            isOnline: lastSeen > 0 && Date.now() - lastSeen < ONLINE_THRESHOLD_MS,
          };
        }),
      };
    },
  );
  // ── Public Venue Directory ──────────────────────────────────────────────

  const VenueDirectoryQuery = z.object({ city: z.string().optional() });
  const VenuePublicIdParam = z.object({ id: z.string() });

  fastify.get(
    '/venues',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ querystring: VenueDirectoryQuery })],
    },
    async (request: any, reply: any) => {
      try {
        const { getAllVenues } = await import('@c1rcle/core/venue-service');
        const venues = await getAllVenues(fastify.db, request.query.city);
        return { success: true, data: venues };
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'GET /venues failed');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  fastify.get(
    '/venues/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: VenuePublicIdParam })],
    },
    async (request: any, reply: any) => {
      try {
        const { getVenueById } = await import('@c1rcle/core/venue-service');
        const venue = await getVenueById(fastify.db, request.params.id);
        return { success: true, data: venue };
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'GET /venues/:id failed');
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: 'Venue not found' });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  fastify.get(
    '/venues/:id/events',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: VenuePublicIdParam })],
    },
    async (request: any, reply: any) => {
      try {
        const { getVenueEvents } = await import('@c1rcle/core/venue-service');
        const events = await getVenueEvents(fastify.db, request.params.id);
        return { success: true, data: events };
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'GET /venues/:id/events failed');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );
}

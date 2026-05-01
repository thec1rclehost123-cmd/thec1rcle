import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolvePartnerContext, requireType } from '../../../lib/partner-context.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { VenueService } from '../../../services/unified/venue-service.js';
import { SchedulingService } from '../../../services/unified/scheduling-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';
import { buildPayoutAccountRecord } from '../../../lib/partner-hardening.js';

const EventFiltersSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'published', 'live', 'completed', 'cancelled']).optional(),
  cursor: z.string().optional(),
  lastId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).passthrough();

const CalendarQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

const CreateSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['open', 'blocked']).optional(),
  notes: z.string().max(500).optional(),
});

const UpdateSlotSchema = z.object({
  status: z.enum(['open', 'blocked']).optional(),
  notes: z.string().max(500).optional(),
}).strict();

const SlotActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(500).optional(),
}).strict();

const PartnershipUpdateSchema = z.object({
  status: z.string().optional(),
  action: z.string().optional(),
}).passthrough();

type PlainRecord = Record<string, any>;

function asRecord(value: unknown): PlainRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PlainRecord : {};
}

function asArray<T = PlainRecord>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function toNumber(value: any): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function mapByAnyId(items: PlainRecord[], candidates: string[]) {
  const map = new Map<string, PlainRecord>();
  for (const item of items) {
    for (const candidate of candidates) {
      const value = item?.[candidate];
      if (value !== undefined && value !== null && String(value)) {
        map.set(String(value), item);
        break;
      }
    }
  }
  return map;
}

function mergeVenueEvents(legacyItems: PlainRecord[], unifiedItems: PlainRecord[]) {
  const unifiedById = mapByAnyId(unifiedItems, ['eventId', 'id']);
  const merged: PlainRecord[] = [];
  const seen = new Set<string>();

  for (const legacyItem of legacyItems) {
    const id = String(legacyItem?.id || legacyItem?.eventId || '');
    const unifiedItem = unifiedById.get(id) || {};
    seen.add(id);
    merged.push({
      ...legacyItem,
      ...unifiedItem,
      id,
      eventId: String(unifiedItem.eventId || legacyItem.id || ''),
      title: legacyItem.title ?? unifiedItem.title ?? legacyItem.name ?? '',
      name: legacyItem.name ?? unifiedItem.title ?? legacyItem.title ?? '',
      startDate: unifiedItem.startDate ?? legacyItem.startDate ?? legacyItem.date ?? null,
      endDate: unifiedItem.endDate ?? legacyItem.endDate ?? null,
      venueId: unifiedItem.venueId ?? legacyItem.venueId ?? '',
      venueName: unifiedItem.venueName ?? legacyItem.venueName ?? legacyItem.venue ?? '',
      venue: legacyItem.venue ?? unifiedItem.venueName ?? legacyItem.venueName ?? '',
      status: legacyItem.status ?? unifiedItem.status ?? legacyItem.lifecycle ?? 'draft',
      lifecycle: legacyItem.lifecycle ?? unifiedItem.status ?? legacyItem.status ?? 'draft',
      submissionStatus: unifiedItem.submissionStatus ?? legacyItem.submissionStatus ?? 'not_submitted',
      image: legacyItem.image ?? unifiedItem.coverImage ?? legacyItem.coverImage ?? null,
      coverImage: unifiedItem.coverImage ?? legacyItem.image ?? legacyItem.coverImage ?? null,
      ticketsSold: toNumber(unifiedItem.ticketsSold ?? legacyItem.ticketsSold),
      revenue: toNumber(unifiedItem.revenue ?? legacyItem.revenue),
      capacity: toNumber(unifiedItem.capacity ?? legacyItem.capacity),
    });
  }

  for (const unifiedItem of unifiedItems) {
    const id = String(unifiedItem?.eventId || unifiedItem?.id || '');
    if (!id || seen.has(id)) continue;
    merged.push({
      ...unifiedItem,
      id,
      eventId: id,
      title: unifiedItem.title ?? '',
      name: unifiedItem.title ?? '',
      startDate: unifiedItem.startDate ?? null,
      endDate: unifiedItem.endDate ?? null,
      venueId: unifiedItem.venueId ?? '',
      venueName: unifiedItem.venueName ?? '',
      venue: unifiedItem.venueName ?? '',
      status: unifiedItem.status ?? 'draft',
      lifecycle: unifiedItem.status ?? 'draft',
      submissionStatus: unifiedItem.submissionStatus ?? 'not_submitted',
      image: unifiedItem.coverImage ?? null,
      coverImage: unifiedItem.coverImage ?? null,
      ticketsSold: toNumber(unifiedItem.ticketsSold),
      revenue: toNumber(unifiedItem.revenue),
      capacity: toNumber(unifiedItem.capacity),
    });
  }

  return merged;
}

function mergeVenuePartnerships(legacyItems: PlainRecord[], unifiedItems: PlainRecord[]) {
  const unifiedById = mapByAnyId(unifiedItems, ['partnershipId', 'id']);
  const merged: PlainRecord[] = [];
  const seen = new Set<string>();

  for (const legacyItem of legacyItems) {
    const id = String(legacyItem?.id || legacyItem?.partnershipId || '');
    const unifiedItem = unifiedById.get(id) || {};
    const isActive = legacyItem.isActive ?? (unifiedItem.status === 'active');
    seen.add(id);
    merged.push({
      ...legacyItem,
      ...unifiedItem,
      id,
      partnershipId: id,
      partnerId: unifiedItem.partnerId ?? legacyItem.partnerId ?? legacyItem.uid ?? '',
      uid: legacyItem.uid ?? unifiedItem.partnerId ?? null,
      displayName: unifiedItem.displayName ?? legacyItem.displayName ?? legacyItem.name ?? legacyItem.email ?? '',
      name: legacyItem.name ?? unifiedItem.displayName ?? legacyItem.displayName ?? '',
      email: legacyItem.email ?? null,
      role: legacyItem.role ?? 'partner',
      type: unifiedItem.type ?? legacyItem.partnerType ?? 'host',
      status: legacyItem.status ?? unifiedItem.status ?? (isActive ? 'active' : 'inactive'),
      connectedAt: unifiedItem.connectedAt ?? legacyItem.createdAt ?? null,
      createdAt: legacyItem.createdAt ?? unifiedItem.connectedAt ?? null,
      isActive: legacyItem.isActive ?? (unifiedItem.status === 'active'),
    });
  }

  for (const unifiedItem of unifiedItems) {
    const id = String(unifiedItem?.partnershipId || unifiedItem?.id || '');
    if (!id || seen.has(id)) continue;
    merged.push({
      ...unifiedItem,
      id,
      partnershipId: id,
      partnerId: unifiedItem.partnerId ?? '',
      uid: unifiedItem.partnerId ?? null,
      displayName: unifiedItem.displayName ?? '',
      name: unifiedItem.displayName ?? '',
      email: null,
      role: 'partner',
      type: unifiedItem.type ?? 'host',
      status: unifiedItem.status ?? 'inactive',
      connectedAt: unifiedItem.connectedAt ?? null,
      createdAt: unifiedItem.connectedAt ?? null,
      isActive: unifiedItem.status === 'active',
    });
  }

  return merged;
}

function derivePartnershipAction(body: PlainRecord) {
  if (typeof body.action === 'string' && body.action) return body.action;
  const status = String(body.status || '').toLowerCase();
  if (['active', 'approved', 'approve'].includes(status)) return 'approve';
  if (['reject', 'rejected', 'inactive', 'declined'].includes(status)) return 'reject';
  return undefined;
}

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
  return String(slot.source || '').toLowerCase() === 'venue_block' || String(slot.status || '').toLowerCase() === 'blocked';
}

function slotRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export default async function partnersVenueRoutes(fastify: FastifyInstance) {
  const svcCtx = { db: fastify.db, log: fastify.log, redis: fastify.redis };
  const financeService = new FinanceService(svcCtx);
  const venueService = new VenueService(svcCtx);
  const schedulingService = new SchedulingService(svcCtx);

  const requireVenueContext = async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) {
      reply.status(403).send(buildErrorResponse({
        code: 'FORBIDDEN',
        message: 'No partner identity found',
        requestId: request.id,
      }));
      return null;
    }

    requireType(ctx, 'venue');
    return ctx;
  };

  const buildLegacyOverviewSummary = async (venueId: string) => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const [eventsSnap] = await Promise.all([
      fastify.db.collection('events').where('venueId', '==', venueId).get().catch(() => ({ docs: [] as any[] })),
    ]);
    const recentEvents = ((eventsSnap as any).docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((event: any) => event.startDate && event.startDate >= weekAgo.toISOString());
    return {
      weekendRevenue: 0,
      revenueTrend: '0%',
      revenueTrendDirection: 'up',
      activeEventsCount: recentEvents.length,
      avgEntryVelocity: 0,
      totalGuestProfiles: 0,
      newGuestsThisWeek: 0,
    };
  };

  const buildLegacyCalendar = async (venueId: string, startDate: string, endDate: string) => {
    const [eventsSnap, slotsSnap] = await Promise.all([
      fastify.db.collection('events')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('availability_slots')
        .where('venueId', '==', venueId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ]);
    const allEvents = ((eventsSnap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    const allSlots = ((slotsSnap as any).docs || []).map((doc: any) => normalizeSlotRecord(doc));
    const dates: any[] = [];
    const cur = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    while (cur <= end) {
      const dateKey = cur.toISOString().slice(0, 10);
      const dayEvents = allEvents.filter((event: any) => String(event.startDate || '').slice(0, 10) === dateKey);
      const daySlots = allSlots.filter((slot: any) => String(slot.date || '') === dateKey);
      const block = daySlots.find((slot: any) => isVenueBlock(slot)) || null;
      dates.push({
        date: dateKey,
        state: block ? 'blocked' : dayEvents.length > 0 ? 'booked' : daySlots.length > 0 ? 'available' : 'empty',
        events: dayEvents,
        slots: daySlots,
        block,
        stats: {
          eventCount: dayEvents.length,
          pendingSlots: daySlots.filter((slot: any) => String(slot.status || '').toLowerCase() === 'pending').length,
        },
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  };

  const buildLegacyVenueEvents = async (venueId: string, query: Record<string, any>) => {
    const limit = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
    const snapshot = await fastify.db.collection('events').where('venueId', '==', venueId).limit(100).get().catch(() => ({ docs: [] as any[] }));
    let events = ((snapshot as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    if (query.status && query.status !== 'all') {
      events = events.filter((event: any) => String(event.lifecycle || event.status || '').toLowerCase() === String(query.status).toLowerCase());
    }
    events.sort((a: any, b: any) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
    return { events: events.slice(0, limit) };
  };

  const buildLegacyVenuePartnerships = async (venueId: string) => {
    const snap = await fastify.db.collection('partnerships').where('venueId', '==', venueId).get().catch(() => ({ docs: [] as any[] }));
    const partnerships = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    partnerships.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return { partnerships };
  };

  const updateVenuePartnership = async (venueId: string, partnershipId: string, body: Record<string, any>) => {
    const action = derivePartnershipAction(body);
    if (!action) {
      const err: any = new Error('action must be approve or reject');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const ref = fastify.db.collection('partnerships').doc(partnershipId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Partnership not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const partnership = doc.data() as Record<string, any>;
    if (String(partnership.venueId || '') !== venueId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    const status = action === 'approve' ? 'active' : 'rejected';
    await ref.update({ status, updatedAt: new Date().toISOString() });
    return { success: true, status };
  };

  const listPublicVenues = async (query: Record<string, any>) => {
    const sort = String(query.sort || 'Popular');
    const limit = Number(query.limit || 12);
    let q: any = fastify.db.collection('venues');
    if (sort === 'Popular') q = q.orderBy('heatScore', 'desc');
    else if (sort === 'new') q = q.orderBy('createdAt', 'desc');
    q = q.limit(limit);
    const snapshot = await q.get();
    return { venues: snapshot.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) };
  };

  const getPublicVenueDetail = async (idOrSlug: string) => {
    let venue: any = null;
    let venueId = idOrSlug;
    const docSnap = await fastify.db.collection('venues').doc(idOrSlug).get();
    if (docSnap.exists) {
      venue = { id: docSnap.id, ...(docSnap.data() || {}) };
    } else {
      const slugSnap = await fastify.db.collection('venues').where('slug', '==', idOrSlug).limit(1).get();
      if (!slugSnap.empty) {
        const doc = slugSnap.docs[0];
        venue = { id: doc.id, ...(doc.data() || {}) };
        venueId = doc.id;
      }
    }
    if (!venue) {
      const err: any = new Error('Venue not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const now = new Date().toISOString();
    const [highlightsSnap, gallerySnap, menuSnap, facilitiesSnap, eventsSnap] = await Promise.all([
      fastify.db.collection('venue_highlights').where('venueId', '==', venueId).where('isActive', '==', true).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('venue_gallery').where('venueId', '==', venueId).limit(50).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('venue_menu').where('venueId', '==', venueId).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('venue_facilities').where('venueId', '==', venueId).where('isEnabled', '==', true).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('events').where('venueId', '==', venueId).get().catch(() => ({ docs: [] as any[] })),
    ]);
    const highlights = ((highlightsSnap as any).docs || []).map((item: any) => ({ id: item.id, ...(item.data() || {}) })).sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const gallery = ((gallerySnap as any).docs || []).map((item: any) => ({ id: item.id, ...(item.data() || {}) })).sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const menu = ((menuSnap as any).docs || []).map((item: any) => ({ id: item.id, ...(item.data() || {}) })).sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const facilities = ((facilitiesSnap as any).docs || []).map((item: any) => ({ id: item.id, ...(item.data() || {}) })).sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const upcomingEvents = ((eventsSnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .filter((event: any) => event.startDate >= now)
      .sort((a: any, b: any) => String(a.startDate || '').localeCompare(String(b.startDate || '')))
      .slice(0, 10);
    return { venue, highlights, gallery: gallery.slice(0, 9), menu, facilities, upcomingEvents };
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get('/partners/venues/overview', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const cacheKey = `partners:venue:overview:${ctx.partnerId}:contract-v1`;
      const cached = await fastify.cache.get('partners', cacheKey);
      if (cached) return reply.header('Cache-Control', 'private, max-age=120').send({ ...cached, fromCache: true });

      const [result, legacyBody] = await Promise.all([
        venueService.getOverview(ctx),
        buildLegacyOverviewSummary(ctx.partnerId),
      ]);
      const normalized = {
        ...legacyBody,
        weekendRevenue: toNumber(legacyBody.weekendRevenue ?? result.stats.totalRevenue),
        revenueTrend: legacyBody.revenueTrend ?? '0%',
        revenueTrendDirection: legacyBody.revenueTrendDirection ?? 'up',
        activeEventsCount: toNumber(legacyBody.activeEventsCount ?? result.stats.upcomingEventsCount),
        avgEntryVelocity: toNumber(legacyBody.avgEntryVelocity),
        totalGuestProfiles: toNumber(legacyBody.totalGuestProfiles ?? result.stats.totalGuestsCheckedIn),
        newGuestsThisWeek: toNumber(legacyBody.newGuestsThisWeek),
        dataReady: true,
        stats: result.stats,
        tonightOps: result.tonightOps,
        alerts: result.alerts,
        finance: (legacyBody as any).finance ?? null,
        _meta: {
          ...asRecord((legacyBody as any)._meta),
          partnerId: ctx.partnerId,
          source: 'partners/venues/overview',
        },
      };

      await fastify.cache.set('partners', cacheKey, normalized, 120);
      return reply.header('Cache-Control', 'private, max-age=120').send(normalized);
    } catch (err: any) {
      fastify.log.error({ err: err.message, partnerId: ctx.partnerId }, 'partners/venues/overview error');
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Calendar ───────────────────────────────────────────────────────────────

  fastify.get('/partners/venues/calendar', {
    preHandler: [
      fastify.validate({ querystring: CalendarQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      return reply.send(await buildLegacyCalendar(ctx.partnerId, request.query.startDate, request.query.endDate));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/venues/calendar/slots', {
    preHandler: [
      fastify.validate({ body: CreateSlotSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const slot = await schedulingService.createSlot(ctx, ctx.partnerId, request.body);
      return reply.status(201).send({ slot });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/venues/calendar/slots/:slotId', {
    preHandler: [
      fastify.validate({ body: UpdateSlotSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const { status, notes } = request.body;
      const slot = await schedulingService.updateSlotStatus(ctx, ctx.partnerId, request.params.slotId, status, notes);
      if (!slot) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Slot not found', requestId: request.id }));
      return reply.send({ slot });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Slot requests (incoming from hosts) ───────────────────────────────────

  fastify.get('/partners/venues/slot-requests', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const requests = await schedulingService.getPendingRequests(ctx.partnerId);
      return reply.header('Cache-Control', 'private, max-age=30').send({ requests });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/venues/slot-requests/:slotId', {
    preHandler: [
      fastify.validate({ body: SlotActionSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const { action, notes } = request.body;
      const slot = action === 'approve'
        ? await schedulingService.approveRequest(ctx, ctx.partnerId, request.params.slotId, notes)
        : await schedulingService.rejectRequest(ctx, ctx.partnerId, request.params.slotId, notes);

      if (!slot) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Slot request not found', requestId: request.id }));
      return reply.send({ slot });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Events ─────────────────────────────────────────────────────────────────

  fastify.get('/partners/venues/events', {
    preHandler: [
      fastify.validate({ querystring: EventFiltersSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const filters = {
        status: request.query.status,
        cursor: request.query.cursor ?? request.query.lastId,
        limit: request.query.limit,
      };
      const [result, legacyBody] = await Promise.all([
        venueService.getEvents(ctx, filters),
        buildLegacyVenueEvents(ctx.partnerId, request.query),
      ]);
      const events = mergeVenueEvents(asArray(legacyBody.events), asArray(result.data));
      return reply.header('Cache-Control', 'private, max-age=60').send({
        ...legacyBody,
        events,
        data: events,
        hasMore: Boolean(result.hasMore ?? (legacyBody as any).hasMore),
        nextCursor: result.nextCursor ?? (legacyBody as any).nextCursor ?? null,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Guest ops ──────────────────────────────────────────────────────────────

  fastify.get('/partners/venues/events/:eventId/guest-ops', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const summary = await venueService.getGuestOps(ctx, request.params.eventId);
      return reply.header('Cache-Control', 'private, max-age=15').send(summary);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Partnerships ───────────────────────────────────────────────────────────

  fastify.get('/partners/venues/partnerships', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const [partners, legacyBody] = await Promise.all([
        venueService.getPartnerships(ctx),
        buildLegacyVenuePartnerships(ctx.partnerId),
      ]);
      const merged = mergeVenuePartnerships(asArray(legacyBody.partnerships), asArray(partners));
      return reply.header('Cache-Control', 'private, max-age=120').send({
        ...legacyBody,
        partnerships: merged,
        partners: merged,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/venues/partnerships/:partnershipId', {
    preHandler: [
      fastify.validate({ body: PartnershipUpdateSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      return reply.send(await updateVenuePartnership(ctx.partnerId, request.params.partnershipId, asRecord(request.body)));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  fastify.get('/partners/venues/settings', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'venue');
      const settings = await venueService.getSettings(ctx);
      return reply.header('Cache-Control', 'private, max-age=300').send(settings);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Public venue detail/list parity ───────────────────────────────────────

  fastify.get('/partners/venues/directory', async (request: any, reply: any) => {
    return reply.send(await listPublicVenues(asRecord(request.query)));
  });

  fastify.get('/partners/venues/directory/:id', async (request: any, reply: any) => {
    return reply.send(await getPublicVenueDetail(request.params.id));
  });

  // ── Upload parity ─────────────────────────────────────────────────────────

  fastify.post('/partners/venues/upload', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await requireVenueContext(request, reply);
    if (!ctx) return;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send(buildErrorResponse({
        code: 'BAD_REQUEST',
        message: 'No file uploaded',
        requestId: request.id,
      }));
    }

    return {
      success: true,
      url: `https://storage.googleapis.com/c1rcle-assets/venues/${ctx.partnerId}/${data.filename}`,
      filename: data.filename,
    };
  });

  // ── Native parity dispatch ────────────────────────────────────────────────

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/partners/venues/*',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      try {
        const ctx = await requireVenueContext(request, reply);
        if (!ctx) return;

        const rest = String(request.params?.['*'] || '').replace(/^\/+/, '');
        if (!rest) {
          return reply.status(404).send(buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner venue endpoint not found',
            requestId: request.id,
          }));
        }

        const query = asRecord(request.query);
        const body = asRecord(request.body);

        if (rest === 'profile' && request.method === 'GET') {
          const doc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Venue not found', requestId: request.id }));
          return reply.send({ venue: { id: doc.id, ...(doc.data() || {}) } });
        }

        if (rest === 'profile' && request.method === 'PATCH') {
          const allowedFields = ['name', 'description', 'bio', 'tagline', 'address', 'city', 'state', 'capacity', 'amenities', 'photos', 'coverImage', 'profileImage', 'contactEmail', 'contactPhone', 'socialLinks', 'operatingHours', 'dressCode', 'ageRestriction', 'instagramHandle', 'youtubeHandle', 'spotifyHandle'];
          const patch = asRecord(body.patch);
          const safe: PlainRecord = {};
          for (const key of allowedFields) if (patch[key] !== undefined) safe[key] = patch[key];
          safe.updatedAt = new Date().toISOString();
          await fastify.db.collection('venues').doc(ctx.partnerId).set(safe, { merge: true });
          await fastify.publicDiscoveryService.syncVenueReadModels(ctx.partnerId).catch(() => {});
          await fastify.invalidatePublicDiscovery('all').catch(() => {});
          const doc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          return reply.send({ venue: { id: doc.id, ...(doc.data() || {}) } });
        }

        if (rest === 'notifications' && request.method === 'GET') {
          const snap = await fastify.db.collection('notifications').where('recipientId', '==', ctx.partnerId).limit(100).get().catch(() => ({ docs: [] as any[] }));
          const notifications = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          notifications.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ notifications: notifications.slice(0, 50) });
        }

        if (rest === 'notifications/read' && request.method === 'PATCH') {
          const notificationId = String(body.notificationId || '');
          const markAllRead = body.markAllRead === true;
          if (markAllRead) {
            const snap = await fastify.db.collection('notifications').where('recipientId', '==', ctx.partnerId).where('read', '==', false).get();
            const batch = fastify.db.batch();
            snap.docs.forEach((doc: any) => batch.update(doc.ref, { read: true }));
            await batch.commit();
            return reply.send({ success: true, markedCount: snap.size });
          }
          if (!notificationId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'notificationId or markAllRead required', requestId: request.id }));
          await fastify.db.collection('notifications').doc(notificationId).update({ read: true });
          return reply.send({ success: true, markedCount: 1 });
        }

        if (rest === 'orders' && request.method === 'GET') {
          const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
          let q: any = fastify.db.collection('orders').where('venueId', '==', ctx.partnerId);
          if (query.status) q = q.where('status', '==', query.status);
          const snap = await q.limit(200).get().catch(() => ({ docs: [] as any[] }));
          const orders = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}), buyerEmail: undefined, buyerPhone: undefined }));
          orders.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ orders: orders.slice(0, pageSize), hasMore: orders.length > pageSize, nextCursor: orders.length > pageSize ? orders[pageSize - 1]?.id : null });
        }

        if (rest === 'analytics/time-series' && request.method === 'GET') {
          const range = String(query.range || '1w');
          const metric = String(query.metric || 'revenue');
          const now = new Date();
          const points = range === '1d' ? 24 : range === '1w' ? 7 : 30;
          const windowStart = new Date(now);
          if (range === '1d') windowStart.setHours(now.getHours() - 23, 0, 0, 0);
          else if (range === '1w') windowStart.setDate(now.getDate() - 6);
          else windowStart.setDate(now.getDate() - 29);
          windowStart.setHours(0, 0, 0, 0);
          const ordersSnap = await fastify.db.collection('orders')
            .where('venueId', '==', ctx.partnerId)
            .where('status', '==', 'paid')
            .where('createdAt', '>=', windowStart.toISOString())
            .get().catch(() => ({ docs: [] as any[] }));
          const buckets: Record<string, { revenue: number; ticketsSold: number }> = {};
          for (let i = 0; i < points; i++) {
            const d = new Date(now);
            if (range === '1d') d.setHours(now.getHours() - (points - 1 - i), 0, 0, 0);
            else d.setDate(now.getDate() - (points - 1 - i));
            const key = range === '1d' ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            buckets[key] = { revenue: 0, ticketsSold: 0 };
          }
          for (const doc of (ordersSnap as any).docs || []) {
            const d = doc.data() || {};
            const ts = new Date(d.createdAt || 0);
            const key = range === '1d' ? `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}-${ts.getHours()}` : `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;
            if (buckets[key]) {
              buckets[key].revenue += d.totalPaise || Math.round((d.amount || 0) * 100);
              buckets[key].ticketsSold += d.ticketCount || 0;
            }
          }
          const series = Object.entries(buckets).map(([, v], i) => {
            const d = new Date(now);
            if (range === '1d') d.setHours(now.getHours() - (points - 1 - i), 0, 0, 0);
            else d.setDate(now.getDate() - (points - 1 - i));
            return {
              date: d.toISOString(),
              label: range === '1d' ? `${d.getHours()}:00` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: metric === 'revenue' ? v.revenue : v.ticketsSold,
              revenue: v.revenue,
              ticketsSold: v.ticketsSold,
            };
          });
          return reply.send({ series, total: series.reduce((sum, point) => sum + (metric === 'revenue' ? point.revenue : point.ticketsSold), 0) });
        }

        if ((rest === 'overview' || rest === 'overview/summary') && request.method === 'GET') {
          return reply.send(await buildLegacyOverviewSummary(ctx.partnerId));
        }

        if (rest === 'overview/tonight' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          if (!eventId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'eventId required', requestId: request.id }));
          const eventDoc = await fastify.db.collection('events').doc(eventId).get();
          if (!eventDoc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));
          const [ordersSnap, checkinsSnap] = await Promise.all([
            fastify.db.collection('orders').where('eventId', '==', eventId).where('status', '==', 'paid').get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('check_ins').where('eventId', '==', eventId).get().catch(() => ({ docs: [] as any[] })),
          ]);
          const revenue = ((ordersSnap as any).docs || []).reduce((sum: number, doc: any) => sum + (doc.data().totalPaise || 0), 0);
          const ticketsSold = ((ordersSnap as any).docs || []).reduce((sum: number, doc: any) => sum + (doc.data().ticketCount || 0), 0);
          return reply.send({ id: eventId, revenue: revenue / 100, checkedIn: (checkinsSnap as any).size || 0, expected: ticketsSold, ticketsSold, entryVelocity: 0, entryRate: 0, entryHistory: [] });
        }

        if (rest === 'page' && request.method === 'GET') {
          const doc = await fastify.db.collection('venue_pages').doc(ctx.partnerId).get();
          if (!doc.exists) return reply.send({ venueId: ctx.partnerId, theme: { primary: '#FF5A5F', secondary: '#000000' }, sections: [], isActive: true });
          return reply.send({ id: doc.id, ...(doc.data() || {}) });
        }

        if (rest === 'page' && request.method === 'POST') {
          const now = new Date().toISOString();
          await fastify.db.collection('venue_pages').doc(ctx.partnerId).set({ ...body, venueId: ctx.partnerId, updatedAt: now }, { merge: true });
          return reply.send({ success: true });
        }

        if (rest === 'crm/online' && request.method === 'GET') {
          const snap = await fastify.db.collection('attendees').where('venueId', '==', ctx.partnerId).limit(1000).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({
            customers: ((snap as any).docs || []).map((doc: any) => {
              const attendee = doc.data() || {};
              return {
                id: doc.id,
                name: attendee.name || attendee.customerName || 'Anonymous',
                email: attendee.email || '',
                phone: attendee.phone || '',
                age: attendee.age || null,
                gender: attendee.gender || null,
                eventName: attendee.eventName || 'Event',
                entryTime: attendee.checkedInAt || attendee.createdAt || null,
                status: attendee.status || 'unknown',
              };
            }),
          });
        }

        if (rest === 'events' && request.method === 'PATCH') {
          const eventId = String(body.eventId || '');
          const action = String(body.action || '');
          const eventDoc = await fastify.db.collection('events').doc(eventId).get();
          if (!eventDoc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));
          const statusMap: Record<string, string> = { approve: 'scheduled', reject: 'denied', pause: 'paused', resume: 'scheduled' };
          const newStatus = statusMap[action];
          if (!newStatus) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'Invalid action', requestId: request.id }));
          const now = new Date().toISOString();
          await fastify.db.collection('events').doc(eventId).update({ lifecycle: newStatus, updatedAt: now, ...(action === 'approve' ? { approvedAt: now } : {}) });
          return reply.send({ success: true, status: newStatus });
        }

        if (rest === 'events/requests' && request.method === 'GET') {
          const snap = await fastify.db.collection('availability_slots').where('venueId', '==', ctx.partnerId).where('status', '==', 'pending').limit(100).get().catch(() => ({ docs: [] as any[] }));
          const requests = ((snap as any).docs || []).map((doc: any) => normalizeSlotRecord(doc)).filter((slot: any) => !isVenueBlock(slot));
          requests.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ slotRequests: requests, requests });
        }

        if (rest === 'orders/latest' && request.method === 'GET') {
          const snap = await fastify.db.collection('latest_orders_feed').where('venueId', '==', ctx.partnerId).limit(50).get().catch(() => ({ docs: [] as any[] }));
          const orders = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          orders.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ orders: orders.slice(0, 20) });
        }

        if (rest === 'staff' && request.method === 'GET') {
          let q: any = fastify.db.collection('venue_staff').where('venueId', '==', ctx.partnerId);
          if (query.isActive === 'true') q = q.where('isActive', '==', true);
          else if (query.isActive === 'false') q = q.where('isActive', '==', false);
          const snap = await q.get();
          return reply.send({ staff: snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        if (rest === 'staff' && request.method === 'POST') {
          const now = new Date().toISOString();
          const res = await fastify.db.collection('venue_staff').add({
            venueId: ctx.partnerId,
            email: String(body.email || '').toLowerCase().trim(),
            name: body.name || '',
            role: body.role,
            status: 'invited',
            verified: false,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          return reply.send({ success: true, id: res.id });
        }

        if (rest === 'staff' && request.method === 'PATCH') {
          const targetId = String(body.staffId || body.memberId || '');
          if (!targetId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'staffId required', requestId: request.id }));
          const ref = fastify.db.collection('venue_staff').doc(targetId);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Member not found', requestId: request.id }));
          const now = new Date().toISOString();
          const updates: any = { updatedAt: now };
          if (body.action === 'suspend') updates.status = 'suspended', updates.isActive = false;
          if (body.action === 'reactivate') updates.status = 'active', updates.isActive = true;
          if (body.action === 'verify') updates.verified = true;
          if (body.role !== undefined) updates.role = body.role;
          if (body.isActive !== undefined) updates.isActive = body.isActive;
          await ref.update(updates);
          return reply.send({ success: true });
        }

        if (rest === 'staff' && request.method === 'DELETE') {
          const targetId = String(query.staffId || query.memberId || '');
          if (!targetId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'staffId required', requestId: request.id }));
          const ref = fastify.db.collection('venue_staff').doc(targetId);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Member not found', requestId: request.id }));
          await ref.update({ isActive: false, status: 'removed', updatedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        const membershipStaffMatch = rest.match(/^staff\/([^/]+)$/);
        if (membershipStaffMatch && request.method === 'PATCH') {
          await fastify.db.collection('partner_memberships').doc(membershipStaffMatch[1]).update({ ...(body.role !== undefined ? { role: body.role } : {}), ...(body.isActive !== undefined ? { isActive: body.isActive } : {}), updatedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }
        if (membershipStaffMatch && request.method === 'DELETE') {
          await fastify.db.collection('partner_memberships').doc(membershipStaffMatch[1]).update({ isActive: false, removedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        if (rest === 'staff-profiles' && request.method === 'GET') {
          const snap = await fastify.db.collection('staff_profiles').where('venueId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ profiles: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }
        if (rest === 'staff-profiles/assignments' && request.method === 'GET') {
          const snap = await fastify.db.collection('staff_assignments').where('venueId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ assignments: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }
        if (rest === 'staff-profiles/assign' && request.method === 'POST') {
          await fastify.db.collection('staff_assignments').add({ venueId: ctx.partnerId, profileId: body.profileId, memberId: body.memberId, createdAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        const eventTicketsMatch = rest.match(/^events\/([^/]+)\/tickets$/);
        if (eventTicketsMatch && request.method === 'GET') {
          const eventDoc = await fastify.db.collection('events').doc(eventTicketsMatch[1]).get();
          if (!eventDoc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));
          const event = eventDoc.data() as PlainRecord;
          const tiers = asArray(event.ticketTiers || event.tiers || event.tickets).map((tier: PlainRecord, index: number) => ({ id: tier.id || tier.tierId || String(index), name: tier.name, price: tier.price, quantity: tier.quantity || tier.maxQuantity || 0, sold: tier.sold || 0, status: tier.status || 'active' }));
          return reply.send({ tiers, eventId: eventTicketsMatch[1] });
        }

        if (rest === 'slots' && request.method === 'GET') {
          const hostId = String(query.hostId || '');
          let q: any = fastify.db.collection('availability_slots').where('venueId', '==', ctx.partnerId);
          if (hostId) q = q.where('hostId', '==', hostId);
          if (query.status) q = q.where('status', '==', query.status);
          const snap = await q.limit(Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100)).get();
          const slotRequests = snap.docs.map((doc: any) => normalizeSlotRecord(doc)).sort((left: any, right: any) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
          return reply.send({ slotRequests, requests: slotRequests });
        }
        if (rest === 'slots' && request.method === 'POST') {
          const slot = await schedulingService.createSlot(ctx, ctx.partnerId, {
            date: String(body.date || ''),
            startTime: String(body.startTime || '00:00'),
            endTime: String(body.endTime || '23:59'),
            status: 'blocked',
            notes: body.note || body.notes || body.reason || null,
          });
          return reply.status(201).send({ success: true, slot });
        }

        const slotMatch = rest.match(/^slots\/([^/]+)$/);
        if (slotMatch && request.method === 'GET') {
          const doc = await fastify.db.collection('availability_slots').doc(slotMatch[1]).get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Slot request not found', requestId: request.id }));
          return reply.send({ slotRequest: normalizeSlotRecord(doc) });
        }
        if (slotMatch && request.method === 'PATCH') {
          const id = slotMatch[1];
          const action = String(body.action || '');
          const validActions = ['approve', 'reject', 'counter', 'suggest', 'suggest_changes'];
          if (!validActions.includes(action)) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: `action must be one of: ${validActions.join(', ')}`, requestId: request.id }));
          const ref = fastify.db.collection('availability_slots').doc(id);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Slot request not found', requestId: request.id }));
          const now = new Date().toISOString();
          const statusMap: Record<string, string> = { approve: 'approved', reject: 'rejected', counter: 'countered', suggest: 'changes_requested', suggest_changes: 'changes_requested' };
          const nextStatus = statusMap[action];
          const result = await fastify.db.runTransaction(async (transaction: any) => {
            const liveDoc = await transaction.get(ref);
            if (!liveDoc.exists) {
              const err: any = new Error('Slot request not found');
              err.statusCode = 404;
              throw err;
            }
            const liveSlot = normalizeSlotRecord(liveDoc);
            const currentStatus = String(liveSlot.status || '').toLowerCase();
            if (currentStatus === nextStatus) return { status: nextStatus, eventId: liveSlot.eventId, hostId: liveSlot.hostId, venueId: liveSlot.venueId, venueName: liveSlot.venueName, shouldNotify: false };
            const mutableStatuses = new Set(['pending', 'requested', 'countered', 'changes_requested']);
            if (!mutableStatuses.has(currentStatus)) {
              const err: any = new Error(`Slot request is already ${currentStatus}`);
              err.statusCode = 409;
              throw err;
            }
            if (action === 'approve') {
              const approvalDate = liveSlot.requestedDate || liveSlot.date || null;
              const approvalStart = liveSlot.requestedStartTime || liveSlot.startTime || null;
              const approvalEnd = liveSlot.requestedEndTime || liveSlot.endTime || null;
              const sameDaySnap = await transaction.get(fastify.db.collection('availability_slots').where('venueId', '==', liveSlot.venueId).where('date', '==', approvalDate).limit(100));
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
                const err: any = new Error('The selected venue time slot is unavailable');
                err.statusCode = 409;
                throw err;
              }
            }
            const updates: Record<string, any> = { status: nextStatus, updatedAt: now, respondedAt: now };
            if (action === 'counter') {
              updates.counterDate = body.counterDate;
              updates.counterStartTime = body.counterStartTime;
              updates.counterEndTime = body.counterEndTime;
            }
            if (action === 'approve') {
              updates.date = liveSlot.requestedDate || liveSlot.date || null;
              updates.startTime = liveSlot.requestedStartTime || liveSlot.startTime || null;
              updates.endTime = liveSlot.requestedEndTime || liveSlot.endTime || null;
            }
            if (body.message || body.notes) updates.responseMessage = body.message || body.notes;
            transaction.update(ref, updates);
            if (liveSlot.eventId) {
              const eventRef = fastify.db.collection('events').doc(liveSlot.eventId);
              const eventDoc = await transaction.get(eventRef);
              if (eventDoc.exists) {
                const eventUpdates: Record<string, any> = { slotStatus: nextStatus, slotRespondedAt: now, updatedAt: now };
                if (action === 'approve') eventUpdates.lifecycle = 'scheduled', eventUpdates.approvedAt = now;
                else if (action === 'reject') eventUpdates.lifecycle = 'denied';
                transaction.update(eventRef, eventUpdates);
              }
            }
            return { status: nextStatus, eventId: liveSlot.eventId, hostId: liveSlot.hostId, venueId: liveSlot.venueId, venueName: liveSlot.venueName, shouldNotify: action === 'approve' && !!liveSlot.eventId };
          });
          if (result.shouldNotify) {
            await fastify.db.collection('notifications').add({ recipientId: result.hostId, recipientType: 'host', type: 'slot_approved', slotRequestId: id, eventId: result.eventId, venueId: result.venueId, title: 'Slot Approved', message: `Your slot request for ${result.venueName || 'the venue'} has been approved.`, read: false, createdAt: now });
          }
          return reply.send({ success: true, status: result.status });
        }

        if (rest === 'calendar' && request.method === 'POST') {
          const normalizedAction = String(body.action || body.type || '').toLowerCase();
          if (normalizedAction === 'block') {
            const slot = await schedulingService.createSlot(ctx, ctx.partnerId, {
              date: String(body.date || ''),
              startTime: String(body.startTime || '00:00'),
              endTime: String(body.endTime || '23:59'),
              status: 'blocked',
              notes: body.note || body.notes || body.reason || null,
            });
            return reply.send({ success: true, slotId: slot.slotId, slot });
          }
          if (normalizedAction === 'unblock') {
            const batch = fastify.db.batch();
            let docs: any[] = [];
            if (body.slotId) {
              const blockDoc = await fastify.db.collection('availability_slots').doc(String(body.slotId)).get();
              if (blockDoc.exists) docs = [blockDoc];
            } else {
              const snapshot = await fastify.db.collection('availability_slots').where('venueId', '==', ctx.partnerId).where('date', '==', body.date).where('source', '==', 'venue_block').get();
              docs = snapshot.docs.filter((doc: any) => {
                const data = doc.data() as Record<string, any>;
                if (body.startTime && data.startTime && data.startTime !== body.startTime) return false;
                if (body.endTime && data.endTime && data.endTime !== body.endTime) return false;
                return true;
              });
            }
            docs.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
            return reply.send({ success: true, removedCount: docs.length });
          }
          return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'action must be block or unblock', requestId: request.id }));
        }

        if (rest === 'calendar' && request.method === 'DELETE') {
          const batch = fastify.db.batch();
          let docs: any[] = [];
          if (query.slotId) {
            const blockDoc = await fastify.db.collection('availability_slots').doc(String(query.slotId)).get();
            if (blockDoc.exists) docs = [blockDoc];
          } else {
            const snapshot = await fastify.db.collection('availability_slots').where('venueId', '==', ctx.partnerId).where('date', '==', query.date).where('source', '==', 'venue_block').get();
            docs = snapshot.docs.filter((doc: any) => {
              const data = doc.data() as Record<string, any>;
              if (query.startTime && data.startTime && data.startTime !== query.startTime) return false;
              if (query.endTime && data.endTime && data.endTime !== query.endTime) return false;
              return true;
            });
          }
          docs.forEach((doc: any) => batch.delete(doc.ref));
          await batch.commit();
          return reply.send({ success: true, removedCount: docs.length });
        }

        if (rest === 'staff/accept' && request.method === 'POST') {
          const invitationId = String(body.invitationId || '');
          if (!invitationId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'invitationId required', requestId: request.id }));
          const ref = fastify.db.collection('venue_staff').doc(invitationId);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Invitation not found', requestId: request.id }));
          await ref.update({ status: 'active', verified: true, isActive: true, updatedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        if (rest === 'presence' && request.method === 'GET') {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const [staffSnap, heartbeatsSnap] = await Promise.all([
            fastify.db.collection('venue_staff').where('venueId', '==', ctx.partnerId).where('isActive', '==', true).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('staff_heartbeats').where('venueId', '==', ctx.partnerId).where('lastSeenAt', '>=', fiveMinutesAgo).get().catch(() => ({ docs: [] as any[] })),
          ]);
          const onlineIds = new Set(((heartbeatsSnap as any).docs || []).map((d: any) => d.id));
          return reply.send({ presence: ((staffSnap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}), isOnline: onlineIds.has(doc.id) })) });
        }

        if (rest === 'finance/cover-recon' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          const eventsSnap = await fastify.db.collection('events').where('venueId', '==', ctx.partnerId).limit(100).get();
          const events = eventsSnap.docs.map((doc: any) => ({ id: doc.id, title: doc.data().title || doc.data().name || 'Untitled Event', startDate: doc.data().startDate })).sort((a: any, b: any) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
          if (!eventId) return reply.send({ events, reconciliation: null });
          const reconDoc = await fastify.db.collection('cover_wallet_reconciliations').doc(eventId).get();
          if (!reconDoc.exists) return reply.send({ events, reconciliation: null });
          const raw = reconDoc.data() as any;
          const summary = raw.summary ?? raw;
          const grossCollection = Number(summary.openingBalancePaise ?? 0);
          const totalRedeemed = Number(summary.consumedBalancePaise ?? summary.totalDebitedPaise ?? 0);
          const breakageRevenue = Number(summary.netVenueForfeitedValuePaise ?? summary.expiredBalancePaise ?? 0);
          const walletsIssued = Number(summary.walletsIssued ?? 0);
          const ordersSnap = await fastify.db.collection('orders').where('eventId', '==', eventId).where('status', '==', 'confirmed').get().catch(() => ({ docs: [] as any[] }));
          const ticketRevenuePaise = ((ordersSnap as any).docs || []).reduce((sum: number, doc: any) => sum + Math.round((Number(doc.data().amount) || 0) * 100), 0);
          const payoutTotal = Math.round(ticketRevenuePaise * 0.70) + breakageRevenue;
          const isLive = eventsSnap.docs.find((doc: any) => doc.id === eventId)?.data()?.status === 'live';
          return reply.send({
            events,
            reconciliation: {
              eventId,
              grossCollection,
              totalRedeemed,
              breakageRevenue,
              walletsIssued,
              ticketRevenuePaise,
              payoutTotal,
              venueTicketSplitPct: 70,
              isLive: Boolean(isLive),
              itemDistribution: Array.isArray(raw.itemDistribution) ? raw.itemDistribution : [],
              exceptionList: Array.isArray(summary.exceptionList) ? summary.exceptionList : [],
            },
          });
        }

        // guest-ops/:eventId/* — guest management for venue staff
        const guestOpsMatch = rest.match(/^guest-ops\/([^/]+)\/(.+)$/);
        if (guestOpsMatch) {
          const gopsEventId = guestOpsMatch[1];
          const gopsPath = guestOpsMatch[2];

          // Verify event belongs to venue
          const gopsEventDoc = await fastify.db.collection('events').doc(gopsEventId).get().catch(() => null);
          if (!gopsEventDoc || !gopsEventDoc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));
          const gopsEventData = gopsEventDoc.data() as any;
          if (gopsEventData.venueId !== ctx.partnerId) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Not your event', requestId: request.id }));

          if (gopsPath === 'summary' && request.method === 'GET') {
            const [ordersSnap, checkinsSnap] = await Promise.all([
              fastify.db.collection('orders').where('eventId', '==', gopsEventId).where('status', '==', 'paid').get().catch(() => ({ docs: [] as any[], size: 0 })),
              fastify.db.collection('check_ins').where('eventId', '==', gopsEventId).get().catch(() => ({ docs: [] as any[], size: 0 })),
            ]);
            const totalTickets = ((ordersSnap as any).docs || []).reduce((s: number, d: any) => s + (d.data().ticketCount || 0), 0);
            const checkedIn = (checkinsSnap as any).size || 0;
            return reply.send({ eventId: gopsEventId, totalTickets, checkedIn, pending: Math.max(0, totalTickets - checkedIn), entryRate: totalTickets ? Math.round((checkedIn / totalTickets) * 100) : 0 });
          }

          if (gopsPath === 'guests' && request.method === 'GET') {
            const pageSize = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 200);
            let q: any = fastify.db.collection('orders').where('eventId', '==', gopsEventId).where('status', '==', 'paid');
            const snap = await q.limit(pageSize + 1).get().catch(() => ({ docs: [] as any[] }));
            const docs = (snap as any).docs || [];
            const guests = docs.slice(0, pageSize).map((doc: any) => {
              const d = doc.data() || {};
              return { id: doc.id, name: d.buyerName || d.name || 'Guest', email: d.buyerEmail || d.email || '', phone: d.buyerPhone || d.phone || '', ticketCount: d.ticketCount || 1, orderId: doc.id, status: d.checkedInAt ? 'checked_in' : 'pending', checkedInAt: d.checkedInAt || null };
            });
            return reply.send({ guests, hasMore: docs.length > pageSize });
          }

          if (gopsPath === 'guests/search' && request.method === 'GET') {
            const searchTerm = String(query.q || '').toLowerCase().trim();
            if (!searchTerm) return reply.send({ guests: [] });
            const snap = await fastify.db.collection('orders').where('eventId', '==', gopsEventId).where('status', '==', 'paid').limit(500).get().catch(() => ({ docs: [] as any[] }));
            const guests = ((snap as any).docs || []).map((doc: any) => {
              const d = doc.data() || {};
              return { id: doc.id, name: d.buyerName || d.name || 'Guest', email: d.buyerEmail || d.email || '', phone: d.buyerPhone || d.phone || '', ticketCount: d.ticketCount || 1, orderId: doc.id, status: d.checkedInAt ? 'checked_in' : 'pending', checkedInAt: d.checkedInAt || null };
            }).filter((g: any) => g.name.toLowerCase().includes(searchTerm) || g.email.toLowerCase().includes(searchTerm) || g.phone.includes(searchTerm));
            return reply.send({ guests: guests.slice(0, 50) });
          }

          const guestActionMatch = gopsPath.match(/^guests\/([^/]+)\/(check-in|flag|deny|re-entry)$/);
          if (guestActionMatch && request.method === 'POST') {
            const guestOrderId = guestActionMatch[1];
            const guestAction = guestActionMatch[2];
            const now = new Date().toISOString();
            const orderRef = fastify.db.collection('orders').doc(guestOrderId);
            
            try {
              await fastify.db.runTransaction(async (tx: any) => {
                const orderDoc = await tx.get(orderRef);
                if (!orderDoc.exists) {
                  const err: any = new Error('Order not found');
                  err.statusCode = 404;
                  throw err;
                }
                const order = orderDoc.data();

                if (guestAction === 'check-in') {
                  if (order.checkedInAt) {
                    const err: any = new Error('Already checked in');
                    err.statusCode = 409;
                    throw err;
                  }
                  tx.update(orderRef, { checkedInAt: now, checkedInBy: ctx.uid });
                  const checkInRef = fastify.db.collection('check_ins').doc(`${gopsEventId}_${guestOrderId}`);
                  tx.set(checkInRef, { eventId: gopsEventId, orderId: guestOrderId, checkedInAt: now, checkedInBy: ctx.uid });
                } else if (guestAction === 'flag') {
                  tx.update(orderRef, { flaggedAt: now, flagReason: String(body.reason || 'Flagged by venue staff'), flaggedBy: ctx.uid });
                } else if (guestAction === 'deny') {
                  tx.update(orderRef, { deniedAt: now, denyReason: String(body.reason || 'Denied by venue staff'), deniedBy: ctx.uid });
                } else if (guestAction === 're-entry') {
                  tx.update(orderRef, { reEntryAt: now, reEntryBy: ctx.uid, checkedInAt: null });
                  const checkInRef = fastify.db.collection('check_ins').doc(`${gopsEventId}_${guestOrderId}`);
                  tx.delete(checkInRef);
                }
              });
              return reply.send({ success: true });
            } catch (err: any) {
              if (err.statusCode) {
                return reply.status(err.statusCode).send(buildErrorResponse({ code: err.statusCode === 409 ? 'CONFLICT' : 'NOT_FOUND', message: err.message, requestId: request.id }));
              }
              throw err;
            }
          }

          if (gopsPath === 'exceptions' && request.method === 'GET') {
            const snap = await fastify.db.collection('orders').where('eventId', '==', gopsEventId).where('status', '==', 'paid').limit(200).get().catch(() => ({ docs: [] as any[] }));
            const exceptions = ((snap as any).docs || []).filter((doc: any) => {
              const d = doc.data() || {};
              return d.flaggedAt || d.deniedAt;
            }).map((doc: any) => {
              const d = doc.data() || {};
              return { id: doc.id, name: d.buyerName || 'Guest', type: d.flaggedAt ? 'flagged' : 'denied', reason: d.flagReason || d.denyReason || '', at: d.flaggedAt || d.deniedAt || null };
            });
            return reply.send({ exceptions });
          }

          if (gopsPath === 'scanner/devices' && request.method === 'GET') {
            const snap = await fastify.db.collection('scanner_devices').where('venueId', '==', ctx.partnerId).where('eventId', '==', gopsEventId).get().catch(() => ({ docs: [] as any[] }));
            return reply.send({ devices: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
          }

          if (gopsPath === 'scanner/stream' && request.method === 'GET') {
            const snap = await fastify.db.collection('check_ins').where('eventId', '==', gopsEventId).orderBy('checkedInAt', 'desc').limit(20).get().catch(() => ({ docs: [] as any[] }));
            return reply.send({ entries: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
          }

          if (gopsPath === 'guest-rules' && request.method === 'GET') {
            const doc = await fastify.db.collection('event_guest_rules').doc(gopsEventId).get().catch(() => null);
            return reply.send({ rules: doc && doc.exists ? doc.data() || {} : { allowedGenderRatio: null, minAge: null, dressCode: null, notes: '' } });
          }

          if (gopsPath === 'guest-rules' && request.method === 'POST') {
            await fastify.db.collection('event_guest_rules').doc(gopsEventId).set({ ...body, eventId: gopsEventId, venueId: ctx.partnerId, updatedAt: new Date().toISOString() }, { merge: true });
            return reply.send({ success: true });
          }

          if (gopsPath === 'host-allocations/all' && request.method === 'GET') {
            const snap = await fastify.db.collection('host_allocations').where('eventId', '==', gopsEventId).get().catch(() => ({ docs: [] as any[] }));
            return reply.send({ allocations: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
          }

          return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Guest ops endpoint not found', requestId: request.id }));
        }

        // walk-ins
        if (rest === 'walk-ins' && request.method === 'GET') {
          const snap = await fastify.db.collection('walk_in_entries').where('venueId', '==', ctx.partnerId).limit(200).get().catch(() => ({ docs: [] as any[] }));
          const entries = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          entries.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ entries: entries.slice(0, 100) });
        }

        const walkInEventMatch = rest.match(/^walk-ins\/([^/]+)$/);
        if (walkInEventMatch && request.method === 'GET') {
          const evtId = walkInEventMatch[1];
          const snap = await fastify.db.collection('walk_in_entries').doc(evtId).collection('logs').limit(200).get().catch(() => ({ docs: [] as any[] }));
          const logs = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          logs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ logs: logs.slice(0, 100) });
        }
        if (walkInEventMatch && request.method === 'POST') {
          const evtId = walkInEventMatch[1];
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('walk_in_entries').doc(evtId).collection('logs').add({ ...body, eventId: evtId, venueId: ctx.partnerId, recordedBy: ctx.uid, createdAt: now });
          return reply.send({ success: true, id: ref.id });
        }

        // door operations
        if (rest === 'door/capacity' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          if (!eventId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'eventId required', requestId: request.id }));
          const [eventDoc, checkinsSnap, ordersSnap] = await Promise.all([
            fastify.db.collection('events').doc(eventId).get(),
            fastify.db.collection('check_ins').where('eventId', '==', eventId).get().catch(() => ({ size: 0 })),
            fastify.db.collection('orders').where('eventId', '==', eventId).where('status', '==', 'paid').get().catch(() => ({ docs: [] as any[] })),
          ]);
          const capacity = eventDoc.exists ? (eventDoc.data() as any).capacity || 0 : 0;
          const totalTickets = ((ordersSnap as any).docs || []).reduce((s: number, d: any) => s + (d.data().ticketCount || 0), 0);
          return reply.send({ capacity, checkedIn: (checkinsSnap as any).size || 0, totalTickets, available: Math.max(0, capacity - ((checkinsSnap as any).size || 0)) });
        }

        if (rest === 'door/dinein' && request.method === 'GET') {
          const snap = await fastify.db.collection('dinein_sessions').where('venueId', '==', ctx.partnerId).where('status', '==', 'active').limit(100).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ sessions: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }
        if (rest === 'door/dinein' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('dinein_sessions').add({ ...body, venueId: ctx.partnerId, status: 'active', createdAt: now, createdBy: ctx.uid });
          return reply.send({ success: true, id: ref.id });
        }

        if (rest === 'door/sell' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('door_sales').add({ ...body, venueId: ctx.partnerId, soldAt: now, soldBy: ctx.uid });
          return reply.send({ success: true, id: ref.id });
        }

        // registers
        if (rest === 'registers' && request.method === 'GET') {
          const snap = await fastify.db.collection('pos_registers').where('venueId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ registers: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        // tables
        if (rest === 'tables' && request.method === 'GET') {
          const snap = await fastify.db.collection('venue_tables').where('venueId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ tables: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        // reservations
        if (rest === 'reservations' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          let q: any = fastify.db.collection('reservations').where('venueId', '==', ctx.partnerId);
          if (eventId) q = q.where('eventId', '==', eventId);
          const snap = await q.limit(100).get().catch(() => ({ docs: [] as any[] }));
          const reservations = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          reservations.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ reservations });
        }

        const reservationMatch = rest.match(/^reservations\/([^/]+)$/);
        if (reservationMatch && request.method === 'GET') {
          const doc = await fastify.db.collection('reservations').doc(reservationMatch[1]).get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Reservation not found', requestId: request.id }));
          return reply.send({ reservation: { id: doc.id, ...(doc.data() || {}) } });
        }
        if (reservationMatch && request.method === 'PATCH') {
          await fastify.db.collection('reservations').doc(reservationMatch[1]).update({ ...body, updatedAt: new Date().toISOString(), updatedBy: ctx.uid });
          return reply.send({ success: true });
        }

        // security/sync
        if (rest === 'security/sync' && request.method === 'POST') {
          const eventId = String(body.eventId || query.eventId || '');
          if (!eventId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'eventId required', requestId: request.id }));
          const snap = await fastify.db.collection('check_ins').where('eventId', '==', eventId).orderBy('checkedInAt', 'desc').limit(500).get().catch(() => ({ docs: [] as any[] }));
          const entries = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          return reply.send({ synced: entries.length, entries });
        }

        // marketing/campaigns
        if (rest === 'marketing/campaigns' && request.method === 'GET') {
          const snap = await fastify.db.collection('marketing_campaigns').where('venueId', '==', ctx.partnerId).limit(50).get().catch(() => ({ docs: [] as any[] }));
          const campaigns = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          campaigns.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ campaigns });
        }
        if (rest === 'marketing/campaigns' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('marketing_campaigns').add({ ...body, venueId: ctx.partnerId, status: 'draft', createdAt: now, createdBy: ctx.uid });
          return reply.send({ success: true, id: ref.id });
        }

        // analytics/overview — real aggregation
        if (rest === 'analytics/overview' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [eventsSnap, ordersSnap, checkinsSnap] = await Promise.all([
            fastify.db.collection('events').where('venueId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db.collection('orders').where('venueId', '==', ctx.partnerId).where('status', '==', 'paid').where('createdAt', '>=', thirtyDaysAgo).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('check_ins').where('venueId', '==', ctx.partnerId).where('checkedInAt', '>=', thirtyDaysAgo).get().catch(() => ({ size: 0 })),
          ]);
          const totalRevenuePaise = ((ordersSnap as any).docs || []).reduce((sum: number, doc: any) => sum + (doc.data().totalPaise || Math.round((doc.data().amount || 0) * 100)), 0);
          const totalTickets = ((ordersSnap as any).docs || []).reduce((sum: number, doc: any) => sum + (doc.data().ticketCount || 0), 0);
          const eventCount = (eventsSnap as any).size || 0;
          return reply.send({
            period: '30d',
            events: { total: eventCount },
            revenue: { totalPaise: totalRevenuePaise, total: totalRevenuePaise / 100 },
            tickets: { sold: totalTickets },
            attendance: { checkedIn: (checkinsSnap as any).size || 0 },
          });
        }

        // finance/* handlers
        const financeOverviewMatch = rest === 'finance/overview';
        const financeLedgerMatch = rest === 'finance/ledger';
        const financePaymentsMatch = rest === 'finance/payments';
        const financePayoutsMatch = rest === 'finance/payouts';
        const financeBankMatch = rest === 'finance/bank-accounts';
        const financeDisputesMatch = rest === 'finance/disputes';

        if (financeOverviewMatch && request.method === 'GET') {
          const [overview, balances, payoutsSnap, accountsSnap] = await Promise.all([
            financeService.getOverview(ctx),
            financeService.getBalances(ctx),
            fastify.db.collection('payouts').where('recipientId', '==', ctx.partnerId).where('recipientType', '==', 'venue').limit(10).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('bank_accounts').where('ownerId', '==', ctx.partnerId).where('ownerType', '==', 'venue').limit(1).get().catch(() => ({ empty: true, docs: [] as any[] })),
          ]);
          const recentPayouts = ((payoutsSnap as any).docs || []).slice(0, 5).map((d: any) => ({ id: d.id, ...d.data() }));
          const settledPayouts = recentPayouts
            .filter((row: any) => ['completed', 'paid', 'cleared', 'settled'].includes(String(row.status || '').toLowerCase()))
            .reduce((sum: number, row: any) => sum + toNumber(row.amount || row.amountPaise || 0), 0);
          const payoutState = (accountsSnap as any).empty ? 'unconnected' : 'active';
          return reply.send({
            period: String(query.period || '30d'),
            metrics: {
              availableBalance: toNumber(balances.available),
              pendingPayouts: toNumber(balances.pending),
              settledPayouts,
              totalRevenue: toNumber(overview.totalRevenue),
              currency: overview.currency || 'INR',
              payoutState,
            },
            grossRevenue: toNumber(overview.totalRevenue),
            pendingPayout: toNumber(balances.pending),
            recentPayouts,
            revenueByPeriod: overview.revenueByPeriod || [],
          });
        }

        if (rest === 'finance/venue-payouts' && request.method === 'GET') {
          const [balances, payoutsSnap] = await Promise.all([
            financeService.getBalances(ctx),
            fastify.db.collection('payouts').where('recipientId', '==', ctx.partnerId).where('recipientType', '==', 'venue').limit(50).get().catch(() => ({ docs: [] as any[] })),
          ]);
          const history = ((payoutsSnap as any).docs || []).map((doc: any) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              amountPaise: data.amountPaise || Math.round((toNumber(data.amount) || 0) * 100),
              status: String(data.status || 'pending').toLowerCase(),
              requestedAt: data.requestedAt || data.createdAt || null,
              method: data.paymentMethod || null,
              methodDetail: data.bankName || null,
              eventName: data.eventName || null,
              eventDate: data.eventDate || null,
            };
          });
          history.sort((left: any, right: any) => new Date(right.requestedAt || 0).getTime() - new Date(left.requestedAt || 0).getTime());
          return reply.send({
            balance: {
              withdrawablePaise: Math.round(toNumber(balances.available) * 100),
              pendingSettlementPaise: Math.round(toNumber(balances.pending) * 100),
            },
            history,
          });
        }

        if (financeLedgerMatch && request.method === 'GET') {
          const snap = await fastify.db.collection('finance_ledger').where('entityId', '==', ctx.partnerId).limit(100).get().catch(() => ({ docs: [] as any[] }));
          const entries = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          entries.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ entries: entries.slice(0, 50) });
        }

        if (financePaymentsMatch && request.method === 'GET') {
          const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
          const snap = await fastify.db.collection('orders').where('venueId', '==', ctx.partnerId).where('status', '==', 'paid').limit(pageSize + 1).get().catch(() => ({ docs: [] as any[] }));
          const docs = (snap as any).docs || [];
          const payments = docs.slice(0, pageSize).map((doc: any) => {
            const d = doc.data() || {};
            return { id: doc.id, orderId: doc.id, amountPaise: d.totalPaise || Math.round((d.amount || 0) * 100), amount: d.amount || (d.totalPaise || 0) / 100, status: d.status, createdAt: d.createdAt, eventId: d.eventId, ticketCount: d.ticketCount || 0 };
          });
          return reply.send({ payments, hasMore: docs.length > pageSize });
        }

        if (financePayoutsMatch && request.method === 'GET') {
          const snap = await fastify.db.collection('payouts').where('recipientId', '==', ctx.partnerId).where('recipientType', '==', 'venue').limit(50).get().catch(() => ({ docs: [] as any[] }));
          const payouts = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          payouts.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ payouts });
        }

        if (financeBankMatch && request.method === 'GET') {
          const snap = await fastify.db.collection('bank_accounts').where('ownerId', '==', ctx.partnerId).where('ownerType', '==', 'venue').get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ accounts: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}), accountNumber: undefined })) });
        }
        if (financeBankMatch && request.method === 'POST') {
          const account = buildPayoutAccountRecord(body, { partnerId: ctx.partnerId, ownerType: 'venue' });
          const ref = await fastify.db.collection('bank_accounts').add(account.record);
          return reply.send({ success: true, id: ref.id, account: account.response(ref.id).account });
        }
        if (financeBankMatch && request.method === 'DELETE') {
          const accountId = String(query.accountId || '');
          if (!accountId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'accountId required', requestId: request.id }));
          await fastify.db.collection('bank_accounts').doc(accountId).update({ isActive: false, removedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        if (financeDisputesMatch && request.method === 'GET') {
          const snap = await fastify.db.collection('payment_disputes').where('venueId', '==', ctx.partnerId).limit(50).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ disputes: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        if (rest === 'finance/host-payouts' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          let q: any = fastify.db.collection('payouts').where('venueId', '==', ctx.partnerId).where('recipientType', '==', 'host');
          if (eventId) q = q.where('eventId', '==', eventId);
          const snap = await q.limit(50).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ payouts: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        if (rest === 'finance/promoter-payouts' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          let q: any = fastify.db.collection('payouts').where('venueId', '==', ctx.partnerId).where('recipientType', '==', 'promoter');
          if (eventId) q = q.where('eventId', '==', eventId);
          const snap = await q.limit(50).get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ payouts: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) });
        }

        return reply.status(404).send(buildErrorResponse({
          code: 'NOT_FOUND',
          message: 'Partner venue endpoint not found',
          requestId: request.id,
        }));
      } catch (err: any) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send(buildErrorResponse({
            code: err.code || 'FORBIDDEN',
            message: err.message,
            requestId: request.id,
          }));
        }
        return reply.status(500).send(buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }));
      }
    },
  });
}

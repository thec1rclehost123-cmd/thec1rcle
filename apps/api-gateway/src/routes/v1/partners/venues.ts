import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { resolvePartnerContext, requireType } from '../../../lib/partner-context.js';
import { generateTemporaryPassword, sendInvitationEmail } from '../../../lib/email.js';
import {
  getPartnerProfileSummary,
  getConnectionForViewer,
} from '../../../utils/partner-profiles.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { VenueService } from '../../../services/unified/venue-service.js';
import { SchedulingService } from '../../../services/unified/scheduling-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';
import { buildPayoutAccountRecord } from '../../../lib/partner-hardening.js';
import { generateFinanceReportPDF } from '@c1rcle/core/ticket-pdf-engine';

const EventFiltersSchema = z
  .object({
    status: z
      .enum([
        'draft',
        'pending_approval',
        'approved',
        'published',
        'live',
        'completed',
        'cancelled',
      ])
      .optional(),
    cursor: z.string().optional(),
    lastId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .passthrough();

const CalendarQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .passthrough();

const CreateSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['open', 'blocked']).optional(),
  notes: z.string().max(500).optional(),
});

const UpdateSlotSchema = z
  .object({
    status: z.enum(['open', 'blocked']).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

const SlotActionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    notes: z.string().max(500).optional(),
  })
  .strict();

const PartnershipUpdateSchema = z
  .object({
    status: z.string().optional(),
    action: z.string().optional(),
  })
  .passthrough();

type PlainRecord = Record<string, any>;

function asRecord(value: unknown): PlainRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as PlainRecord) : {};
}

function asArray<T = PlainRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

import { encrypt, decrypt } from '../../../lib/encryption.js';

function toNumber(value: any): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

async function sendPushToUsers(
  db: any,
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!userIds.length) return;
  const tokens: string[] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where('__name__', 'in', batch)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    (snap as any).docs.forEach((d: any) => {
      const ud = (d.data() as Record<string, any>) || {};
      if (Array.isArray(ud.pushTokens)) tokens.push(...ud.pushTokens);
    });
  }
  if (!tokens.length) return;
  const messages = tokens.map((token) => ({ to: token, sound: 'default', title, body, data }));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => {
      /* fire-and-forget — never fail the request */
    });
  }
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
      submissionStatus:
        unifiedItem.submissionStatus ?? legacyItem.submissionStatus ?? 'not_submitted',
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
    const isActive = legacyItem.isActive ?? unifiedItem.status === 'active';
    seen.add(id);
    merged.push({
      ...legacyItem,
      ...unifiedItem,
      id,
      partnershipId: id,
      partnerId: unifiedItem.partnerId ?? legacyItem.partnerId ?? legacyItem.uid ?? '',
      uid: legacyItem.uid ?? unifiedItem.partnerId ?? null,
      displayName:
        unifiedItem.displayName ??
        legacyItem.displayName ??
        legacyItem.name ??
        legacyItem.email ??
        '',
      name: legacyItem.name ?? unifiedItem.displayName ?? legacyItem.displayName ?? '',
      email: legacyItem.email ?? null,
      role: legacyItem.role ?? 'partner',
      type: unifiedItem.type ?? legacyItem.partnerType ?? 'host',
      status: legacyItem.status ?? unifiedItem.status ?? (isActive ? 'active' : 'inactive'),
      connectedAt: unifiedItem.connectedAt ?? legacyItem.createdAt ?? null,
      createdAt: legacyItem.createdAt ?? unifiedItem.connectedAt ?? null,
      isActive: legacyItem.isActive ?? unifiedItem.status === 'active',
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
  return (
    String(slot.source || '').toLowerCase() === 'venue_block' ||
    String(slot.status || '').toLowerCase() === 'blocked'
  );
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
      reply.status(403).send(
        buildErrorResponse({
          code: 'FORBIDDEN',
          message: 'No partner identity found',
          requestId: request.id,
        }),
      );
      return null;
    }

    requireType(ctx, 'venue');
    return ctx;
  };

  const buildLegacyOverviewSummary = async (venueId: string) => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const prevWeekAgo = new Date(now);
    prevWeekAgo.setDate(now.getDate() - 14);
    const [eventsSnap, ordersThisWeek, ordersPrevWeek, profilesSnap] = await Promise.all([
      fastify.db
        .collection('events')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('orders')
        .where('venueId', '==', venueId)
        .where('status', 'in', ['confirmed', 'paid'])
        .where('createdAt', '>=', weekAgo.toISOString())
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('orders')
        .where('venueId', '==', venueId)
        .where('status', 'in', ['confirmed', 'paid'])
        .where('createdAt', '>=', prevWeekAgo.toISOString())
        .where('createdAt', '<', weekAgo.toISOString())
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('orders')
        .where('venueId', '==', venueId)
        .where('status', 'in', ['confirmed', 'paid'])
        .count()
        .get()
        .catch(() => null),
    ]);
    const recentEvents = ((eventsSnap as any).docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((event: any) => event.startDate && event.startDate >= weekAgo.toISOString());
    const thisWeekRevenue = ((ordersThisWeek as any).docs || []).reduce(
      (s: number, d: any) => s + toNumber(d.data().amount || (d.data().totalPaise || 0) / 100),
      0,
    );
    const prevWeekRevenue = ((ordersPrevWeek as any).docs || []).reduce(
      (s: number, d: any) => s + toNumber(d.data().amount || (d.data().totalPaise || 0) / 100),
      0,
    );
    const trendPct =
      prevWeekRevenue > 0
        ? Math.round(((thisWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100)
        : 0;
    const totalGuests = profilesSnap ? (profilesSnap as any).data().count || 0 : 0;
    const newGuestsThisWeek = (ordersThisWeek as any).docs?.length || 0;
    return {
      weekendRevenue: thisWeekRevenue,
      revenueTrend: `${Math.abs(trendPct)}%`,
      revenueTrendDirection: trendPct >= 0 ? 'up' : 'down',
      activeEventsCount: recentEvents.length,
      avgEntryVelocity: 0,
      totalGuestProfiles: totalGuests,
      newGuestsThisWeek,
    };
  };

  const buildLegacyCalendar = async (venueId: string, startDate: string, endDate: string) => {
    const [eventsSnap, slotsSnap] = await Promise.all([
      fastify.db
        .collection('events')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('availability_slots')
        .where('venueId', '==', venueId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ]);
    const allEvents = ((eventsSnap as any).docs || []).map((doc: any) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));
    const allSlots = ((slotsSnap as any).docs || []).map((doc: any) => normalizeSlotRecord(doc));
    const dates: any[] = [];
    const cur = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    while (cur <= end) {
      const dateKey = cur.toISOString().slice(0, 10);
      const dayEvents = allEvents.filter(
        (event: any) => String(event.startDate || '').slice(0, 10) === dateKey,
      );
      const daySlots = allSlots.filter((slot: any) => String(slot.date || '') === dateKey);
      const block = daySlots.find((slot: any) => isVenueBlock(slot)) || null;
      dates.push({
        date: dateKey,
        state: block
          ? 'blocked'
          : dayEvents.length > 0
            ? 'booked'
            : daySlots.length > 0
              ? 'available'
              : 'empty',
        events: dayEvents,
        slots: daySlots,
        block,
        stats: {
          eventCount: dayEvents.length,
          pendingSlots: daySlots.filter(
            (slot: any) => String(slot.status || '').toLowerCase() === 'pending',
          ).length,
        },
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  };

  const buildLegacyVenueEvents = async (
    venueId: string,
    query: Record<string, any>,
    ownerUid?: string,
  ) => {
    const limit = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
    // Query 1: by venueId. Query 2: creatorId == venueDocId. Query 3 (when uid != docId): creatorId == uid
    const queries = [
      fastify.db
        .collection('events')
        .where('venueId', '==', venueId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('events')
        .where('creatorId', '==', venueId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ];
    if (ownerUid && ownerUid !== venueId) {
      queries.push(
        fastify.db
          .collection('events')
          .where('creatorId', '==', ownerUid)
          .limit(100)
          .get()
          .catch(() => ({ docs: [] as any[] })),
      );
    }
    const snaps = await Promise.all(queries);
    const seen = new Set<string>();
    let events: any[] = [];
    for (const snap of snaps as any[]) {
      for (const doc of snap.docs || []) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          events.push({ id: doc.id, ...(doc.data() || {}) });
        }
      }
    }
    if (query.status && query.status !== 'all') {
      events = events.filter(
        (event: any) =>
          String(event.lifecycle || event.status || '').toLowerCase() ===
          String(query.status).toLowerCase(),
      );
    }
    events.sort(
      (a: any, b: any) =>
        new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime(),
    );
    return { events: events.slice(0, limit) };
  };

  const buildLegacyVenuePartnerships = async (venueId: string) => {
    const snap = await fastify.db
      .collection('partnerships')
      .where('venueId', '==', venueId)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    const partnerships = ((snap as any).docs || []).map((doc: any) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));
    partnerships.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    return { partnerships };
  };

  const updateVenuePartnership = async (
    venueId: string,
    partnershipId: string,
    body: Record<string, any>,
  ) => {
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
      const slugSnap = await fastify.db
        .collection('venues')
        .where('slug', '==', idOrSlug)
        .limit(1)
        .get();
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
      fastify.db
        .collection('venue_highlights')
        .where('venueId', '==', venueId)
        .where('isActive', '==', true)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('venue_gallery')
        .where('venueId', '==', venueId)
        .limit(50)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('venue_menu')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('venue_facilities')
        .where('venueId', '==', venueId)
        .where('isEnabled', '==', true)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('events')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ]);
    const highlights = ((highlightsSnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const gallery = ((gallerySnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const menu = ((menuSnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const facilities = ((facilitiesSnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));
    const upcomingEvents = ((eventsSnap as any).docs || [])
      .map((item: any) => ({ id: item.id, ...(item.data() || {}) }))
      .filter((event: any) => event.startDate >= now)
      .sort((a: any, b: any) => String(a.startDate || '').localeCompare(String(b.startDate || '')))
      .slice(0, 10);
    return { venue, highlights, gallery: gallery.slice(0, 9), menu, facilities, upcomingEvents };
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/overview',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const cacheKey = `partners:venue:overview:${ctx.partnerId}:contract-v1`;
        const cached = await fastify.cache.get('partners', cacheKey);
        if (cached)
          return reply
            .header('Cache-Control', 'private, max-age=120')
            .send({ ...cached, fromCache: true });

        const [result, legacyBody] = await Promise.all([
          venueService.getOverview(ctx),
          buildLegacyOverviewSummary(ctx.partnerId),
        ]);
        const normalized = {
          ...legacyBody,
          weekendRevenue: toNumber(legacyBody.weekendRevenue ?? result.stats.totalRevenue),
          revenueTrend: legacyBody.revenueTrend ?? '0%',
          revenueTrendDirection: legacyBody.revenueTrendDirection ?? 'up',
          activeEventsCount: toNumber(
            legacyBody.activeEventsCount ?? result.stats.upcomingEventsCount,
          ),
          avgEntryVelocity: toNumber(legacyBody.avgEntryVelocity),
          totalGuestProfiles: toNumber(
            legacyBody.totalGuestProfiles ?? result.stats.totalGuestsCheckedIn,
          ),
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
        fastify.log.error(
          { err: err.message, partnerId: ctx.partnerId },
          'partners/venues/overview error',
        );
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Calendar ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/calendar',
    {
      preHandler: [fastify.validate({ querystring: CalendarQuerySchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        return reply.send(
          await buildLegacyCalendar(ctx.partnerId, request.query.startDate, request.query.endDate),
        );
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  fastify.post(
    '/partners/venues/calendar/slots',
    {
      preHandler: [fastify.validate({ body: CreateSlotSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const slot = await schedulingService.createSlot(ctx, ctx.partnerId, request.body);
        return reply.status(201).send({ slot });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  fastify.patch(
    '/partners/venues/calendar/slots/:slotId',
    {
      preHandler: [fastify.validate({ body: UpdateSlotSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const { status, notes } = request.body;
        const slot = await schedulingService.updateSlotStatus(
          ctx,
          ctx.partnerId,
          request.params.slotId,
          status,
          notes,
        );
        if (!slot)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Slot not found',
              requestId: request.id,
            }),
          );
        return reply.send({ slot });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Slot requests (incoming from hosts) ───────────────────────────────────

  fastify.get(
    '/partners/venues/slot-requests',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const requests = await schedulingService.getPendingRequests(ctx.partnerId);
        return reply.header('Cache-Control', 'private, max-age=30').send({ requests });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  fastify.patch(
    '/partners/venues/slot-requests/:slotId',
    {
      preHandler: [fastify.validate({ body: SlotActionSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const { action, notes } = request.body;
        const slot =
          action === 'approve'
            ? await schedulingService.approveRequest(
                ctx,
                ctx.partnerId,
                request.params.slotId,
                notes,
              )
            : await schedulingService.rejectRequest(
                ctx,
                ctx.partnerId,
                request.params.slotId,
                notes,
              );

        if (!slot)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Slot request not found',
              requestId: request.id,
            }),
          );
        return reply.send({ slot });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Events ─────────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/events',
    {
      preHandler: [fastify.validate({ querystring: EventFiltersSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const filters = {
          status: request.query.status,
          cursor: request.query.cursor ?? request.query.lastId,
          limit: request.query.limit,
        };
        const [result, legacyBody] = await Promise.all([
          venueService.getEvents(ctx, filters),
          buildLegacyVenueEvents(ctx.partnerId, request.query, ctx.uid),
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
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Guest ops ──────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/events/:eventId/guest-ops',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const summary = await venueService.getGuestOps(ctx, request.params.eventId);
        return reply.header('Cache-Control', 'private, max-age=15').send(summary);
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Partnerships ───────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/partnerships',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

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
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  fastify.patch(
    '/partners/venues/partnerships/:partnershipId',
    {
      preHandler: [fastify.validate({ body: PartnershipUpdateSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        return reply.send(
          await updateVenuePartnership(
            ctx.partnerId,
            request.params.partnershipId,
            asRecord(request.body),
          ),
        );
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Settings ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/venues/settings',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        requireType(ctx, 'venue');
        const settings = await venueService.getSettings(ctx);
        return reply.header('Cache-Control', 'private, max-age=300').send(settings);
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
            );
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

  // ── Public venue detail/list parity ───────────────────────────────────────

  fastify.get('/partners/venues/directory', async (request: any, reply: any) => {
    return reply.send(await listPublicVenues(asRecord(request.query)));
  });

  fastify.get('/partners/venues/directory/:id', async (request: any, reply: any) => {
    return reply.send(await getPublicVenueDetail(request.params.id));
  });

  // ── Upload parity ─────────────────────────────────────────────────────────

  fastify.post(
    '/partners/venues/upload',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await requireVenueContext(request, reply);
      if (!ctx) return;

      const data = await request.file();
      if (!data) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'No file uploaded',
            requestId: request.id,
          }),
        );
      }

      return {
        success: true,
        url: `https://storage.googleapis.com/c1rcle-assets/venues/${ctx.partnerId}/${data.filename}`,
        filename: data.filename,
      };
    },
  );

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
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Partner venue endpoint not found',
              requestId: request.id,
            }),
          );
        }

        const query = asRecord(request.query);
        const body = asRecord(request.body);

        if (rest === 'profile' && request.method === 'GET') {
          const doc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Venue not found',
                requestId: request.id,
              }),
            );
          return reply.send({ venue: { id: doc.id, ...(doc.data() || {}) } });
        }

        if (rest === 'finance/reports/pdf' && request.method === 'GET') {
          const from = (query.from as string) || 'All Time';
          const to = (query.to as string) || 'All Time';
          const type = (query.type as string) || 'monthly_statement';

          const venueDoc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          const venueName = venueDoc.exists ? venueDoc.data()?.name || 'Venue' : 'Venue';

          // Get total revenue for dummy report
          const overview = await financeService.getOverview(ctx);

          const pdfBuffer = generateFinanceReportPDF({
            venueName,
            reportType: type,
            fromDate: from,
            toDate: to,
            totalRevenue: overview.totalRevenue,
          });

          return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="report.pdf"`)
            .send(pdfBuffer);
        }

        if (rest === 'profile' && request.method === 'PATCH') {
          const allowedFields = [
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
            'photoURL',
            'logo',
            'coverURL',
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
          const patch = asRecord(body.patch);
          const safe: PlainRecord = {};
          for (const key of allowedFields) if (patch[key] !== undefined) safe[key] = patch[key];
          // Normalize image fields so discovery engine reads them correctly
          if (safe.profileImage) {
            safe.photoURL = safe.profileImage;
            safe.logo = safe.profileImage;
          }
          if (safe.coverImage) {
            safe.coverURL = safe.coverImage;
          }
          safe.updatedAt = new Date().toISOString();
          await fastify.db.collection('venues').doc(ctx.partnerId).set(safe, { merge: true });
          await fastify.publicDiscoveryService.syncVenueReadModels(ctx.partnerId).catch(() => {});
          await fastify.invalidatePublicDiscovery('all').catch(() => {});
          const doc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          return reply.send({ venue: { id: doc.id, ...(doc.data() || {}) } });
        }

        if (rest === 'notifications' && request.method === 'GET') {
          const limit = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100);
          let snap: any;
          try {
            snap = await fastify.db
              .collection('notifications')
              .where('recipientId', '==', ctx.partnerId)
              .orderBy('createdAt', 'desc')
              .limit(limit)
              .get();
          } catch (err: any) {
            if (
              err.code === 9 ||
              String(err).includes('requires an index') ||
              String(err).includes('FAILED_PRECONDITION')
            ) {
              fastify.log.warn(
                { partnerId: ctx.partnerId },
                'Firestore index missing for venue notifications query. Falling back to in-memory sort.',
              );
              const fallbackQ = await fastify.db
                .collection('notifications')
                .where('recipientId', '==', ctx.partnerId)
                .limit(limit * 2)
                .get()
                .catch(() => ({ docs: [] as any[] }));
              const sortedDocs = [...((fallbackQ as any).docs || [])].sort((a: any, b: any) => {
                const aTime = new Date(a.data()?.createdAt || 0).getTime();
                const bTime = new Date(b.data()?.createdAt || 0).getTime();
                return bTime - aTime;
              });
              snap = { docs: sortedDocs.slice(0, limit) };
            } else {
              request.log.error(
                { err, partnerId: ctx.partnerId },
                'Failed to fetch venue notifications',
              );
              snap = { docs: [] as any[] };
            }
          }
          const notifications = ((snap as any).docs || []).map((doc: any) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              ...data,
              title: decrypt(data.title),
              message: decrypt(data.message),
            };
          });
          return reply.send({ notifications });
        }

        if (rest === 'notifications' && request.method === 'PATCH') {
          const notificationId = String(body.notificationId || '');
          const markAllRead = body.markAllRead === true;
          if (markAllRead) {
            const snap = await fastify.db
              .collection('notifications')
              .where('recipientId', '==', ctx.partnerId)
              .where('read', '==', false)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const batch = fastify.db.batch();
            (snap as any).docs.forEach((doc: any) => batch.update(doc.ref, { read: true }));
            await batch.commit().catch(() => {});
            return reply.send({ success: true, markedCount: (snap as any).docs.length });
          }
          if (!notificationId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'notificationId or markAllRead required',
                requestId: request.id,
              }),
            );
          await fastify.db
            .collection('notifications')
            .doc(notificationId)
            .update({ read: true })
            .catch(() => {});
          return reply.send({ success: true, markedCount: 1 });
        }

        if (rest === 'orders' && request.method === 'GET') {
          const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
          let q: any = fastify.db.collection('orders').where('venueId', '==', ctx.partnerId);
          if (query.status) q = q.where('status', '==', query.status);
          const snap = await q
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const allOrders = ((snap as any).docs || []).map((doc: any) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              customerName: d.buyerName || d.customerName || d.name || 'Guest',
              email: d.buyerEmail || d.email || '',
              phone: d.buyerPhone || d.phone || '',
              amount: toNumber(d.totalPaise || 0) / 100,
              ticketsCount: toNumber(d.ticketCount || 1),
              createdAt: d.createdAt || null,
              eventId: d.eventId || null,
              eventTitle: d.eventTitle || d.eventName || null,
              status: d.status || 'paid',
              source: d.source || 'online',
              checkedInAt: d.checkedInAt || null,
              tierId: d.tierId || null,
              tierName: d.tierName || null,
              promoterCode: d.promoterCode || null,
            };
          });
          allOrders.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          const page = parseInt(String(query.page || '1'), 10) || 1;
          const start = (page - 1) * pageSize;
          const orders = allOrders.slice(start, start + pageSize);
          const hasMore = allOrders.length > start + pageSize;
          return reply.send({
            orders,
            hasMore,
            nextCursor: hasMore ? orders[orders.length - 1]?.id : null,
            pagination: { total: allOrders.length, limit: pageSize, page, hasMore },
          });
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
          const ordersSnap = await fastify.db
            .collection('orders')
            .where('venueId', '==', ctx.partnerId)
            .where('status', 'in', ['confirmed', 'paid'])
            .where('createdAt', '>=', windowStart.toISOString())
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const buckets: Record<string, { revenue: number; ticketsSold: number }> = {};
          for (let i = 0; i < points; i++) {
            const d = new Date(now);
            if (range === '1d') d.setHours(now.getHours() - (points - 1 - i), 0, 0, 0);
            else d.setDate(now.getDate() - (points - 1 - i));
            const key =
              range === '1d'
                ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
                : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            buckets[key] = { revenue: 0, ticketsSold: 0 };
          }
          for (const doc of (ordersSnap as any).docs || []) {
            const d = doc.data() || {};
            const ts = new Date(d.createdAt || 0);
            const key =
              range === '1d'
                ? `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}-${ts.getHours()}`
                : `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;
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
              label:
                range === '1d'
                  ? `${d.getHours()}:00`
                  : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: metric === 'revenue' ? v.revenue : v.ticketsSold,
              revenue: v.revenue,
              ticketsSold: v.ticketsSold,
            };
          });
          return reply.send({
            series,
            total: series.reduce(
              (sum, point) => sum + (metric === 'revenue' ? point.revenue : point.ticketsSold),
              0,
            ),
          });
        }

        if ((rest === 'overview' || rest === 'overview/summary') && request.method === 'GET') {
          return reply.send(await buildLegacyOverviewSummary(ctx.partnerId));
        }

        if (rest === 'overview/tonight' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          if (!eventId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'eventId required',
                requestId: request.id,
              }),
            );
          const eventDoc = await fastify.db.collection('events').doc(eventId).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const [ordersSnap, checkinsSnap] = await Promise.all([
            fastify.db
              .collection('orders')
              .where('eventId', '==', eventId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('check_ins')
              .where('eventId', '==', eventId)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          const revenue = ((ordersSnap as any).docs || []).reduce(
            (sum: number, doc: any) => sum + (doc.data().totalPaise || 0),
            0,
          );
          const ticketsSold = ((ordersSnap as any).docs || []).reduce(
            (sum: number, doc: any) => sum + (doc.data().ticketCount || 0),
            0,
          );
          return reply.send({
            id: eventId,
            revenue: revenue / 100,
            checkedIn: (checkinsSnap as any).size || 0,
            expected: ticketsSold,
            ticketsSold,
            entryVelocity: 0,
            entryRate: 0,
            entryHistory: [],
          });
        }

        if (rest === 'overview/alerts' && request.method === 'GET') {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
          const alerts: any[] = [];

          const [upcomingSnap, pendingSlotsSnap] = await Promise.all([
            fastify.db
              .collection('events')
              .where('venueId', '==', ctx.partnerId)
              .where('startDate', '>=', todayStr)
              .where('startDate', '<=', tomorrowStr)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('availability_slots')
              .where('venueId', '==', ctx.partnerId)
              .where('status', '==', 'pending')
              .limit(5)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);

          const upcomingEvents = ((upcomingSnap as any).docs || []).map((d: any) => ({
            id: d.id,
            ...(d.data() || {}),
          }));
          const pendingCount = ((pendingSlotsSnap as any).docs || []).length;

          if (upcomingEvents.length > 0) {
            alerts.push({
              type: 'info',
              title: `${upcomingEvents.length} event(s) today or tomorrow`,
              severity: 'low',
            });
          }
          if (pendingCount > 0) {
            alerts.push({
              type: 'action',
              title: `${pendingCount} pending slot request(s) need review`,
              severity: 'medium',
              action: '/venue/calendar',
            });
          }

          return reply.send({ alerts });
        }

        if (rest === 'page' && request.method === 'GET') {
          const [pageDoc, venueDoc, highlightsSnap, followersSnap] = await Promise.all([
            fastify.db
              .collection('venue_pages')
              .doc(ctx.partnerId)
              .get()
              .catch(() => null),
            fastify.db
              .collection('venues')
              .doc(ctx.partnerId)
              .get()
              .catch(() => null),
            fastify.db
              .collection('venue_highlights')
              .where('venueId', '==', ctx.partnerId)
              .where('isActive', '==', true)
              .limit(20)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('follows')
              .where('venueId', '==', ctx.partnerId)
              .get()
              .catch(() => ({ size: 0 })),
          ]);
          const pageData = pageDoc && (pageDoc as any).exists ? (pageDoc as any).data() || {} : {};
          const venueData =
            venueDoc && (venueDoc as any).exists ? (venueDoc as any).data() || {} : {};
          const highlights = ((highlightsSnap as any).docs || []).map((d: any) => ({
            id: d.id,
            ...(d.data() || {}),
          }));
          const followersCount = (followersSnap as any).size || 0;
          return reply.send({
            ...venueData,
            ...pageData,
            id: ctx.partnerId,
            venueId: ctx.partnerId,
            name: venueData.name || pageData.name || '',
            slug: venueData.slug || pageData.slug || ctx.partnerId,
            photoURL: venueData.photoURL || venueData.image || pageData.photoURL || null,
            coverPhoto: venueData.coverPhoto || venueData.coverImage || pageData.coverPhoto || null,
            tagline: venueData.tagline || pageData.tagline || '',
            bio: venueData.bio || venueData.description || pageData.bio || '',
            address: venueData.address || pageData.address || '',
            city: venueData.city || pageData.city || '',
            photos: venueData.photos || pageData.photos || [],
            videos: venueData.videos || pageData.videos || [],
            highlights,
            followersCount,
            totalLikes: toNumber(pageData.totalLikes || 0),
            totalViews: toNumber(pageData.totalViews || venueData.views || 0),
            theme: pageData.theme || { primary: '#FF5A5F', secondary: '#000000' },
            sections: pageData.sections || [],
            isActive: pageData.isActive !== false,
          });
        }

        if (rest === 'page' && request.method === 'POST') {
          const now = new Date().toISOString();
          const updates = asRecord(body.updates || body);
          await fastify.db
            .collection('venue_pages')
            .doc(ctx.partnerId)
            .set({ ...updates, venueId: ctx.partnerId, updatedAt: now }, { merge: true });
          // Also sync any top-level profile fields back to venues collection
          const profileFields = [
            'name',
            'tagline',
            'bio',
            'photoURL',
            'coverPhoto',
            'address',
            'city',
            'photos',
            'videos',
            'slug',
          ];
          const venuePatch: PlainRecord = { updatedAt: now };
          for (const key of profileFields)
            if (updates[key] !== undefined) venuePatch[key] = updates[key];
          if (Object.keys(venuePatch).length > 1)
            await fastify.db
              .collection('venues')
              .doc(ctx.partnerId)
              .set(venuePatch, { merge: true })
              .catch(() => {});
          return reply.send({ success: true });
        }

        if (rest === 'broadcast' && request.method === 'POST') {
          const message = String(body.message || '').trim();
          const title = String(body.title || 'Update from your venue').trim();
          if (!message)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'message required',
                requestId: request.id,
              }),
            );
          const followersSnap = await fastify.db
            .collection('follows')
            .where('venueId', '==', ctx.partnerId)
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const batch = fastify.db.batch();
          const now = new Date().toISOString();
          let count = 0;
          for (const doc of (followersSnap as any).docs || []) {
            const followData = doc.data() || {};
            const ref = fastify.db.collection('notifications').doc();
            batch.set(ref, {
              recipientId: followData.userId || followData.guestId,
              type: 'venue_broadcast',
              title,
              message,
              venueId: ctx.partnerId,
              read: false,
              createdAt: now,
            });
            count++;
          }
          if (count > 0) await batch.commit();
          return reply.send({ success: true, recipientCount: count });
        }

        if (rest === 'crm/online' && request.method === 'GET') {
          // Source from orders — the real guest data store
          const snap = await fastify.db
            .collection('orders')
            .where('venueId', '==', ctx.partnerId)
            .where('status', 'in', ['confirmed', 'paid'])
            .limit(1000)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          return reply.send({
            customers: ((snap as any).docs || []).map((doc: any) => {
              const d = doc.data() || {};
              return {
                id: doc.id,
                name: d.buyerName || d.customerName || d.name || 'Guest',
                email: d.buyerEmail || d.email || '',
                phone: d.buyerPhone || d.phone || '',
                age: d.age || null,
                gender: d.gender || null,
                eventName: d.eventTitle || d.eventName || 'Event',
                entryTime: d.checkedInAt || d.createdAt || null,
                status: d.checkedInAt ? 'checked_in' : 'paid',
              };
            }),
          });
        }

        if (rest === 'events' && request.method === 'PATCH') {
          const eventId = String(body.eventId || '');
          const action = String(body.action || '');
          const eventDoc = await fastify.db.collection('events').doc(eventId).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const statusMap: Record<string, string> = {
            approve: 'scheduled',
            reject: 'denied',
            pause: 'paused',
            resume: 'scheduled',
          };
          const newStatus = statusMap[action];
          if (!newStatus)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'Invalid action',
                requestId: request.id,
              }),
            );
          const now = new Date().toISOString();
          const eventUpdatePayload: Record<string, any> = { lifecycle: newStatus, updatedAt: now };
          if (action === 'approve') {
            eventUpdatePayload.approvedAt = now;
            eventUpdatePayload.visibility = 'public';
          }
          await fastify.db.collection('events').doc(eventId).update(eventUpdatePayload);
          // Keep event_card_index and search in sync whenever the event goes public/live/paused
          if (['scheduled', 'live', 'paused'].includes(newStatus)) {
            fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
          }
          return reply.send({ success: true, status: newStatus });
        }

        if (rest === 'events/requests' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('availability_slots')
            .where('venueId', '==', ctx.partnerId)
            .where('status', '==', 'pending')
            .limit(100)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const requests = ((snap as any).docs || [])
            .map((doc: any) => normalizeSlotRecord(doc))
            .filter((slot: any) => !isVenueBlock(slot));
          requests.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ slotRequests: requests, requests });
        }

        if (rest === 'orders/latest' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('latest_orders_feed')
            .where('venueId', '==', ctx.partnerId)
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const orders = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          orders.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ orders: orders.slice(0, 20) });
        }

        if (rest === 'staff' && request.method === 'GET') {
          let q: any = fastify.db.collection('venue_staff').where('venueId', '==', ctx.partnerId);
          if (query.isActive === 'true') q = q.where('isActive', '==', true);
          else if (query.isActive === 'false') q = q.where('isActive', '==', false);
          const snap = await q.get();
          return reply.send({
            staff: snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
          });
        }

        if (rest === 'staff' && request.method === 'POST') {
          const emailRecipient = String(body.email || '')
            .toLowerCase()
            .trim();
          if (!emailRecipient) {
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'Email is required',
                requestId: request.id,
              }),
            );
          }

          // Check if an invitation/active/removed staff already exists
          const existingStaffSnap = await fastify.db
            .collection('venue_staff')
            .where('venueId', '==', ctx.partnerId)
            .where('email', '==', emailRecipient)
            .get();

          if (!existingStaffSnap.empty) {
            const existingStaff = existingStaffSnap.docs[0].data();
            if (existingStaff.status === 'active') {
              return reply.status(400).send(
                buildErrorResponse({
                  code: 'BAD_REQUEST',
                  message: 'This team member is already active in this venue',
                  requestId: request.id,
                }),
              );
            } else if (existingStaff.status === 'invited') {
              return reply.status(400).send(
                buildErrorResponse({
                  code: 'BAD_REQUEST',
                  message: 'A pending invitation already exists for this email',
                  requestId: request.id,
                }),
              );
            } else if (existingStaff.status === 'removed') {
              return reply.status(400).send(
                buildErrorResponse({
                  code: 'BAD_REQUEST',
                  message: 'This team member has been removed from this venue',
                  requestId: request.id,
                }),
              );
            }
          }

          // Check if user is already registered in Firebase Auth
          try {
            const userRecord = await fastify.auth.getUserByEmail(emailRecipient);
            if (userRecord) {
              return reply.status(400).send(
                buildErrorResponse({
                  code: 'BAD_REQUEST',
                  message: 'A user with this email address already exists',
                  requestId: request.id,
                }),
              );
            }
          } catch (e: any) {
            if (e.code !== 'auth/user-not-found') {
              throw e;
            }
          }

          const now = new Date().toISOString();
          const tempPassword = generateTemporaryPassword();
          const inviteToken = randomUUID();
          const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const venueDoc = await fastify.db.collection('venues').doc(ctx.partnerId).get();
          const venueName = venueDoc.exists ? venueDoc.data()?.name || 'Venue' : 'Venue';

          let origin = 'http://localhost:3001';
          if (request.headers.referer) {
            try {
              origin = new URL(request.headers.referer).origin;
            } catch {
              if (request.headers.origin) origin = request.headers.origin;
            }
          } else if (request.headers.origin) {
            origin = request.headers.origin;
          }

          const acceptLink = `${origin}/auth/staff-invite?code=${inviteToken}&venue=${ctx.partnerId}`;
          const setPasswordLink = `${origin}/auth/change-password?code=${inviteToken}&venue=${ctx.partnerId}`;

          const roleLabels: Record<string, string> = {
            MANAGER: 'Manager',
            FINANCE_ADMIN: 'Finance',
            SECURITY: 'Security',
            DOOR: 'Door',
            STAFF: 'Staff',
          };
          const roleLabel = roleLabels[body.role] || body.role;

          await sendInvitationEmail({
            recipient: emailRecipient,
            name: body.name || 'Team Member',
            roleLabel,
            venueName,
            tempPassword,
            acceptLink,
            setPasswordLink,
          });

          const res = await fastify.db.collection('venue_staff').add({
            venueId: ctx.partnerId,
            email: emailRecipient,
            name: body.name || '',
            role: body.role,
            status: 'invited',
            verified: false,
            isActive: true,
            tempPassword,
            inviteToken,
            inviteExpires,
            createdAt: now,
            updatedAt: now,
          });
          return reply.send({ success: true, id: res.id });
        }

        if (rest === 'staff' && request.method === 'PATCH') {
          const targetId = String(body.staffId || body.memberId || '');
          if (!targetId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'staffId required',
                requestId: request.id,
              }),
            );
          const ref = fastify.db.collection('venue_staff').doc(targetId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Member not found',
                requestId: request.id,
              }),
            );
          const staffData = doc.data();
          const now = new Date().toISOString();

          if (body.action === 'remove') {
            await ref.update({
              status: 'removed',
              isActive: false,
              updatedAt: now,
            });
            if (staffData?.userId) {
              const membershipsSnap = await fastify.db
                .collection('partner_memberships')
                .where('partnerId', '==', ctx.partnerId)
                .where('uid', '==', staffData.userId)
                .get();

              for (const membershipDoc of membershipsSnap.docs) {
                await membershipDoc.ref.update({
                  isActive: false,
                  updatedAt: now,
                });
              }
            }
            return reply.send({ success: true });
          }

          const updates: any = { updatedAt: now };
          if (body.action === 'suspend') {
            updates.status = 'suspended';
            updates.isActive = false;
          } else if (body.action === 'reactivate') {
            updates.status = 'active';
            updates.isActive = true;
          }

          if (body.action === 'verify') updates.verified = true;
          if (body.role !== undefined) updates.role = body.role;
          if (body.isActive !== undefined) updates.isActive = body.isActive;

          await ref.update(updates);

          if (staffData?.userId) {
            const membershipsSnap = await fastify.db
              .collection('partner_memberships')
              .where('partnerId', '==', ctx.partnerId)
              .where('uid', '==', staffData.userId)
              .get();

            for (const membershipDoc of membershipsSnap.docs) {
              await membershipDoc.ref.update({
                isActive: body.action === 'reactivate',
                updatedAt: now,
              });
            }
          }

          return reply.send({ success: true });
        }

        if (rest === 'staff' && request.method === 'DELETE') {
          const targetId = String(query.staffId || query.memberId || '');
          if (!targetId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'staffId required',
                requestId: request.id,
              }),
            );
          const ref = fastify.db.collection('venue_staff').doc(targetId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Member not found',
                requestId: request.id,
              }),
            );

          const staffData = doc.data();
          const now = new Date().toISOString();
          await ref.update({
            status: 'removed',
            isActive: false,
            updatedAt: now,
          });

          if (staffData?.userId) {
            const membershipsSnap = await fastify.db
              .collection('partner_memberships')
              .where('partnerId', '==', ctx.partnerId)
              .where('uid', '==', staffData.userId)
              .get();

            for (const membershipDoc of membershipsSnap.docs) {
              await membershipDoc.ref.update({
                isActive: false,
                updatedAt: now,
              });
            }
          }

          return reply.send({ success: true });
        }

        const membershipStaffMatch = rest.match(/^staff\/([^/]+)$/);
        if (membershipStaffMatch && request.method === 'PATCH') {
          await fastify.db
            .collection('partner_memberships')
            .doc(membershipStaffMatch[1])
            .update({
              ...(body.role !== undefined ? { role: body.role } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
              updatedAt: new Date().toISOString(),
            });
          return reply.send({ success: true });
        }
        if (membershipStaffMatch && request.method === 'DELETE') {
          await fastify.db
            .collection('partner_memberships')
            .doc(membershipStaffMatch[1])
            .update({ isActive: false, removedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        if (rest === 'staff-profiles' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('staff_profiles')
            .where('venueId', '==', ctx.partnerId)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          return reply.send({
            profiles: ((snap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
            })),
          });
        }
        if (rest === 'staff-profiles/assignments' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('staff_assignments')
            .where('venueId', '==', ctx.partnerId)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          return reply.send({
            assignments: ((snap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
            })),
          });
        }
        if (rest === 'staff-profiles/assign' && request.method === 'POST') {
          await fastify.db.collection('staff_assignments').add({
            venueId: ctx.partnerId,
            profileId: body.profileId,
            memberId: body.memberId,
            createdAt: new Date().toISOString(),
          });
          return reply.send({ success: true });
        }

        const staffProfileMatch = rest.match(/^staff-profiles\/([^/]+)$/);
        if (staffProfileMatch && request.method === 'PATCH') {
          const profileId = staffProfileMatch[1];
          const ref = fastify.db.collection('staff_profiles').doc(profileId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Profile not found',
                requestId: request.id,
              }),
            );
          if ((doc.data() as PlainRecord).venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your profile',
                requestId: request.id,
              }),
            );
          const safe: PlainRecord = { updatedAt: new Date().toISOString() };
          const allowedFields = [
            'displayName',
            'role',
            'tabVisibility',
            'isActive',
            'phone',
            'email',
            'notes',
          ];
          for (const key of allowedFields) if (body[key] !== undefined) safe[key] = body[key];
          await ref.update(safe);
          return reply.send({ success: true });
        }
        if (staffProfileMatch && request.method === 'DELETE') {
          const profileId = staffProfileMatch[1];
          const ref = fastify.db.collection('staff_profiles').doc(profileId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Profile not found',
                requestId: request.id,
              }),
            );
          if ((doc.data() as PlainRecord).venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your profile',
                requestId: request.id,
              }),
            );
          await ref.update({ isActive: false, deletedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        const eventTicketsMatch = rest.match(/^events\/([^/]+)\/tickets$/);
        if (eventTicketsMatch && request.method === 'GET') {
          const eventDoc = await fastify.db.collection('events').doc(eventTicketsMatch[1]).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          const rawTiers = asArray(event.ticketTiers || event.tiers || event.tickets);
          const tiers = rawTiers.map((tier: PlainRecord, index: number) => {
            const qty = toNumber(tier.quantity || tier.maxQuantity || 0);
            const sold = toNumber(tier.sold || 0);
            const remaining = Math.max(0, qty - sold);
            const sellThrough = qty > 0 ? Math.round((sold / qty) * 100) : 0;
            return {
              id: tier.id || tier.tierId || String(index),
              name: tier.name || '',
              description: tier.description || '',
              entryType: tier.entryType || 'general',
              price: toNumber(tier.price || 0),
              quantity: qty,
              sold,
              remaining,
              sellThrough,
              startSale: tier.startSale || tier.saleStartDate || null,
              endSale: tier.endSale || tier.saleEndDate || null,
              minPurchaseQuantity: toNumber(tier.minPurchaseQuantity || tier.minQty || 1),
              maxPurchaseQuantity: toNumber(tier.maxPurchaseQuantity || tier.maxQty || 10),
              promoterEnabled: tier.promoterEnabled !== false,
              isHidden: !!tier.isHidden,
              isDisabled: !!tier.isDisabled,
              isSoldOut: qty > 0 && remaining === 0,
              passwordProtected: !!tier.passwordProtected,
              requiresApproval: !!tier.requiresApproval,
              status: tier.status || 'active',
              order: toNumber(tier.order ?? index),
            };
          });
          const totalSold = tiers.reduce((s: number, t: any) => s + t.sold, 0);
          const totalInventory = tiers.reduce((s: number, t: any) => s + t.quantity, 0);
          const totalRemaining = tiers.reduce((s: number, t: any) => s + t.remaining, 0);
          return reply.send({ tiers, totalSold, totalInventory, totalRemaining });
        }
        if (eventTicketsMatch && request.method === 'PATCH') {
          const eventDoc = await fastify.db.collection('events').doc(eventTicketsMatch[1]).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          if (!Array.isArray(body.tiers))
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'tiers array required',
                requestId: request.id,
              }),
            );
          await fastify.db
            .collection('events')
            .doc(eventTicketsMatch[1])
            .update({ ticketTiers: body.tiers, updatedAt: new Date().toISOString() });
          await fastify.cache.delete('events:detail', eventTicketsMatch[1]).catch(() => {});
          return reply.send({ success: true });
        }

        const eventOverviewMatch = rest.match(/^events\/([^/]+)\/overview$/);
        if (eventOverviewMatch && request.method === 'GET') {
          const evtId = eventOverviewMatch[1];
          const [eventDoc, ordersSnap, checkinsSnap, viewsSnap] = await Promise.all([
            fastify.db.collection('events').doc(evtId).get(),
            fastify.db
              .collection('orders')
              .where('eventId', '==', evtId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch((err: any) => {
                request.log.error({ err, eventId: evtId }, 'Failed to query orders for overview');
                return { docs: [] as any[] };
              }),
            fastify.db
              .collection('check_ins')
              .where('eventId', '==', evtId)
              .get()
              .catch((err: any) => {
                request.log.error(
                  { err, eventId: evtId },
                  'Failed to query check_ins for overview',
                );
                return { size: 0 };
              }),
            fastify.db
              .collection('event_views')
              .doc(evtId)
              .get()
              .catch(() => null),
          ]);
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          const orderDocs = (ordersSnap as any).docs || [];
          const ticketsSold = orderDocs.reduce(
            (s: number, d: any) => s + toNumber(d.data().ticketCount || 1),
            0,
          );
          const grossRevenue =
            orderDocs.reduce((s: number, d: any) => s + toNumber(d.data().totalPaise || 0), 0) /
            100;
          const rawTiers = asArray(event.ticketTiers || event.tiers || []);
          const inventory = rawTiers.reduce(
            (s: number, t: any) => s + toNumber(t.quantity || t.maxQuantity || 0),
            0,
          );
          const capacity = toNumber(event.capacity || inventory || 0);
          const checkedIn = (checkinsSnap as any).size || 0;
          const buyerIds = new Set(
            orderDocs.map((d: any) => d.data().buyerPhone || d.data().buyerEmail || d.id),
          );
          const uniqueAttendees = buyerIds.size;
          const viewsData =
            viewsSnap && (viewsSnap as any).exists ? (viewsSnap as any).data() || {} : {};
          const tierMap = new Map<string, { tierName: string; sold: number; revenue: number }>();
          for (const d of orderDocs) {
            const o = d.data();
            const tierId = o.tierId || 'unknown';
            const tierName = o.tierName || 'Ticket';
            if (!tierMap.has(tierId)) tierMap.set(tierId, { tierName, sold: 0, revenue: 0 });
            const entry = tierMap.get(tierId)!;
            entry.sold += toNumber(o.ticketCount || 1);
            entry.revenue += toNumber(o.totalPaise || 0) / 100;
          }
          const ticketMix = Array.from(tierMap.entries()).map(([tierId, v]) => ({
            tierId,
            tierName: v.tierName,
            sold: v.sold,
            revenue: v.revenue,
          }));
          const topTier =
            ticketMix.length > 0
              ? ticketMix.reduce((a, b) => (a.revenue > b.revenue ? a : b))
              : null;
          const topTierFmt = topTier
            ? {
                tierId: topTier.tierId,
                tierName: topTier.tierName,
                sold: topTier.sold,
                revenue: topTier.revenue,
              }
            : null;
          const sellThrough = capacity > 0 ? Math.round((ticketsSold / capacity) * 100) : 0;
          const conversionRate =
            toNumber(viewsData.count || 0) > 0
              ? Math.round((ticketsSold / toNumber(viewsData.count)) * 100)
              : 0;

          // Build sales timeline from order dates
          const salesByDate = new Map<string, { tickets: number; revenue: number }>();
          for (const d of orderDocs) {
            const o = d.data();
            const date = (o.createdAt || '').split('T')[0];
            if (!date) continue;
            if (!salesByDate.has(date)) salesByDate.set(date, { tickets: 0, revenue: 0 });
            const entry = salesByDate.get(date)!;
            entry.tickets += toNumber(o.ticketCount || 1);
            entry.revenue += toNumber(o.totalPaise || 0) / 100;
          }
          const salesTimeline = Array.from(salesByDate.entries())
            .map(([date, data]) => ({ date, tickets: data.tickets, revenue: data.revenue }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Build hourly check-in timeline
          const hourlyMap = new Map<string, number>();
          const checkInDocs = (checkinsSnap as any).docs || [];
          for (const d of checkInDocs) {
            const o = d.data();
            const ts = o.checkedInAt || o.createdAt;
            if (!ts) continue;
            const hour = String(ts).split('T')[1]?.split(':')[0];
            if (!hour) continue;
            hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
          }
          const hourlyTimeline = Array.from(hourlyMap.entries())
            .map(([hour, count]) => ({ hour: Number(hour), label: `${hour}:00`, checkIns: count }))
            .sort((a, b) => a.hour - b.hour);

          // Derive peak hours from timelines
          const peakSalesEntry =
            salesTimeline.length > 0
              ? salesTimeline.reduce((a, b) => (a.revenue > b.revenue ? a : b))
              : null;
          const peakCheckInEntry =
            hourlyTimeline.length > 0
              ? hourlyTimeline.reduce((a, b) => (a.checkIns > b.checkIns ? a : b))
              : null;

          return reply.send({
            ticketsSold,
            grossRevenue,
            estimatedEarnings: Math.round(grossRevenue * 0.85 * 100) / 100,
            guestListSize: 0,
            totalCheckedIn: checkedIn,
            conversionRate,
            sellThrough,
            uniqueAttendees,
            repeatGuests: 0,
            firstTimeGuests: uniqueAttendees,
            topTier: topTierFmt,
            locationDistribution: [],
            ticketMix,
            inventory,
            capacity,
            isPublic: event.isPublic !== false,
            isLiveEditable: event.status === 'live',
            topPromoter: null,
            views: toNumber(viewsData.count || 0),
            saves: toNumber(viewsData.saves || 0),
            salesTimeline,
            hourlyTimeline,
            peakSalesHour: peakSalesEntry
              ? {
                  date: peakSalesEntry.date,
                  revenue: peakSalesEntry.revenue,
                  tickets: peakSalesEntry.tickets,
                }
              : null,
            peakCheckInHour: peakCheckInEntry
              ? {
                  hour: peakCheckInEntry.hour,
                  label: peakCheckInEntry.label,
                  checkIns: peakCheckInEntry.checkIns,
                }
              : null,
            timeZone: event.timeZone || 'Asia/Kolkata',
          });
        }

        const eventFinanceMatch = rest.match(/^events\/([^/]+)\/finance$/);
        if (eventFinanceMatch && request.method === 'GET') {
          const evtId = eventFinanceMatch[1];
          const [eventDoc, ordersSnap, walkInsSnap] = await Promise.all([
            fastify.db.collection('events').doc(evtId).get(),
            fastify.db
              .collection('orders')
              .where('eventId', '==', evtId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch((err: any) => {
                request.log.error({ err, eventId: evtId }, 'Failed to query orders for finance');
                return { docs: [] as any[] };
              }),
            fastify.db
              .collection('walk_in_entries')
              .doc(evtId)
              .collection('logs')
              .get()
              .catch((err: any) => {
                request.log.error(
                  { err, eventId: evtId },
                  'Failed to query walk_in_entries for finance',
                );
                return { docs: [] as any[] };
              }),
          ]);
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          const orderDocs = (ordersSnap as any).docs || [];
          const walkInDocs = (walkInsSnap as any).docs || [];
          const gross =
            orderDocs.reduce((s: number, d: any) => s + toNumber(d.data().totalPaise || 0), 0) /
            100;
          const refundAmount =
            orderDocs
              .filter((d: any) => d.data().refundedAt)
              .reduce((s: number, d: any) => s + toNumber(d.data().refundPaise || 0), 0) / 100;
          const platformFee = Math.round(gross * 0.05 * 100) / 100;
          const venueCommissionRate = toNumber(event.venueCommissionRate || 15);
          const venueCommission = Math.round(gross * (venueCommissionRate / 100) * 100) / 100;
          const walkInRevenue = walkInDocs.reduce(
            (s: number, d: any) => s + toNumber(d.data().amount || 0),
            0,
          );
          const net = Math.max(0, gross - platformFee - refundAmount);
          const tierMap = new Map<string, { tierName: string; sold: number; revenue: number }>();
          for (const d of orderDocs) {
            const o = d.data();
            const tierId = o.tierId || 'unknown';
            const tierName = o.tierName || 'Ticket';
            if (!tierMap.has(tierId)) tierMap.set(tierId, { tierName, sold: 0, revenue: 0 });
            const entry = tierMap.get(tierId)!;
            entry.sold += toNumber(o.ticketCount || 1);
            entry.revenue += toNumber(o.totalPaise || 0) / 100;
          }
          const ticketMix = Array.from(tierMap.entries()).map(([tierId, v]) => ({
            tierId,
            tierName: v.tierName,
            revenue: v.revenue,
            sold: v.sold,
          }));
          return reply.send({
            gross,
            platformFee,
            venueCommission,
            venueCommissionRate,
            refundAmount,
            expenses: 0,
            net,
            walkInRevenue,
            walkInOrders: walkInDocs.length,
            onlineRevenue: gross,
            onlineOrders: orderDocs.length,
            settlementStatus: event.settlementStatus || 'pending',
            paidAt: event.settledAt || null,
            paymentSources: [{ label: 'Online', amount: gross, orders: orderDocs.length }],
            intakeChannels: [{ label: 'App', amount: gross, orders: orderDocs.length }],
            ticketMix,
            hostPayout: null,
            promoterPayouts: [],
            payoutSummary: null,
          });
        }

        const eventAttendeesMatchSingle = rest.match(/^events\/([^/]+)\/attendees\/([^/]+)$/);
        if (eventAttendeesMatchSingle && request.method === 'GET') {
          const [, evtId, attendeeId] = eventAttendeesMatchSingle;
          const [eventDoc, orderDoc, allOrdersSnap] = await Promise.all([
            fastify.db.collection('events').doc(evtId).get(),
            fastify.db.collection('orders').doc(attendeeId).get(),
            fastify.db
              .collection('orders')
              .where('eventId', '==', evtId)
              .where('status', 'in', ['confirmed', 'paid'])
              .limit(500)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          if (!orderDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Attendee not found',
                requestId: request.id,
              }),
            );
          const o = orderDoc.data() as PlainRecord;
          const lifetimeSnap = await fastify.db
            .collection('orders')
            .where('buyerPhone', '==', o.buyerPhone || '')
            .where('status', 'in', ['confirmed', 'paid'])
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[], size: 0 }));
          const lifetimeOrders = ((lifetimeSnap as any).docs || []).map((d: any) => {
            const od = d.data() || {};
            return {
              id: d.id,
              orderIndex: null,
              orderNumber: d.id.slice(0, 8).toUpperCase(),
              eventId: od.eventId || evtId,
              eventName: od.eventTitle || od.eventName || 'Event',
              eventImage: od.eventImage || '',
              customerName: od.buyerName || 'Guest',
              email: od.buyerEmail || '',
              phone: od.buyerPhone || '',
              amount: toNumber(od.totalPaise || 0) / 100,
              ticketsCount: toNumber(od.ticketCount || 1),
              createdAt: od.createdAt || null,
              confirmedAt: od.confirmedAt || null,
              checkedInAt: od.checkedInAt || null,
              cancelledAt: od.cancelledAt || null,
              updatedAt: od.updatedAt || null,
              status: od.checkedInAt ? 'checked_in' : 'paid',
              source: od.source || 'ticket',
              tags: od.tags || [],
              promoterCode: od.promoterCode || null,
              note: od.note || null,
              items: [],
            };
          });
          const rawName = o.buyerName || 'Guest';
          const maskedName =
            rawName.length > 2
              ? rawName.slice(0, 2) + '*'.repeat(Math.max(2, rawName.length - 2))
              : rawName;
          const allOrders = (allOrdersSnap as any).docs || [];
          const buyerOrders = allOrders.filter(
            (d: any) =>
              d.data().buyerPhone === o.buyerPhone || d.data().buyerEmail === o.buyerEmail,
          );
          const attendee = {
            id: attendeeId,
            attendeeId,
            fullName: rawName,
            email: o.buyerEmail || '',
            phone: o.buyerPhone || '',
            instagram: o.instagram || '',
            ticketTier: o.tierName || '',
            tierId: o.tierId || '',
            quantity: toNumber(o.ticketCount || 1),
            totalSpend: toNumber(o.totalPaise || 0) / 100,
            source: o.source || 'online',
            status: o.checkedInAt ? 'checked_in' : 'paid',
            purchasedAt: o.createdAt || null,
            checkedInAt: o.checkedInAt || null,
            city: o.city || '',
            area: o.area || '',
            isVip: !!o.isVip,
            tags: o.tags || [],
            orderId: attendeeId,
            orderSummary: `${o.ticketCount || 1} ticket(s)`,
            orderNumber: attendeeId.slice(0, 8).toUpperCase(),
            stats: {
              eventsAttended: buyerOrders.length,
              lifetimeSpend: toNumber(o.totalPaise || 0) / 100,
            },
            joinedAt: o.createdAt || null,
          };
          const timeline: any[] = [
            {
              id: 'purchase',
              label: 'Ticket Purchased',
              timestamp: o.createdAt || null,
              kind: 'purchase',
            },
            ...(o.checkedInAt
              ? [{ id: 'checkin', label: 'Checked In', timestamp: o.checkedInAt, kind: 'checkin' }]
              : []),
          ];
          return reply.send({
            attendee,
            orders: lifetimeOrders,
            timeline,
            selectedOrderId: attendeeId,
          });
        }

        const eventAttendeesMatch = rest.match(/^events\/([^/]+)\/attendees$/);
        if (eventAttendeesMatch && request.method === 'GET') {
          const evtId = eventAttendeesMatch[1];
          const eventDoc = await fastify.db.collection('events').doc(evtId).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          const page = parseInt(String(query.page || '1'), 10) || 1;
          const limit = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100);
          let q: any = fastify.db
            .collection('orders')
            .where('eventId', '==', evtId)
            .where('status', 'in', ['confirmed', 'paid']);
          if (query.tierId) q = q.where('tierId', '==', query.tierId);
          const snap = await q
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          let orderDocs = (snap as any).docs || [];
          if (query.status && query.status !== 'all') {
            if (query.status === 'checked_in')
              orderDocs = orderDocs.filter((d: any) => !!d.data().checkedInAt);
            else if (query.status === 'not_arrived')
              orderDocs = orderDocs.filter((d: any) => !d.data().checkedInAt);
          }
          if (query.q) {
            const term = String(query.q).toLowerCase();
            orderDocs = orderDocs.filter((d: any) => {
              const o = d.data();
              return (
                (o.buyerName || '').toLowerCase().includes(term) ||
                (o.buyerPhone || '').includes(term)
              );
            });
          }
          const total = orderDocs.length;
          const totalPages = Math.ceil(total / limit);
          const paged = orderDocs.slice((page - 1) * limit, page * limit);
          const attendees = paged.map((doc: any) => {
            const o = doc.data() || {};
            const rawName = o.buyerName || 'Guest';
            return {
              id: doc.id,
              attendeeId: doc.id,
              fullName: rawName,
              email: o.buyerEmail || '',
              phone: o.buyerPhone || '',
              instagram: o.instagram || '',
              ticketTier: o.tierName || '',
              tierId: o.tierId || '',
              quantity: toNumber(o.ticketCount || 1),
              totalSpend: toNumber(o.totalPaise || 0) / 100,
              source: o.source || 'online',
              status: o.checkedInAt ? 'checked_in' : 'paid',
              purchasedAt: o.createdAt || null,
              checkedInAt: o.checkedInAt || null,
              city: o.city || '',
              area: o.area || '',
              isVip: !!o.isVip,
              tags: o.tags || [],
              orderId: doc.id,
              orderSummary: `${o.ticketCount || 1} ticket(s)`,
            };
          });
          const rawTiers = asArray(event.ticketTiers || event.tiers || []);
          const tierOptions = rawTiers.map((t: any, i: number) => ({
            id: t.id || String(i),
            name: t.name || 'Ticket',
          }));
          return reply.send({
            attendees,
            pagination: { page, limit, total, totalPages },
            filters: {
              tierOptions,
              sourceOptions: ['online', 'door', 'promoter'],
              statusOptions: ['checked_in', 'not_arrived'],
            },
          });
        }

        const eventPromotersMatch = rest.match(/^events\/([^/]+)\/promoters$/);
        if (eventPromotersMatch && request.method === 'GET') {
          const evtId = eventPromotersMatch[1];
          const eventDoc = await fastify.db.collection('events').doc(evtId).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );
          const [assignmentsSnap, settingsDoc, connectionsSnap] = await Promise.all([
            fastify.db
              .collection('promoter_assignments')
              .where('eventId', '==', evtId)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('event_promoter_settings')
              .doc(evtId)
              .get()
              .catch(() => null),
            fastify.db
              .collection('promoter_connections')
              .where('venueId', '==', ctx.partnerId)
              .where('status', 'in', ['approved', 'active'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          const settingsData =
            settingsDoc && (settingsDoc as any).exists ? (settingsDoc as any).data() || {} : {};
          const promoterSettings = {
            mode: settingsData.mode || 'all',
            commissionRate: settingsData.commissionRate || 10,
            ...settingsData,
          };
          const assignedPromoters = ((assignmentsSnap as any).docs || []).map((doc: any) => {
            const data = doc.data() || {};
            return {
              assignmentId: doc.id,
              ...data,
              id: doc.id,
              promoterId: data.promoterId || '',
            };
          });
          const assignedIds = new Set(
            assignedPromoters.map((p: any) => p.promoterId).filter(Boolean),
          );
          const unassignedPromoters = ((connectionsSnap as any).docs || [])
            .map((doc: any) => {
              const conn = doc.data() || {};
              const promoterId = conn.promoterId;
              if (!promoterId || assignedIds.has(promoterId)) return null;
              return {
                assignmentId: null,
                id: promoterId,
                promoterId,
                promoterName: conn.promoterName || 'Promoter',
                avatar: conn.promoterAvatar || conn.avatarUrl || null,
                status: 'disabled',
                isActive: false,
                shortCode: null,
                sales: 0,
                revenue: 0,
                clicks: 0,
                commissionRate: promoterSettings.commissionRate || 10,
              };
            })
            .filter(Boolean);
          const promoters = [...assignedPromoters, ...unassignedPromoters];
          const totalPromoters = promoters.length;
          const activePromoters = promoters.filter(
            (p: any) => p.isActive !== false && p.status === 'active',
          ).length;
          const disabledPromoters = totalPromoters - activePromoters;
          const ticketsSold = promoters.reduce(
            (s: number, p: any) => s + toNumber(p.ticketsSold || 0),
            0,
          );
          const revenue = promoters.reduce((s: number, p: any) => s + toNumber(p.revenue || 0), 0);
          const clicks = promoters.reduce((s: number, p: any) => s + toNumber(p.clicks || 0), 0);
          return reply.send({
            promoters,
            promoterSettings,
            summary: {
              totalPromoters,
              selectedPromoters: activePromoters,
              activePromoters,
              disabledPromoters,
              ticketsSold,
              revenue,
              clicks,
            },
          });
        }

        async function ensurePromoterLink(
          db: any,
          promoterId: string,
          eventId: string,
          eventTitle: string,
          commissionRate: number,
        ): Promise<string> {
          try {
            const promoterRef = db.collection('promoters').doc(promoterId);
            const promoterDoc = await promoterRef.get();
            let trackingCode = promoterDoc.exists ? promoterDoc.data()?.trackingCode : null;

            if (!trackingCode) {
              const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
              let base = (
                promoterDoc.exists
                  ? promoterDoc.data()?.displayName || promoterDoc.data()?.name || 'promo'
                  : 'promo'
              )
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
              if (base.length > 10) base = base.substring(0, 10);
              if (base.length < 3) base = 'promo';

              let isUnique = false;
              let newCode = '';
              while (!isUnique) {
                const suffix = Array.from(
                  { length: 3 },
                  () => chars[Math.floor(Math.random() * chars.length)],
                ).join('');
                newCode = `${base}${suffix}`;
                const existingGlobal = await db
                  .collection('promoters')
                  .where('trackingCode', '==', newCode)
                  .limit(1)
                  .get();
                if (existingGlobal.empty) {
                  isUnique = true;
                }
              }
              trackingCode = newCode;
              await promoterRef.set({ trackingCode }, { merge: true });
            }

            const linkId = `${promoterId}_${eventId}`;
            const linkRef = db.collection('promoter_links').doc(linkId);
            const linkDoc = await linkRef.get();

            if (!linkDoc.exists) {
              const now = new Date().toISOString();
              await linkRef.set({
                id: linkId,
                promoterId,
                promoterName: promoterDoc.exists
                  ? promoterDoc.data()?.displayName || promoterDoc.data()?.name || ''
                  : '',
                eventId,
                eventTitle,
                campaignLabel: 'assigned',
                ticketTierIds: [],
                commissionRate,
                commissionType: 'percentage',
                code: trackingCode,
                clicks: 0,
                conversions: 0,
                revenue: 0,
                commission: 0,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              });
            }

            return trackingCode || '';
          } catch (err: any) {
            console.error(`[ensurePromoterLink] Error: ${err.message}`);
            return '';
          }
        }

        if (eventPromotersMatch && request.method === 'PATCH') {
          const evtId = eventPromotersMatch[1];
          const eventDoc = await fastify.db.collection('events').doc(evtId).get();
          if (!eventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const event = eventDoc.data() as PlainRecord;
          if (event.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );

          // Read previous state so we can diff newly added promoters
          const prevDoc = await fastify.db
            .collection('event_promoter_settings')
            .doc(evtId)
            .get()
            .catch(() => null);
          const prevIds: string[] =
            (prevDoc?.exists ? (prevDoc.data() as any)?.allowedPromoterIds : null) ?? [];

          await fastify.db
            .collection('event_promoter_settings')
            .doc(evtId)
            .set(
              {
                ...body,
                eventId: evtId,
                venueId: ctx.partnerId,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );

          // Diff newly added / removed promoters
          const nextIds: string[] = Array.isArray(body?.allowedPromoterIds)
            ? body.allowedPromoterIds
            : [];
          const newlyAdded = nextIds.filter((id: string) => !prevIds.includes(id));
          const removed = prevIds.filter((id: string) => !nextIds.includes(id));
          const isEnabled: boolean = body?.enabled !== false;

          // Create / update promoter_assignments and notifications (fire-and-forget)
          (async () => {
            try {
              const eventName: string = event.title ?? 'Untitled Event';
              const venueName: string = event.venueName ?? '';
              const commissionRate: number =
                body?.defaultCommission ?? event.promoterSettings?.commissionRate ?? 10;
              const now = new Date().toISOString();

              // Encrypt event data to be stored securely
              const encryptedEventName = encrypt(eventName);
              const encryptedVenueName = encrypt(venueName);

              // Create assignment docs for newly added promoters
              await Promise.all(
                newlyAdded.map(async (promoterId: string) => {
                  const trackingCode = await ensurePromoterLink(
                    fastify.db,
                    promoterId,
                    evtId,
                    eventName,
                    commissionRate,
                  );
                  const assignId = `${promoterId}_${evtId}`;
                  await fastify.db
                    .collection('promoter_assignments')
                    .doc(assignId)
                    .set(
                      {
                        id: assignId,
                        promoterId,
                        eventId: evtId,
                        eventName: encryptedEventName,
                        venueName: encryptedVenueName,
                        status: 'active',
                        commissionRate,
                        linkCode: trackingCode || null,
                        totalSales: 0,
                        totalRevenue: 0,
                        totalCommission: 0,
                        guestlistAllowance: 0,
                        guestlistUsed: 0,
                        guests: [],
                        assignedAt: now,
                        createdAt: now,
                        updatedAt: now,
                      },
                      { merge: true },
                    );
                }),
              );

              // Mark removed promoters as inactive
              await Promise.all(
                removed.map(async (promoterId: string) => {
                  const assignId = `${promoterId}_${evtId}`;
                  await fastify.db
                    .collection('promoter_assignments')
                    .doc(assignId)
                    .set({ status: 'inactive', updatedAt: now }, { merge: true });
                }),
              );

              // If all disabled, mark all as inactive
              if (!isEnabled && nextIds.length === 0 && prevIds.length > 0) {
                await Promise.all(
                  prevIds.map(async (promoterId: string) => {
                    const assignId = `${promoterId}_${evtId}`;
                    await fastify.db
                      .collection('promoter_assignments')
                      .doc(assignId)
                      .set({ status: 'inactive', updatedAt: now }, { merge: true });
                  }),
                );
              }

              // Send notifications to newly added promoters
              if (newlyAdded.length > 0) {
                // Encrypt notification title and message
                const rawTitle = "You've been added to an event!";
                const rawMessage = `${eventName} is live — start sharing your link`;
                const encryptedTitle = encrypt(rawTitle);
                const encryptedMessage = encrypt(rawMessage);

                await Promise.all([
                  ...newlyAdded.map((promoterId: string) =>
                    fastify.db.collection('notifications').add({
                      recipientId: promoterId,
                      recipientType: 'promoter',
                      type: 'promoter_assignment',
                      title: encryptedTitle,
                      message: encryptedMessage,
                      read: false,
                      createdAt: now,
                      data: {
                        eventId: evtId,
                        type: 'promoter_assignment',
                      },
                    }),
                  ),
                  sendPushToUsers(fastify.db, newlyAdded, rawTitle, rawMessage, {
                    eventId: evtId,
                    type: 'promoter_assignment',
                  }),
                ]);
              }
            } catch (err: any) {
              fastify.log.error(`[Promoter] Assignment sync error: ${err.message}`);
            }
          })();

          return reply.send({ success: true });
        }

        const orderActionVenueMatch = rest.match(/^orders\/([^/]+)\/(cancel|resend-receipt)$/);
        if (orderActionVenueMatch && request.method === 'POST') {
          const [, orderId, action] = orderActionVenueMatch;
          const ref = fastify.db.collection('orders').doc(orderId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Order not found',
                requestId: request.id,
              }),
            );
          const order = doc.data() as PlainRecord;
          if (order.venueId && order.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Order not accessible',
                requestId: request.id,
              }),
            );
          if (action === 'cancel') {
            await ref.update({
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancelledBy: ctx.uid,
            });
            await fastify
              .writeAuditLog({
                action: 'ORDER_CANCELLED',
                actorUid: ctx.uid,
                entityId: orderId,
                payload: { venueId: ctx.partnerId },
              })
              .catch(() => {});
          }
          return reply.send({ success: true });
        }

        if (rest === 'slots' && request.method === 'GET') {
          const hostId = String(query.hostId || '');
          let q: any = fastify.db
            .collection('availability_slots')
            .where('venueId', '==', ctx.partnerId);
          if (hostId) q = q.where('hostId', '==', hostId);
          if (query.status) q = q.where('status', '==', query.status);
          const snap = await q
            .limit(Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100))
            .get();
          const slotRequests = snap.docs
            .map((doc: any) => normalizeSlotRecord(doc))
            .sort(
              (left: any, right: any) =>
                new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
            );
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
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Slot request not found',
                requestId: request.id,
              }),
            );
          return reply.send({ slotRequest: normalizeSlotRecord(doc) });
        }
        if (slotMatch && request.method === 'PATCH') {
          const id = slotMatch[1];
          const action = String(body.action || '');
          const validActions = ['approve', 'reject', 'counter', 'suggest', 'suggest_changes'];
          if (!validActions.includes(action))
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: `action must be one of: ${validActions.join(', ')}`,
                requestId: request.id,
              }),
            );
          const ref = fastify.db.collection('availability_slots').doc(id);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Slot request not found',
                requestId: request.id,
              }),
            );
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
              const err: any = new Error('Slot request not found');
              err.statusCode = 404;
              throw err;
            }
            const liveSlot = normalizeSlotRecord(liveDoc);
            const currentStatus = String(liveSlot.status || '').toLowerCase();
            if (currentStatus === nextStatus)
              return {
                status: nextStatus,
                eventId: liveSlot.eventId,
                hostId: liveSlot.hostId,
                venueId: liveSlot.venueId,
                venueName: liveSlot.venueName,
                shouldNotify: false,
              };
            const mutableStatuses = new Set([
              'pending',
              'requested',
              'countered',
              'changes_requested',
            ]);
            if (!mutableStatuses.has(currentStatus)) {
              const err: any = new Error(`Slot request is already ${currentStatus}`);
              err.statusCode = 409;
              throw err;
            }
            if (action === 'approve') {
              const approvalDate = liveSlot.requestedDate || liveSlot.date || null;
              const approvalStart = liveSlot.requestedStartTime || liveSlot.startTime || null;
              const approvalEnd = liveSlot.requestedEndTime || liveSlot.endTime || null;
              const sameDaySnap = await transaction.get(
                fastify.db
                  .collection('availability_slots')
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
                const err: any = new Error('The selected venue time slot is unavailable');
                err.statusCode = 409;
                throw err;
              }
            }
            const updates: Record<string, any> = {
              status: nextStatus,
              updatedAt: now,
              respondedAt: now,
            };
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
                const eventUpdates: Record<string, any> = {
                  slotStatus: nextStatus,
                  slotRespondedAt: now,
                  updatedAt: now,
                };
                if (action === 'approve')
                  ((eventUpdates.lifecycle = 'scheduled'), (eventUpdates.approvedAt = now));
                else if (action === 'reject') eventUpdates.lifecycle = 'denied';
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
            // Slot approval moves event to 'scheduled' — stamp visibility and sync public index
            if (result.eventId) {
              await fastify.db
                .collection('events')
                .doc(result.eventId)
                .update({ visibility: 'public', updatedAt: now })
                .catch(() => {});
              fastify.publicDiscoveryService.syncEventReadModels(result.eventId).catch(() => {});
            }
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
              const blockDoc = await fastify.db
                .collection('availability_slots')
                .doc(String(body.slotId))
                .get();
              if (blockDoc.exists) docs = [blockDoc];
            } else {
              const snapshot = await fastify.db
                .collection('availability_slots')
                .where('venueId', '==', ctx.partnerId)
                .where('date', '==', body.date)
                .where('source', '==', 'venue_block')
                .get();
              docs = snapshot.docs.filter((doc: any) => {
                const data = doc.data() as Record<string, any>;
                if (body.startTime && data.startTime && data.startTime !== body.startTime)
                  return false;
                if (body.endTime && data.endTime && data.endTime !== body.endTime) return false;
                return true;
              });
            }
            docs.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
            return reply.send({ success: true, removedCount: docs.length });
          }
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'action must be block or unblock',
              requestId: request.id,
            }),
          );
        }

        if (rest === 'calendar' && request.method === 'DELETE') {
          const batch = fastify.db.batch();
          let docs: any[] = [];
          if (query.slotId) {
            const blockDoc = await fastify.db
              .collection('availability_slots')
              .doc(String(query.slotId))
              .get();
            if (blockDoc.exists) docs = [blockDoc];
          } else {
            const snapshot = await fastify.db
              .collection('availability_slots')
              .where('venueId', '==', ctx.partnerId)
              .where('date', '==', query.date)
              .where('source', '==', 'venue_block')
              .get();
            docs = snapshot.docs.filter((doc: any) => {
              const data = doc.data() as Record<string, any>;
              if (query.startTime && data.startTime && data.startTime !== query.startTime)
                return false;
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
          if (!invitationId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'invitationId required',
                requestId: request.id,
              }),
            );
          const ref = fastify.db.collection('venue_staff').doc(invitationId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Invitation not found',
                requestId: request.id,
              }),
            );
          await ref.update({
            status: 'active',
            verified: true,
            isActive: true,
            updatedAt: new Date().toISOString(),
          });
          return reply.send({ success: true });
        }

        if (rest === 'presence' && request.method === 'GET') {
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const [staffSnap, heartbeatsSnap] = await Promise.all([
            fastify.db
              .collection('venue_staff')
              .where('venueId', '==', ctx.partnerId)
              .where('isActive', '==', true)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('staff_heartbeats')
              .where('venueId', '==', ctx.partnerId)
              .where('lastSeenAt', '>=', fiveMinutesAgo)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          const onlineIds = new Set(((heartbeatsSnap as any).docs || []).map((d: any) => d.id));
          return reply.send({
            presence: ((staffSnap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
              isOnline: onlineIds.has(doc.id),
            })),
          });
        }

        if (rest === 'finance/cover-recon' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          const eventsSnap = await fastify.db
            .collection('events')
            .where('venueId', '==', ctx.partnerId)
            .limit(100)
            .get();
          const events = eventsSnap.docs
            .map((doc: any) => ({
              id: doc.id,
              title: doc.data().title || doc.data().name || 'Untitled Event',
              startDate: doc.data().startDate,
            }))
            .sort(
              (a: any, b: any) =>
                new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime(),
            );
          if (!eventId) return reply.send({ events, reconciliation: null });
          const reconDoc = await fastify.db
            .collection('cover_wallet_reconciliations')
            .doc(eventId)
            .get();
          if (!reconDoc.exists) return reply.send({ events, reconciliation: null });
          const raw = reconDoc.data() as any;
          const summary = raw.summary ?? raw;
          const grossCollection = Number(summary.openingBalancePaise ?? 0);
          const totalRedeemed = Number(
            summary.consumedBalancePaise ?? summary.totalDebitedPaise ?? 0,
          );
          const breakageRevenue = Number(
            summary.netVenueForfeitedValuePaise ?? summary.expiredBalancePaise ?? 0,
          );
          const walletsIssued = Number(summary.walletsIssued ?? 0);
          const ordersSnap = await fastify.db
            .collection('orders')
            .where('eventId', '==', eventId)
            .where('status', '==', 'confirmed')
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const ticketRevenuePaise = ((ordersSnap as any).docs || []).reduce(
            (sum: number, doc: any) => sum + Math.round((Number(doc.data().amount) || 0) * 100),
            0,
          );
          const payoutTotal = Math.round(ticketRevenuePaise * 0.7) + breakageRevenue;
          const isLive =
            eventsSnap.docs.find((doc: any) => doc.id === eventId)?.data()?.status === 'live';
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
          const gopsEventDoc = await fastify.db
            .collection('events')
            .doc(gopsEventId)
            .get()
            .catch(() => null);
          if (!gopsEventDoc || !gopsEventDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Event not found',
                requestId: request.id,
              }),
            );
          const gopsEventData = gopsEventDoc.data() as any;
          if (gopsEventData.venueId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Not your event',
                requestId: request.id,
              }),
            );

          if (gopsPath === 'summary' && request.method === 'GET') {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const [ordersSnap, checkinsSnap, walkInsSnap, devicesSnap] = await Promise.all([
              fastify.db
                .collection('orders')
                .where('eventId', '==', gopsEventId)
                .where('status', 'in', ['confirmed', 'paid'])
                .get()
                .catch(() => ({ docs: [] as any[] })),
              fastify.db
                .collection('check_ins')
                .where('eventId', '==', gopsEventId)
                .get()
                .catch(() => ({ docs: [] as any[], size: 0 })),
              fastify.db
                .collection('walk_in_entries')
                .doc(gopsEventId)
                .collection('logs')
                .limit(500)
                .get()
                .catch(() => ({ docs: [] as any[] })),
              fastify.db
                .collection('scanner_devices')
                .where('venueId', '==', ctx.partnerId)
                .where('eventId', '==', gopsEventId)
                .where('lastSeenAt', '>=', fiveMinAgo)
                .get()
                .catch(() => ({ size: 0 })),
            ]);
            const orderDocs = (ordersSnap as any).docs || [];
            const ticketedGuests = orderDocs.reduce(
              (s: number, d: any) => s + toNumber(d.data().ticketCount || 1),
              0,
            );
            const vipGuests = orderDocs.filter(
              (d: any) => d.data().isVip || d.data().guestType === 'vip',
            ).length;
            const compGuests = orderDocs.filter(
              (d: any) => d.data().isComp || d.data().guestType === 'comp',
            ).length;
            const tableGuests = orderDocs.filter(
              (d: any) => d.data().tableId || d.data().guestType === 'table',
            ).length;
            const guestListGuests = (walkInsSnap as any).docs?.length ?? 0;
            const checkedIn = (checkinsSnap as any).size || 0;
            const denied = orderDocs.filter((d: any) => d.data().deniedAt).length;
            const flagged = orderDocs.filter((d: any) => d.data().flaggedAt).length;
            const duplicateScans = orderDocs.filter((d: any) => d.data().duplicateScan).length;
            const onlineDevices = (devicesSnap as any).size || 0;
            const totalExpected = ticketedGuests + guestListGuests;
            const notArrived = Math.max(0, totalExpected - checkedIn);
            return reply.send({
              kpis: {
                totalExpected,
                ticketedGuests,
                guestListGuests,
                vipGuests,
                compGuests,
                tableGuests,
                checkedIn,
                notArrived,
                denied,
                flagged,
                duplicateScans,
                onlineDevices,
              },
            });
          }

          const mapGuestRecord = (doc: any) => {
            const d = doc.data() || {};
            const rawName = d.buyerName || d.name || 'Guest';
            const maskedName =
              rawName.length > 2
                ? rawName.slice(0, 2) + '*'.repeat(Math.max(2, rawName.length - 2))
                : rawName;
            const rawPhone = d.buyerPhone || d.phone || '';
            const maskedPhone =
              rawPhone.length >= 4 ? '****' + rawPhone.slice(-4) : rawPhone ? '****' : '';
            const guestType = d.isVip
              ? 'vip'
              : d.isComp
                ? 'comp'
                : d.tableId
                  ? 'table'
                  : d.guestListId
                    ? 'guestlist'
                    : 'ticket';
            const status = d.checkedInAt
              ? 'checked_in'
              : d.deniedAt
                ? 'denied'
                : d.flaggedAt
                  ? 'flagged'
                  : 'not_arrived';
            return {
              guestId: doc.id,
              displayName: maskedName,
              guestType,
              source: d.source || 'online',
              maskedPhone,
              addedByName: d.addedBy || d.staffName || null,
              ticketCount: d.ticketCount || 1,
              orderId: doc.id,
              status,
              checkedInAt: d.checkedInAt || null,
              tierId: d.tierId || null,
              tierName: d.tierName || null,
            };
          };

          if (gopsPath === 'guests' && request.method === 'GET') {
            const pageSize = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 200);
            const snap = await fastify.db
              .collection('orders')
              .where('eventId', '==', gopsEventId)
              .where('status', 'in', ['confirmed', 'checked_in'])
              .limit(pageSize + 1)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const docs = (snap as any).docs || [];
            return reply.send({
              guests: docs.slice(0, pageSize).map(mapGuestRecord),
              hasMore: docs.length > pageSize,
            });
          }

          if (gopsPath === 'guests/search' && request.method === 'GET') {
            const searchTerm = String(query.q || '')
              .toLowerCase()
              .trim();
            if (!searchTerm) return reply.send({ guests: [] });
            const snap = await fastify.db
              .collection('orders')
              .where('eventId', '==', gopsEventId)
              .where('status', 'in', ['confirmed', 'checked_in'])
              .limit(500)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const mapped = ((snap as any).docs || []).map(mapGuestRecord);
            const filtered = mapped.filter(
              (g: any) =>
                g.displayName.toLowerCase().replace(/\*/g, '').includes(searchTerm) ||
                g.maskedPhone.includes(searchTerm),
            );
            return reply.send({ guests: filtered.slice(0, 50) });
          }

          const guestActionMatch = gopsPath.match(
            /^guests\/([^/]+)\/(check-in|flag|deny|re-entry)$/,
          );
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
                  const checkInRef = fastify.db
                    .collection('check_ins')
                    .doc(`${gopsEventId}_${guestOrderId}`);
                  tx.set(checkInRef, {
                    eventId: gopsEventId,
                    orderId: guestOrderId,
                    checkedInAt: now,
                    checkedInBy: ctx.uid,
                  });
                } else if (guestAction === 'flag') {
                  tx.update(orderRef, {
                    flaggedAt: now,
                    flagReason: String(body.reason || 'Flagged by venue staff'),
                    flaggedBy: ctx.uid,
                  });
                } else if (guestAction === 'deny') {
                  tx.update(orderRef, {
                    deniedAt: now,
                    denyReason: String(body.reason || 'Denied by venue staff'),
                    deniedBy: ctx.uid,
                  });
                } else if (guestAction === 're-entry') {
                  tx.update(orderRef, { reEntryAt: now, reEntryBy: ctx.uid, checkedInAt: null });
                  const checkInRef = fastify.db
                    .collection('check_ins')
                    .doc(`${gopsEventId}_${guestOrderId}`);
                  tx.delete(checkInRef);
                }
              });
              return reply.send({ success: true });
            } catch (err: any) {
              if (err.statusCode) {
                return reply.status(err.statusCode).send(
                  buildErrorResponse({
                    code: err.statusCode === 409 ? 'CONFLICT' : 'NOT_FOUND',
                    message: err.message,
                    requestId: request.id,
                  }),
                );
              }
              throw err;
            }
          }

          if (gopsPath === 'exceptions' && request.method === 'GET') {
            const statusFilter = String(query.status || 'open');
            const snap = await fastify.db
              .collection('orders')
              .where('eventId', '==', gopsEventId)
              .limit(500)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const exceptions = ((snap as any).docs || [])
              .filter((doc: any) => {
                const d = doc.data() || {};
                if (!d.flaggedAt && !d.deniedAt) return false;
                if (statusFilter !== 'all') {
                  const resolved = !!d.resolvedAt;
                  if (statusFilter === 'open' && resolved) return false;
                  if (statusFilter === 'resolved' && !resolved) return false;
                }
                return true;
              })
              .map((doc: any) => {
                const d = doc.data() || {};
                const rawName = d.buyerName || d.name || 'Guest';
                const maskedName =
                  rawName.length > 2
                    ? rawName.slice(0, 2) + '*'.repeat(Math.max(2, rawName.length - 2))
                    : rawName;
                const status = d.resolvedAt ? 'resolved' : d.flaggedAt ? 'open' : 'open';
                const resolution = d.resolvedAt
                  ? {
                      action: d.resolveAction || 'dismissed',
                      resolvedByName: d.resolvedBy || null,
                      reason: d.resolveReason || '',
                      notes: d.resolveNotes || null,
                    }
                  : null;
                return {
                  exceptionId: doc.id,
                  type: d.flaggedAt ? 'flagged' : 'denied',
                  status,
                  guestDisplayName: maskedName,
                  triggeredAt: d.flaggedAt || d.deniedAt || null,
                  triggeredByName: d.flaggedBy || d.deniedBy || null,
                  context: {
                    reason: d.flagReason || d.denyReason || '',
                    ticketCount: d.ticketCount || 1,
                    tierId: d.tierId || null,
                  },
                  resolution,
                };
              });
            return reply.send({ exceptions });
          }

          const exceptionResolveMatch = gopsPath.match(/^exceptions\/([^/]+)\/resolve$/);
          if (exceptionResolveMatch && request.method === 'POST') {
            const exceptionOrderId = exceptionResolveMatch[1];
            const action = String(body.action || 'dismissed');
            const reason = String(body.reason || '');
            const notes = String(body.notes || '');
            const now = new Date().toISOString();
            const orderRef = fastify.db.collection('orders').doc(exceptionOrderId);
            const orderDoc = await orderRef.get().catch(() => null);
            if (!orderDoc || !orderDoc.exists) {
              return reply.status(404).send(
                buildErrorResponse({
                  code: 'NOT_FOUND',
                  message: 'Exception not found',
                  requestId: request.id,
                }),
              );
            }
            const patch: PlainRecord = {
              resolvedAt: now,
              resolvedBy: ctx.uid,
              resolveAction: action,
              resolveReason: reason,
            };
            if (notes) patch.resolveNotes = notes;
            if (action === 'admitted') patch.checkedInAt = now;
            if (action === 'permanently_banned') patch.bannedAt = now;
            await orderRef.update(patch);
            return reply.send({ success: true, exceptionId: exceptionOrderId, action });
          }

          if (gopsPath === 'scanner/devices' && request.method === 'GET') {
            const snap = await fastify.db
              .collection('scanner_devices')
              .where('venueId', '==', ctx.partnerId)
              .where('eventId', '==', gopsEventId)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            return reply.send({
              devices: ((snap as any).docs || []).map((doc: any) => ({
                id: doc.id,
                ...(doc.data() || {}),
              })),
            });
          }

          if (gopsPath === 'scanner/stream' && request.method === 'GET') {
            const limit = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100);
            const snap = await fastify.db
              .collection('ticket_scans')
              .where('eventId', '==', gopsEventId)
              .orderBy('scannedAt', 'desc')
              .limit(limit)
              .get()
              .catch(async () => {
                // fallback to check_ins
                return fastify.db
                  .collection('check_ins')
                  .where('eventId', '==', gopsEventId)
                  .orderBy('checkedInAt', 'desc')
                  .limit(limit)
                  .get()
                  .catch(() => ({ docs: [] as any[] }));
              });
            const scans = ((snap as any).docs || []).map((doc: any) => {
              const d = doc.data() || {};
              return {
                scanId: doc.id,
                result: d.result || (d.checkedInAt ? 'valid' : 'unknown'),
                guestDisplayName: d.guestDisplayName || d.buyerName || d.userName || 'Guest',
                ticketTierName: d.ticketTierName || d.tierName || null,
                deviceName: d.deviceName || d.deviceId || null,
                scannedAt: d.scannedAt || d.checkedInAt || null,
              };
            });
            return reply.send({ scans });
          }

          if (gopsPath === 'guest-rules' && request.method === 'GET') {
            const doc = await fastify.db
              .collection('event_guest_rules')
              .doc(gopsEventId)
              .get()
              .catch(() => null);
            const data =
              doc && doc.exists
                ? doc.data() || {}
                : { allowedGenderRatio: null, minAge: null, dressCode: null, notes: '' };
            return reply.send(data);
          }

          if (
            gopsPath === 'guest-rules' &&
            (request.method === 'POST' || request.method === 'PATCH')
          ) {
            await fastify.db
              .collection('event_guest_rules')
              .doc(gopsEventId)
              .set(
                {
                  ...body,
                  eventId: gopsEventId,
                  venueId: ctx.partnerId,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true },
              );
            return reply.send({ success: true });
          }

          if (gopsPath === 'host-allocations/all' && request.method === 'GET') {
            const snap = await fastify.db
              .collection('host_allocations')
              .where('eventId', '==', gopsEventId)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const allocs = ((snap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
            }));
            const hostAllocations = allocs.filter(
              (a: any) => a.type === 'host' || a.allocationType === 'host' || !a.promoterId,
            );
            const promoterAllocations = allocs.filter(
              (a: any) =>
                a.type === 'promoter' || a.allocationType === 'promoter' || !!a.promoterId,
            );
            return reply.send({ hostAllocations, promoterAllocations });
          }

          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Guest ops endpoint not found',
              requestId: request.id,
            }),
          );
        }

        // walk-ins
        if (rest === 'walk-ins' && request.method === 'GET') {
          const filterEventId = String(query.eventId || '');
          const pageSize = Math.min(parseInt(String(query.limit || '200'), 10) || 200, 500);
          // Walk-in entries are stored in door_sales (created via door/sell POST)
          let q: any = fastify.db.collection('door_sales').where('venueId', '==', ctx.partnerId);
          if (filterEventId) q = q.where('eventId', '==', filterEventId);
          const snap = await q
            .limit(pageSize)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const entries = ((snap as any).docs || [])
            .map((doc: any) => {
              const d = doc.data() || {};
              const purpose = String(d.purpose || 'party');
              if (purpose === 'dinein') return null;
              return {
                id: doc.id,
                guestName: d.guestName || '',
                phoneFull: d.contact || d.phone || '',
                phoneHash: d.contact || d.phone || '',
                gender: d.gender || null,
                guestAge: d.age ?? null,
                partySize: toNumber(d.partySize || 1),
                eventId: d.eventId || filterEventId || '',
                addedAt: d.soldAt || d.createdAt || d.addedAt || '',
                source: 'walkins',
              };
            })
            .filter(Boolean);
          entries.sort((a: any, b: any) => b.addedAt.localeCompare(a.addedAt));
          return reply.send({ entries: entries.slice(0, 100) });
        }

        const walkInEventMatch = rest.match(/^walk-ins\/([^/]+)$/);
        if (walkInEventMatch && request.method === 'GET') {
          const evtId = walkInEventMatch[1];
          const snap = await fastify.db
            .collection('walk_in_entries')
            .doc(evtId)
            .collection('logs')
            .limit(200)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const logs = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          logs.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ logs: logs.slice(0, 100) });
        }
        if (walkInEventMatch && request.method === 'POST') {
          const evtId = walkInEventMatch[1];
          const now = new Date().toISOString();
          const ref = await fastify.db
            .collection('walk_in_entries')
            .doc(evtId)
            .collection('logs')
            .add({
              ...body,
              eventId: evtId,
              venueId: ctx.partnerId,
              recordedBy: ctx.uid,
              createdAt: now,
            });
          return reply.send({ success: true, id: ref.id });
        }
        if (walkInEventMatch && request.method === 'DELETE') {
          const evtId = walkInEventMatch[1];
          const logId = String(query.logId || '');
          if (!logId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'logId required',
                requestId: request.id,
              }),
            );
          await fastify.db
            .collection('walk_in_entries')
            .doc(evtId)
            .collection('logs')
            .doc(logId)
            .delete();
          return reply.send({ success: true });
        }

        // door operations
        if (rest === 'door/capacity' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          if (!eventId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'eventId required',
                requestId: request.id,
              }),
            );
          const [eventDoc, checkinsSnap, ordersSnap, walkInsSnap] = await Promise.all([
            fastify.db.collection('events').doc(eventId).get(),
            fastify.db
              .collection('check_ins')
              .where('eventId', '==', eventId)
              .get()
              .catch(() => ({ size: 0 })),
            fastify.db
              .collection('orders')
              .where('eventId', '==', eventId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('walk_in_entries')
              .doc(eventId)
              .collection('logs')
              .get()
              .catch(() => ({ size: 0 })),
          ]);
          const total = toNumber((eventDoc.exists ? (eventDoc.data() as any).capacity : 0) || 0);
          const soldCount = ((ordersSnap as any).docs || []).reduce(
            (s: number, d: any) => s + toNumber(d.data().ticketCount),
            0,
          );
          const doorWalkInCount = (walkInsSnap as any).size || 0;
          const checkedIn = (checkinsSnap as any).size || 0;
          const available = total > 0 ? Math.max(0, total - soldCount - doorWalkInCount) : 0;
          const isSoldOut = total > 0 && available === 0;
          const capacityPercentage =
            total > 0 ? Math.round(((soldCount + doorWalkInCount) / total) * 100) : 0;
          const isNearCapacity = total > 0 && capacityPercentage >= 80 && !isSoldOut;
          const availabilityMessage = isSoldOut
            ? 'Sold out'
            : isNearCapacity
              ? `Near capacity — ${available} spot${available === 1 ? '' : 's'} remaining`
              : `${available} spot${available === 1 ? '' : 's'} available`;
          return reply.send({
            capacity: {
              total,
              soldCount,
              doorWalkInCount,
              available,
              isSoldOut,
              currentCount: checkedIn,
              capacityPercentage,
              availabilityMessage,
              isNearCapacity,
            },
          });
        }

        if (rest === 'door/dinein' && request.method === 'GET') {
          const pageSize = Math.min(toNumber(query.limit) || 50, 200);
          const filterEventId = String(query.eventId || '');
          let q: any = fastify.db
            .collection('dinein_sessions')
            .where('venueId', '==', ctx.partnerId)
            .where('status', '==', 'active');
          if (filterEventId && !filterEventId.startsWith('venue_'))
            q = q.where('eventId', '==', filterEventId);
          const snap = await q
            .limit(pageSize + 1)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const docs: any[] = ((snap as any).docs || []).slice(0, pageSize);
          const hasMore = ((snap as any).docs || []).length > pageSize;
          const entries = docs.map((doc: any) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              eventId: d.eventId || '',
              venueId: d.venueId || ctx.partnerId,
              guestName: d.guestName || '',
              partySize: toNumber(d.partySize) || 1,
              gender: d.gender || null,
              age: toNumber(d.age) || null,
              addedBy: d.createdBy || '',
              addedByName: d.addedByName || '',
              addedAt: d.createdAt || d.addedAt || '',
            };
          });
          const totals = {
            count: entries.length,
            partySize: entries.reduce((s: number, e: any) => s + (e.partySize || 1), 0),
          };
          return reply.send({
            entries,
            hasMore,
            nextCursor: hasMore ? docs[docs.length - 1]?.id || null : null,
            totals,
          });
        }
        if (rest === 'door/dinein' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('dinein_sessions').add({
            ...body,
            venueId: ctx.partnerId,
            status: 'active',
            createdAt: now,
            createdBy: ctx.uid,
          });
          return reply.send({ success: true, id: ref.id, entryId: ref.id });
        }

        if (rest === 'door/sell' && request.method === 'POST') {
          const now = new Date().toISOString();
          const purpose = String(body.purpose || 'party');
          const eventId = String(body.eventId || '');
          const ref = await fastify.db
            .collection('door_sales')
            .add({ ...body, venueId: ctx.partnerId, soldAt: now, soldBy: ctx.uid });
          // Compute remaining capacity after sale for real-time UI update
          let remainingCapacity: number | null = null;
          if (eventId) {
            const [eventDoc, ordersSnap, walkInsSnap] = await Promise.all([
              fastify.db
                .collection('events')
                .doc(eventId)
                .get()
                .catch(() => null),
              fastify.db
                .collection('orders')
                .where('eventId', '==', eventId)
                .where('status', 'in', ['confirmed', 'paid'])
                .get()
                .catch(() => ({ docs: [] as any[] })),
              fastify.db
                .collection('walk_in_entries')
                .doc(eventId)
                .collection('logs')
                .get()
                .catch(() => ({ size: 0 })),
            ]);
            const total = toNumber(eventDoc?.exists ? (eventDoc.data() as any)?.capacity : 0) || 0;
            if (total > 0) {
              const soldCount = ((ordersSnap as any).docs || []).reduce(
                (s: number, d: any) => s + toNumber(d.data().ticketCount),
                0,
              );
              const doorWalkInCount = (walkInsSnap as any).size || 0;
              remainingCapacity = Math.max(0, total - soldCount - doorWalkInCount);
            }
          }
          return reply.send({ success: true, entryId: ref.id, purpose, remainingCapacity });
        }

        // registers — keyed by venueId_date in venue_registers collection
        if (rest === 'registers' && request.method === 'GET') {
          const regNow = new Date().toISOString();
          const date = String(query.date || regNow.slice(0, 10));
          const docId = `${ctx.partnerId}_${date}`;
          const doc = await fastify.db
            .collection('venue_registers')
            .doc(docId)
            .get()
            .catch(() => null);
          if (doc && doc.exists)
            return reply.send({ register: { id: doc.id, ...(doc.data() || {}) } });
          const blank = {
            id: docId,
            venueId: ctx.partnerId,
            date,
            incidents: [],
            inspections: [],
            reminders: [],
            notes: {},
            createdAt: regNow,
            updatedAt: regNow,
          };
          await fastify.db
            .collection('venue_registers')
            .doc(docId)
            .set(blank)
            .catch(() => {});
          return reply.send({ register: blank });
        }
        if (rest === 'registers' && request.method === 'POST') {
          const regNow = new Date().toISOString();
          const date = String(body.date || regNow.slice(0, 10));
          const docId = `${ctx.partnerId}_${date}`;
          const docRef = fastify.db.collection('venue_registers').doc(docId);
          const docSnap = await docRef.get().catch(() => null);
          const existing = docSnap && docSnap.exists ? docSnap.data() || {} : {};
          if (body.action === 'logIncident') {
            const incidents = Array.isArray(existing.incidents) ? [...existing.incidents] : [];
            incidents.push({
              id: randomUUID(),
              ...body.data,
              loggedBy: body.user?.uid || ctx.uid,
              status: 'open',
              createdAt: regNow,
            });
            await docRef.set(
              { venueId: ctx.partnerId, date, incidents, updatedAt: regNow },
              { merge: true },
            );
          } else {
            await docRef.set(
              { venueId: ctx.partnerId, date, ...body.data, updatedAt: regNow },
              { merge: true },
            );
          }
          const updated = await docRef.get();
          return reply.send({ register: { id: docId, ...(updated.data() || {}) } });
        }
        if (rest === 'registers' && request.method === 'PATCH') {
          const regNow = new Date().toISOString();
          const date = String(body.date || regNow.slice(0, 10));
          const docId = `${ctx.partnerId}_${date}`;
          const docRef = fastify.db.collection('venue_registers').doc(docId);
          const docSnap = await docRef.get().catch(() => null);
          const existing = docSnap && docSnap.exists ? docSnap.data() || {} : {};
          if (body.action === 'resolveIncident') {
            const incidents = (Array.isArray(existing.incidents) ? existing.incidents : []).map(
              (inc: any) =>
                inc.id === body.data?.incidentId
                  ? {
                      ...inc,
                      status: 'resolved',
                      resolution: body.data?.resolution,
                      resolvedAt: regNow,
                    }
                  : inc,
            );
            await docRef.set({ incidents, updatedAt: regNow }, { merge: true });
          } else {
            await docRef.set({ ...body, updatedAt: regNow }, { merge: true });
          }
          const updated = await docRef.get();
          return reply.send({ register: { id: docId, ...(updated.data() || {}) } });
        }

        // tables — reads from venues/{venueId}/tables sub-collection (matches tables.ts)
        if (rest === 'tables' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          if (eventId) {
            const snap = await fastify.db
              .collection('table_assignments')
              .where('eventId', '==', eventId)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const docs = (snap as any).docs || [];
            const bookings = docs
              .filter((d: any) => d.data().status === 'reserved')
              .map((d: any) => ({ id: d.id, ...d.data() }));
            const blockedTables = docs
              .filter((d: any) => d.data().status === 'blocked')
              .map((d: any) => d.data().tableId);
            return reply.send({ bookings, blockedTables });
          }
          const snap = await fastify.db
            .collection('venues')
            .doc(ctx.partnerId)
            .collection('tables')
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const tables = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          return reply.send(tables);
        }
        if (rest === 'tables' && request.method === 'POST') {
          const tblNow = new Date().toISOString();
          if (body.action === 'updateStatus') {
            const { eventId: evtId, tableId, status, notes } = body;
            if (!evtId || !tableId)
              return reply.status(400).send(
                buildErrorResponse({
                  code: 'BAD_REQUEST',
                  message: 'eventId and tableId required',
                  requestId: request.id,
                }),
              );
            const assignSnap = await fastify.db
              .collection('table_assignments')
              .where('eventId', '==', evtId)
              .where('tableId', '==', tableId)
              .limit(1)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const existing = ((assignSnap as any).docs || [])[0];
            if (existing) {
              await fastify.db
                .collection('table_assignments')
                .doc(existing.id)
                .update({ status, notes: notes || '', updatedAt: tblNow });
            } else {
              await fastify.db.collection('table_assignments').add({
                eventId: evtId,
                tableId,
                venueId: ctx.partnerId,
                status,
                notes: notes || '',
                createdAt: tblNow,
                updatedAt: tblNow,
              });
            }
            return reply.send({ success: true });
          }
          const { venueId: _vid, table } = body;
          if (!table)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'table object required',
                requestId: request.id,
              }),
            );
          const tableData = { ...table, venueId: ctx.partnerId, updatedAt: tblNow };
          if (table.id) {
            await fastify.db
              .collection('venues')
              .doc(ctx.partnerId)
              .collection('tables')
              .doc(table.id)
              .set(tableData, { merge: true });
          } else {
            const ref = await fastify.db
              .collection('venues')
              .doc(ctx.partnerId)
              .collection('tables')
              .add({ ...tableData, createdAt: tblNow });
            tableData.id = ref.id;
          }
          return reply.send({ success: true, table: tableData });
        }
        if (rest === 'tables' && request.method === 'DELETE') {
          const tableId = String(query.tableId || '');
          if (!tableId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'tableId required',
                requestId: request.id,
              }),
            );
          await fastify.db
            .collection('venues')
            .doc(ctx.partnerId)
            .collection('tables')
            .doc(tableId)
            .delete();
          return reply.send({ success: true });
        }

        // reservations
        if (rest === 'reservations' && request.method === 'GET') {
          const eventId = String(query.eventId || '');
          let q: any = fastify.db.collection('reservations').where('venueId', '==', ctx.partnerId);
          if (eventId) q = q.where('eventId', '==', eventId);
          const snap = await q
            .limit(100)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const reservations = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          reservations.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ reservations });
        }

        const reservationMatch = rest.match(/^reservations\/([^/]+)$/);
        if (reservationMatch && request.method === 'GET') {
          const doc = await fastify.db.collection('reservations').doc(reservationMatch[1]).get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Reservation not found',
                requestId: request.id,
              }),
            );
          return reply.send({ reservation: { id: doc.id, ...(doc.data() || {}) } });
        }
        if (reservationMatch && request.method === 'PATCH') {
          await fastify.db
            .collection('reservations')
            .doc(reservationMatch[1])
            .update({ ...body, updatedAt: new Date().toISOString(), updatedBy: ctx.uid });
          return reply.send({ success: true });
        }

        // security/sync
        if (rest === 'security/sync' && (request.method === 'GET' || request.method === 'POST')) {
          const eventId = String(query.eventId || body.eventId || '');
          if (!eventId) {
            // Return list of upcoming events with their sync codes
            const today = new Date().toISOString().slice(0, 10);
            const eventsSnap = await fastify.db
              .collection('events')
              .where('venueId', '==', ctx.partnerId)
              .where('startDate', '>=', today)
              .limit(20)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            const rawEventDocs = (eventsSnap as any).docs || [];
            const checkinsCountSnap = await Promise.all(
              rawEventDocs.slice(0, 10).map((doc: any) =>
                fastify.db
                  .collection('check_ins')
                  .where('eventId', '==', doc.id)
                  .count()
                  .get()
                  .catch(() => ({ data: () => ({ count: 0 }) })),
              ),
            );
            const events = rawEventDocs.map((doc: any, idx: number) => {
              const d = doc.data() || {};
              const lifecycle = String(d.lifecycle || d.status || 'upcoming').toLowerCase();
              const status: 'active' | 'standby' | 'completed' = [
                'live',
                'active',
                'ongoing',
              ].includes(lifecycle)
                ? 'active'
                : ['completed', 'ended', 'closed'].includes(lifecycle)
                  ? 'completed'
                  : 'standby';
              return {
                id: doc.id,
                eventId: doc.id,
                title: d.title || d.name || 'Event',
                date: d.startDate || null,
                startDate: d.startDate || null,
                totalTickets: toNumber(d.ticketsSold || d.capacity || 0),
                checkedIn: checkinsCountSnap[idx]
                  ? (checkinsCountSnap[idx] as any).data().count
                  : 0,
                syncCode: doc.id.slice(0, 8).toUpperCase(),
                status,
              };
            });
            return reply.send({ events });
          }
          const snap = await fastify.db
            .collection('check_ins')
            .where('eventId', '==', eventId)
            .orderBy('checkedInAt', 'desc')
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const entries = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          return reply.send({
            synced: entries.length,
            entries,
            syncCode: eventId.slice(0, 8).toUpperCase(),
          });
        }

        // marketing/campaigns
        if (rest === 'marketing/campaigns' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('marketing_campaigns')
            .where('venueId', '==', ctx.partnerId)
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const campaigns = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          campaigns.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ campaigns });
        }
        if (rest === 'marketing/campaigns' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('marketing_campaigns').add({
            ...body,
            venueId: ctx.partnerId,
            status: 'draft',
            createdAt: now,
            createdBy: ctx.uid,
          });
          return reply.send({ success: true, id: ref.id });
        }

        // analytics/overview — real aggregation
        if (rest === 'analytics/overview' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [eventsSnap, ordersSnap, checkinsSnap] = await Promise.all([
            fastify.db
              .collection('events')
              .where('venueId', '==', ctx.partnerId)
              .get()
              .catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db
              .collection('orders')
              .where('venueId', '==', ctx.partnerId)
              .where('status', 'in', ['confirmed', 'paid'])
              .where('createdAt', '>=', thirtyDaysAgo)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('check_ins')
              .where('venueId', '==', ctx.partnerId)
              .where('checkedInAt', '>=', thirtyDaysAgo)
              .get()
              .catch(() => ({ size: 0 })),
          ]);
          const orderDocs = (ordersSnap as any).docs || [];
          const totalRevenuePaise = orderDocs.reduce(
            (sum: number, doc: any) =>
              sum + (doc.data().totalPaise || Math.round((doc.data().amount || 0) * 100)),
            0,
          );
          const totalTickets = orderDocs.reduce(
            (sum: number, doc: any) => sum + (doc.data().ticketCount || 0),
            0,
          );
          const totalCheckIns = (checkinsSnap as any).size || 0;
          const eventCount = (eventsSnap as any).size || 0;
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
        }

        // analytics/audience — guest demographic aggregation
        if (rest === 'analytics/audience' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const ordersSnap = await fastify.db
            .collection('orders')
            .where('venueId', '==', ctx.partnerId)
            .where('status', 'in', ['confirmed', 'paid'])
            .where('createdAt', '>=', thirtyDaysAgo)
            .limit(2000)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const orderDocs2 = (ordersSnap as any).docs || [];
          const genderSplit: Record<string, number> = { male: 0, female: 0, other: 0 };
          const ageBuckets: Record<string, number> = {
            '18-22': 0,
            '23-27': 0,
            '28-34': 0,
            '35-44': 0,
            '45+': 0,
          };
          const cityMap: Record<string, number> = {};
          const buyerIds = new Set<string>();
          let totalAge = 0,
            ageCount = 0;
          for (const doc of orderDocs2) {
            const d = doc.data() || {};
            const g = String(d.buyerGender || d.gender || '').toLowerCase();
            if (g === 'male') genderSplit.male++;
            else if (g === 'female') genderSplit.female++;
            else genderSplit.other++;
            const age = toNumber(d.buyerAge || d.age || 0);
            if (age >= 18) {
              totalAge += age;
              ageCount++;
              if (age <= 22) ageBuckets['18-22']++;
              else if (age <= 27) ageBuckets['23-27']++;
              else if (age <= 34) ageBuckets['28-34']++;
              else if (age <= 44) ageBuckets['35-44']++;
              else ageBuckets['45+']++;
            }
            const city = String(d.buyerCity || d.city || '').trim();
            if (city) cityMap[city] = (cityMap[city] || 0) + 1;
            if (d.userId) buyerIds.add(d.userId);
          }
          const repeatIds = new Set<string>();
          const idArr = Array.from(buyerIds);
          if (idArr.length > 0) {
            const allOrdersSnap = await fastify.db
              .collection('orders')
              .where('venueId', '==', ctx.partnerId)
              .where('status', 'in', ['confirmed', 'paid'])
              .where('createdAt', '<', thirtyDaysAgo)
              .limit(2000)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            for (const d of (allOrdersSnap as any).docs || []) {
              const uid = d.data().userId;
              if (uid && buyerIds.has(uid)) repeatIds.add(uid);
            }
          }
          const topCities = Object.entries(cityMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([city, count]) => ({ city, count }));
          const ageBands = Object.entries(ageBuckets).map(([band, count]) => ({ band, count }));
          return reply.send({
            totalGuests: buyerIds.size,
            repeatGuestPct:
              buyerIds.size > 0 ? Math.round((repeatIds.size / buyerIds.size) * 100) : 0,
            avgAge: ageCount > 0 ? Math.round(totalAge / ageCount) : null,
            topCities,
            genderSplit,
            ageBands,
            repeatVsNew: { new: buyerIds.size - repeatIds.size, repeat: repeatIds.size },
          });
        }

        // analytics/partners (hosts tab) — host + promoter attribution
        if (rest === 'analytics/partners' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [ordersSnap, eventsSnap] = await Promise.all([
            fastify.db
              .collection('orders')
              .where('venueId', '==', ctx.partnerId)
              .where('status', 'in', ['confirmed', 'paid'])
              .where('createdAt', '>=', thirtyDaysAgo)
              .limit(2000)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('events')
              .where('venueId', '==', ctx.partnerId)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          const eventMap3: Record<string, any> = {};
          for (const d of (eventsSnap as any).docs || []) eventMap3[d.id] = d.data();
          const hostMap: Record<
            string,
            {
              hostId: string;
              hostName: string;
              events: Set<string>;
              tickets: number;
              revenue: number;
            }
          > = {};
          const promoterMap: Record<
            string,
            {
              promoterId: string;
              promoterName: string;
              sales: number;
              revenue: number;
              clicks: number;
            }
          > = {};
          for (const doc of (ordersSnap as any).docs || []) {
            const d = doc.data() || {};
            const ev = eventMap3[d.eventId || ''] || {};
            const hostId = String(d.hostId || ev.creatorId || '');
            if (hostId) {
              if (!hostMap[hostId])
                hostMap[hostId] = {
                  hostId,
                  hostName: d.hostName || ev.hostName || 'Unknown Host',
                  events: new Set(),
                  tickets: 0,
                  revenue: 0,
                };
              hostMap[hostId].events.add(d.eventId || '');
              hostMap[hostId].tickets += toNumber(d.ticketCount || 1);
              hostMap[hostId].revenue += toNumber(
                d.amount || d.totalPaise ? d.totalPaise / 100 : 0,
              );
            }
            const promoterId = String(d.promoterId || '');
            if (promoterId) {
              if (!promoterMap[promoterId])
                promoterMap[promoterId] = {
                  promoterId,
                  promoterName: d.promoterName || 'Unknown Promoter',
                  sales: 0,
                  revenue: 0,
                  clicks: 0,
                };
              promoterMap[promoterId].sales += toNumber(d.ticketCount || 1);
              promoterMap[promoterId].revenue += toNumber(d.amount || 0);
            }
          }
          return reply.send({
            hosts: Object.values(hostMap)
              .map((h) => ({ ...h, events: h.events.size }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 20),
            promoters: Object.values(promoterMap)
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 20),
          });
        }

        // analytics/ops — operational metrics
        if (rest === 'analytics/ops' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [scansSnap, ordersSnap, eventsSnap, walkinsSnap] = await Promise.all([
            fastify.db
              .collection('ticket_scans')
              .where('venueId', '==', ctx.partnerId)
              .where('scannedAt', '>=', thirtyDaysAgo)
              .limit(5000)
              .get()
              .catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db
              .collection('orders')
              .where('venueId', '==', ctx.partnerId)
              .where('status', 'in', ['confirmed', 'paid'])
              .where('createdAt', '>=', thirtyDaysAgo)
              .limit(2000)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('events')
              .where('venueId', '==', ctx.partnerId)
              .limit(100)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('door_sales')
              .where('venueId', '==', ctx.partnerId)
              .where('createdAt', '>=', thirtyDaysAgo)
              .limit(1000)
              .get()
              .catch(() => ({ docs: [] as any[], size: 0 })),
          ]);
          const totalScans = (scansSnap as any).size || 0;
          const hourCounts: Record<number, number> = {};
          for (const doc of (scansSnap as any).docs || []) {
            const d = doc.data() || {};
            const h = new Date(d.scannedAt || 0).getHours();
            hourCounts[h] = (hourCounts[h] || 0) + 1;
          }
          const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
          const peakHour = peakHourEntry ? `${peakHourEntry[0]}:00` : null;
          const scanVelocity = Array.from({ length: 24 }, (_, h) => ({
            hour: `${h}:00`,
            scans: hourCounts[h] || 0,
          }));
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayFills: Record<number, number[]> = {};
          for (const doc of (eventsSnap as any).docs || []) {
            const d = doc.data() || {};
            const dow = new Date(d.startDate || 0).getDay();
            const capacity = toNumber(d.capacity || 0);
            const sold = toNumber(d.ticketsSold || 0);
            if (capacity > 0) {
              if (!dayFills[dow]) dayFills[dow] = [];
              dayFills[dow].push((sold / capacity) * 100);
            }
          }
          const dayOfWeekBreakdown = dayNames.map((day, i) => ({
            day,
            avgFill: dayFills[i]
              ? Math.round(dayFills[i].reduce((a, b) => a + b, 0) / dayFills[i].length)
              : 0,
          }));
          const onlineOrders = (ordersSnap as any).docs?.length || 0;
          const walkInCount = (walkinsSnap as any).size || 0;
          return reply.send({
            avgFillRate: dayFills[0]
              ? Math.round(
                  Object.values(dayFills)
                    .flat()
                    .reduce((a, b) => a + b, 0) / Object.values(dayFills).flat().length,
                )
              : 0,
            totalScans,
            peakHour,
            capacityUtilisation: 0,
            dayOfWeekBreakdown,
            scanVelocity,
            capacityTimeline: [],
            channelSplit: { online: onlineOrders, walkIn: walkInCount },
          });
        }

        // analytics/strategy — placeholder recommendations
        if (rest === 'analytics/strategy' && request.method === 'GET') {
          return reply.send({ recommendations: [] });
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
            fastify.db
              .collection('payouts')
              .where('recipientId', '==', ctx.partnerId)
              .where('recipientType', '==', 'venue')
              .limit(10)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('bank_accounts')
              .where('ownerId', '==', ctx.partnerId)
              .where('ownerType', '==', 'venue')
              .limit(1)
              .get()
              .catch(() => ({ empty: true, docs: [] as any[] })),
          ]);
          const recentPayouts = ((payoutsSnap as any).docs || [])
            .slice(0, 5)
            .map((d: any) => ({ id: d.id, ...d.data() }));
          const settledPayouts = recentPayouts
            .filter((row: any) =>
              ['completed', 'paid', 'cleared', 'settled'].includes(
                String(row.status || '').toLowerCase(),
              ),
            )
            .reduce(
              (sum: number, row: any) => sum + toNumber(row.amount || row.amountPaise || 0),
              0,
            );
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
            fastify.db
              .collection('payouts')
              .where('recipientId', '==', ctx.partnerId)
              .where('recipientType', '==', 'venue')
              .limit(50)
              .get()
              .catch(() => ({ docs: [] as any[] })),
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
          history.sort(
            (left: any, right: any) =>
              new Date(right.requestedAt || 0).getTime() -
              new Date(left.requestedAt || 0).getTime(),
          );
          return reply.send({
            balance: {
              withdrawablePaise: Math.round(toNumber(balances.available) * 100),
              pendingSettlementPaise: Math.round(toNumber(balances.pending) * 100),
            },
            history,
          });
        }

        if (financeLedgerMatch && request.method === 'GET') {
          const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
          let q: any = fastify.db
            .collection('partner_ledger')
            .where('partnerId', '==', ctx.partnerId);
          if (query.category) q = q.where('category', '==', query.category);
          if (query.status) q = q.where('status', '==', query.status);
          const snap = await q
            .limit(200)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          let entries = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          if (query.q) {
            const term = String(query.q).toLowerCase();
            entries = entries.filter((e: any) =>
              String(e.description || e.label || e.eventName || '')
                .toLowerCase()
                .includes(term),
            );
          }
          entries.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          const page = parseInt(String(query.p || '1'), 10) || 1;
          const start = (page - 1) * pageSize;
          return reply.send({
            transactions: entries.slice(start, start + pageSize),
            pagination: {
              total: entries.length,
              page,
              limit: pageSize,
              hasMore: entries.length > start + pageSize,
            },
          });
        }

        if (financePaymentsMatch && request.method === 'GET') {
          const [balances, subDoc, bankSnap] = await Promise.all([
            financeService.getBalances(ctx),
            fastify.db
              .collection('venue_subscriptions')
              .doc(ctx.partnerId)
              .get()
              .catch(() => null),
            fastify.db
              .collection('bank_accounts')
              .where('ownerId', '==', ctx.partnerId)
              .where('ownerType', '==', 'venue')
              .limit(10)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          const subData = subDoc && subDoc.exists ? subDoc.data() || {} : null;
          const billingMethods = ((bankSnap as any).docs || []).map((doc: any) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              type: d.type || 'bank_transfer',
              label: d.bankName || 'Bank Account',
              isDefault: !!d.isDefault,
              addedAt: d.createdAt || '',
              maskedDetail: d.last4 ? `****${d.last4}` : d.accountNumber || '',
            };
          });
          return reply.send({
            wallet: {
              availablePaise: Math.round(toNumber(balances.available) * 100),
              pendingPaise: Math.round(toNumber(balances.pending) * 100),
              heldPaise: 0,
              currency: 'INR',
            },
            subscription: subData
              ? {
                  id: ctx.partnerId,
                  plan: subData.plan || 'basic',
                  status: subData.status || 'active',
                  currentPeriodStart: subData.currentPeriodStart || '',
                  currentPeriodEnd: subData.currentPeriodEnd || '',
                  amountPaise: toNumber(subData.amountPaise || 0),
                  autopayEnabled: !!subData.autopayEnabled,
                  nextBillingDate: subData.nextBillingDate || null,
                }
              : null,
            billingMethods,
            recentInvoices: [],
          });
        }

        if (financePayoutsMatch && request.method === 'GET') {
          const snap = await fastify.db
            .collection('payouts')
            .where('recipientId', '==', ctx.partnerId)
            .where('recipientType', '==', 'venue')
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const payouts = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          payouts.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
          );
          return reply.send({ payouts });
        }

        if (financeBankMatch && request.method === 'GET') {
          const snap = await fastify.db
            .collection('bank_accounts')
            .where('ownerId', '==', ctx.partnerId)
            .where('ownerType', '==', 'venue')
            .get()
            .catch(() => ({ docs: [] as any[] }));
          return reply.send({
            accounts: ((snap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
              accountNumber: undefined,
            })),
          });
        }
        if (financeBankMatch && request.method === 'POST') {
          const account = buildPayoutAccountRecord(body, {
            partnerId: ctx.partnerId,
            ownerType: 'venue',
          });
          const ref = await fastify.db.collection('bank_accounts').add(account.record);
          return reply.send({
            success: true,
            id: ref.id,
            account: account.response(ref.id).account,
          });
        }
        if (financeBankMatch && request.method === 'DELETE') {
          const accountId = String(query.accountId || '');
          if (!accountId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'accountId required',
                requestId: request.id,
              }),
            );
          await fastify.db
            .collection('bank_accounts')
            .doc(accountId)
            .update({ isActive: false, removedAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        if (financeDisputesMatch && request.method === 'GET') {
          const snap = await fastify.db
            .collection('payment_disputes')
            .where('venueId', '==', ctx.partnerId)
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          return reply.send({
            disputes: ((snap as any).docs || []).map((doc: any) => ({
              id: doc.id,
              ...(doc.data() || {}),
            })),
          });
        }

        if (rest === 'finance/host-payouts' && request.method === 'GET') {
          const eventIdFilter = String(query.eventId || '');
          let q: any = fastify.db
            .collection('payouts')
            .where('venueId', '==', ctx.partnerId)
            .where('recipientType', '==', 'host');
          if (eventIdFilter) q = q.where('eventId', '==', eventIdFilter);
          const snap = await q
            .limit(100)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const rows = ((snap as any).docs || []).map((doc: any) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              partnerId: d.recipientId || '',
              partnerName: d.recipientName || d.hostName || '—',
              partnerType: 'host',
              eventId: d.eventId || '',
              eventName: d.eventName || '—',
              eventDate: d.eventDate || d.createdAt || '',
              grossPaise: toNumber(d.grossPaise || Math.round(toNumber(d.amount) * 100)),
              feePaise: toNumber(d.feePaise || 0),
              netPaise: toNumber(d.netPaise || Math.round(toNumber(d.amount) * 100)),
              status: String(d.status || 'pending'),
              settledAt: d.settledAt || null,
              holdReason: d.holdReason || null,
            };
          });
          const pendingSettlements = rows.filter((r: any) =>
            ['pending', 'processing', 'held'].includes(r.status),
          );
          const historySettlements = rows.filter(
            (r: any) => !['pending', 'processing', 'held'].includes(r.status),
          );
          const totalOwedPaise = pendingSettlements.reduce(
            (s: number, r: any) => s + r.netPaise,
            0,
          );
          const totalHeldPaise = rows
            .filter((r: any) => r.status === 'held')
            .reduce((s: number, r: any) => s + r.netPaise, 0);
          return reply.send({
            pendingSettlements,
            historySettlements,
            totalOwedPaise,
            totalHeldPaise,
            hasMore: false,
            nextCursor: null,
          });
        }

        if (rest === 'finance/promoter-payouts' && request.method === 'GET') {
          const eventIdFilter = String(query.eventId || '');
          let q: any = fastify.db
            .collection('payouts')
            .where('venueId', '==', ctx.partnerId)
            .where('recipientType', '==', 'promoter');
          if (eventIdFilter) q = q.where('eventId', '==', eventIdFilter);
          const snap = await q
            .limit(100)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const rows = ((snap as any).docs || []).map((doc: any) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              partnerId: d.recipientId || '',
              partnerName: d.recipientName || d.promoterName || '—',
              partnerType: 'promoter',
              eventId: d.eventId || '',
              eventName: d.eventName || '—',
              eventDate: d.eventDate || d.createdAt || '',
              grossPaise: toNumber(d.grossPaise || Math.round(toNumber(d.amount) * 100)),
              feePaise: toNumber(d.feePaise || 0),
              netPaise: toNumber(d.netPaise || Math.round(toNumber(d.amount) * 100)),
              status: String(d.status || 'pending'),
              settledAt: d.settledAt || null,
              holdReason: d.holdReason || null,
            };
          });
          const pendingSettlements = rows.filter((r: any) =>
            ['pending', 'processing', 'held'].includes(r.status),
          );
          const historySettlements = rows.filter(
            (r: any) => !['pending', 'processing', 'held'].includes(r.status),
          );
          const totalOwedPaise = pendingSettlements.reduce(
            (s: number, r: any) => s + r.netPaise,
            0,
          );
          const totalHeldPaise = rows
            .filter((r: any) => r.status === 'held')
            .reduce((s: number, r: any) => s + r.netPaise, 0);
          return reply.send({
            pendingSettlements,
            historySettlements,
            totalOwedPaise,
            totalHeldPaise,
            hasMore: false,
            nextCursor: null,
          });
        }

        if (rest.startsWith('partners/') && request.method === 'GET') {
          const partnerId = rest.slice('partners/'.length);
          const profile = await getPartnerProfileSummary(fastify.db, partnerId);
          if (!profile) {
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Partner profile not found',
                requestId: request.id,
              }),
            );
          }
          const connection = await getConnectionForViewer(fastify.db, {
            viewerRole: ctx.type,
            viewerId: ctx.partnerId,
            partnerId,
            partnerType: profile.type,
          });
          return reply.send({ profile, connection });
        }

        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner venue endpoint not found',
            requestId: request.id,
          }),
        );
      } catch (err: any) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send(
            buildErrorResponse({
              code: err.code || 'FORBIDDEN',
              message: err.message,
              requestId: request.id,
            }),
          );
        }
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  });
}

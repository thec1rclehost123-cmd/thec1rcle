import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { resolvePartnerContext } from '../../lib/partner-context.js';
import { encrypt } from '../../lib/encryption.js';
import { applyPublicCacheHeaders, buildVersionedPublicCacheKey } from '../../utils/public-cache';
import { enforcePublicRateLimit } from '../../utils/public-rate-limit';
import {
  getEventQueueStatus,
  getEventSurgeStatus,
  getEventWaitlistStatus,
  joinEventQueue,
  joinEventWaitlist,
  toggleEventRsvp,
  trackGuestEventInteraction,
  trackGuestEventView,
  verifyEventWaitlistAccess,
} from '@c1rcle/core/guest-event-conversion';
// @ts-ignore - JS module with runtime exports
import { getEventAttendees } from '@c1rcle/core/guest-chat-service';
// @ts-ignore - JS module with runtime exports
import { buildEvent } from '@c1rcle/core/event-engine';
// @ts-ignore - JS module with runtime exports
import { listEventMapPins, normalizeCityKey } from '@c1rcle/core/guest-discovery-engine';
// @ts-ignore - JS module with runtime exports
import {
  InventoryReadError,
  InventoryUnavailableError,
  listAvailableTicketTiers,
} from '@c1rcle/core/inventory-engine';

const ExploreEventListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(500).optional(),
    lastId: z.string().min(1).max(500).optional(),
    sort: z.string().trim().max(64).optional(),
    city: z.string().trim().max(120).optional(),
    cityKey: z.string().trim().max(120).optional(),
    category: z.string().trim().max(80).optional(),
    type: z.string().trim().max(80).optional(),
    eventType: z.string().trim().max(80).optional(),
    curatedCategory: z.string().trim().max(80).optional(),
    date: z.string().trim().max(40).optional(),
    datePreset: z.string().trim().max(40).optional(),
    dayKey: z.string().trim().max(20).optional(),
    startDate: z.string().trim().max(40).optional(),
    endDate: z.string().trim().max(40).optional(),
    search: z.string().trim().max(120).optional(),
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
    statusKey: z.string().trim().max(40).optional(),
    area: z.string().trim().max(120).optional(),
    areaKey: z.string().trim().max(120).optional(),
    priceType: z.enum(['free', 'paid']).optional(),
    host: z.string().trim().max(120).optional(),
    hostId: z.string().trim().max(120).optional(),
    hostSlug: z.string().trim().max(120).optional(),
    venue: z.string().trim().max(120).optional(),
    venueId: z.string().trim().max(120).optional(),
    venueSlug: z.string().trim().max(120).optional(),
    lifecycle: z.string().trim().max(120).optional(),
    creatorId: z.string().trim().max(120).optional(),
  })
  .strict();

const ExploreFeaturedEventListQuery = ExploreEventListQuery.extend({
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

const EventMapQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().positive().max(50).optional().default(15),
    limit: z.coerce.number().int().min(1).max(500).optional().default(500),
  })
  .strict();

const EXPLORE_EVENTS_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_FEATURED_EVENTS_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_MAP_EVENTS_CACHE_SCHEMA_VERSION = 1;

const EventNearbyQuery = z
  .object({
    lat: z.string(),
    lng: z.string(),
    radius: z.string().optional(),
    limit: z.string().optional(),
  })
  .strict();

const EventParamId = z
  .object({
    id: z.string(),
  })
  .strict();

const EventCreateBody = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    venue: z.string().optional(),
    venueId: z.string().optional(),
    image: z.string().optional(),
    poster: z.string().optional(),
    status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
    lifecycle: z.enum(['active', 'archived', 'deleted']).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).max(10).optional(),
    isPrivate: z.boolean().optional(),
    capacity: z.number().int().positive().optional(),
    creatorId: z.string().optional(),
  })
  .strict();

const EventUpdateBody = EventCreateBody.partial();

// Wizard auto-save sends { actor, updates } — accept both flat and wrapped forms.
const PartnerEventUpdateBody = z.union([
  z.object({
    actor: z.unknown(),
    updates: z.record(z.string(), z.unknown()),
    action: z.string().optional(),
  }),
  z.record(z.string(), z.unknown()),
]);

// Partner wizard sends a rich payload — validate only the required fields
// and use .passthrough() so extra fields (tickets, tables, promoterSettings, etc.)
// flow through to buildEvent() without being stripped.
const PartnerEventCreateBody = z
  .object({
    title: z.string().min(1).max(200),
    creatorRole: z.enum(['host', 'venue', 'club']),
    creatorId: z.string().optional(),
    hostId: z.string().optional(),
    venueId: z.string().optional(),
    lifecycle: z
      .enum([
        'draft',
        'submitted',
        'scheduled',
        'live',
        'completed',
        'cancelled',
        'paused',
        'denied',
        'changes_requested',
      ])
      .optional(),
  })
  .passthrough();
const EventTrackBody = z
  .object({
    type: z.enum(['view', 'click', 'share', 'rsvp_intent']),
    ref: z.string().max(100).optional(),
  })
  .strict();
const EventRsvpBody = z
  .object({
    shouldInclude: z.boolean(),
  })
  .strict();
const EventQueueQuery = z
  .object({
    queueId: z.string().optional(),
  })
  .strict();
const EventQueueBody = z.object({}).strict();
const EventWaitlistBody = z
  .object({
    ticketId: z.string().min(1).max(120).optional(),
    tierId: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).nullable().optional(),
  })
  .strict();
const EventAttendeesQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  })
  .strict();

function sortObjectKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: any = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
  return sorted;
}

function normalizeExploreEventsQuery(rawQuery: Record<string, any> = {}) {
  const query = { ...(rawQuery || {}) };
  const normalizedCityKey = normalizeCityKey(query.cityKey || query.city || null);

  if (normalizedCityKey) {
    query.cityKey = normalizedCityKey;
    delete query.city;
  }

  if (query.category && !query.eventType && !query.type) {
    query.eventType = String(query.category).trim();
  }

  if (query.date && !query.datePreset && !query.dayKey && !query.startDate && !query.endDate) {
    query.datePreset = String(query.date).trim().toLowerCase();
  }
  delete query.date;

  if (query.sort) {
    const normalizedSort = String(query.sort).trim().toLowerCase();
    query.sort =
      normalizedSort === 'trending' || normalizedSort === 'popular'
        ? 'heat'
        : normalizedSort === 'newest'
          ? 'new'
          : normalizedSort;
  }

  return sortObjectKeys(query);
}

function getRequestViewerId(request: any) {
  const ip = request.headers['x-forwarded-for'] || request.ip || '127.0.0.1';
  const userAgent = request.headers['user-agent'] || 'unknown';
  return Buffer.from(`${ip}-${userAgent}`).toString('base64');
}

async function getEventViewerState(db: any, eventId: string, userId: string | null) {
  const surgeStatus = await getEventSurgeStatus(db, eventId);
  if (!userId) {
    return {
      hasRsvped: false,
      queue: null,
      surgeActive: surgeStatus?.status === 'surge',
    };
  }

  const [userDoc, queueSnapshot] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db
      .collection('event_queues')
      .where('eventId', '==', eventId)
      .where('userId', '==', userId)
      .where('status', 'in', ['waiting', 'admitted', 'payment_failed'])
      .limit(1)
      .get(),
  ]);

  const userData = userDoc.exists ? userDoc.data() || {} : {};
  const attendedEvents = Array.isArray(userData.attendedEvents) ? userData.attendedEvents : [];
  let queue = null;

  if (!queueSnapshot.empty) {
    const queueDoc = queueSnapshot.docs[0];
    try {
      queue = await getEventQueueStatus(db, queueDoc.id);
    } catch {
      queue = { id: queueDoc.id, ...queueDoc.data() };
    }
  }

  return {
    hasRsvped: attendedEvents.includes(eventId),
    queue,
    surgeActive: surgeStatus?.status === 'surge',
  };
}

const SCHEDULING_BLOCKING_STATUSES = new Set([
  'blocked',
  'booked',
  'approved',
  'pending',
  'requested',
  'countered',
  'changes_requested',
]);

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function hasSchedulingConflict(
  slotDocs: any[],
  proposed: { startTime?: string | null; endTime?: string | null },
  ignoreId?: string,
) {
  return slotDocs.some((doc: any) => {
    if (ignoreId && doc.id === ignoreId) return false;

    const slot = doc.data ? (doc.data() as Record<string, any>) : (doc as Record<string, any>);
    const status = String(slot.status || '').toLowerCase();
    if (!SCHEDULING_BLOCKING_STATUSES.has(status)) return false;

    const startTime = slot.startTime || slot.requestedStartTime || null;
    const endTime = slot.endTime || slot.requestedEndTime || null;

    if (!startTime || !endTime || !proposed.startTime || !proposed.endTime) {
      return true;
    }

    return rangesOverlap(startTime, endTime, proposed.startTime, proposed.endTime);
  });
}

async function enrichPartnerSnapshots(db: any, event: Record<string, any>) {
  const enriched = { ...event };

  const [hostSnap, venueSnap] = await Promise.all([
    event.hostId
      ? db
          .collection('hosts')
          .doc(String(event.hostId))
          .get()
          .catch(() => null)
      : Promise.resolve(null),
    event.venueId
      ? db
          .collection('venues')
          .doc(String(event.venueId))
          .get()
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  if (hostSnap?.exists) {
    const data = hostSnap.data() as Record<string, any>;
    enriched.hostData = {
      id: hostSnap.id,
      handle: data.handle || event.host || '',
      name: data.name || data.displayName || '',
      avatar: data.avatar || data.photoURL || '',
      slug: data.slug || hostSnap.id,
      type: 'host',
    };
  }

  if (venueSnap?.exists) {
    const data = venueSnap.data() as Record<string, any>;
    enriched.venueData = {
      id: venueSnap.id,
      name: data.name || event.venue || event.venueName || '',
      slug: data.slug || venueSnap.id,
      photoURL: data.photoURL || data.image || '',
      image: data.image || data.photoURL || '',
      area: data.area || '',
      type: 'venue',
    };
  }

  return enriched;
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

async function syncEventPromoters(
  db: any,
  eventId: string,
  eventName: string,
  venueName: string,
  promoterIds: string[],
  promotersEnabled: boolean,
  commissionRate: number,
  creatorRole: string,
): Promise<void> {
  try {
    const isEnabled = promotersEnabled !== false;
    const nextIds = isEnabled ? (Array.isArray(promoterIds) ? promoterIds : []) : [];

    // 1. Update event_promoter_settings
    const settingsRef = db.collection('event_promoter_settings').doc(eventId);
    await settingsRef.set(
      {
        eventId,
        enabled: isEnabled,
        allowedPromoterIds: nextIds,
        defaultCommission: commissionRate,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Fetch the event status/lifecycle to check if it's a draft
    const eventDoc = await db
      .collection('events')
      .doc(eventId)
      .get()
      .catch(() => null);
    const eventData = eventDoc?.exists ? eventDoc.data() : null;
    const isDraft = eventData
      ? eventData.lifecycle === 'draft' || eventData.status === 'draft'
      : true;

    // If the event is a draft, do not assign promoters or notify them yet
    if (isDraft) {
      return;
    }

    // Get currently active assignments in the database for this event
    const activeAssignmentsSnap = await db
      .collection('promoter_assignments')
      .where('eventId', '==', eventId)
      .where('status', '==', 'active')
      .get()
      .catch(() => null);
    const prevIds: string[] =
      activeAssignmentsSnap?.docs.map((d: any) => d.data().promoterId) ?? [];

    // 2. Diff newly added / removed promoters
    const newlyAdded = nextIds.filter((id) => !prevIds.includes(id));
    const removed = prevIds.filter((id) => !nextIds.includes(id));
    const now = new Date().toISOString();

    const encryptedEventName = encrypt(eventName);
    const encryptedVenueName = encrypt(venueName);

    // 3. Create assignments for newly added promoters
    await Promise.all(
      newlyAdded.map(async (promoterId) => {
        const trackingCode = await ensurePromoterLink(
          db,
          promoterId,
          eventId,
          eventName,
          commissionRate,
        );
        const assignId = `${promoterId}_${eventId}`;
        await db
          .collection('promoter_assignments')
          .doc(assignId)
          .set(
            {
              id: assignId,
              promoterId,
              eventId,
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

    // 4. Mark removed promoters as inactive
    await Promise.all(
      removed.map(async (promoterId) => {
        const assignId = `${promoterId}_${eventId}`;
        await db
          .collection('promoter_assignments')
          .doc(assignId)
          .set({ status: 'inactive', updatedAt: now }, { merge: true });
      }),
    );

    // 5. If overall disabled, deactivate any existing ones
    if (!isEnabled && prevIds.length > 0) {
      await Promise.all(
        prevIds.map(async (promoterId) => {
          const assignId = `${promoterId}_${eventId}`;
          await db
            .collection('promoter_assignments')
            .doc(assignId)
            .set({ status: 'inactive', updatedAt: now }, { merge: true });
        }),
      );
    }

    // 6. Send notifications to newly added promoters
    if (newlyAdded.length > 0) {
      const rawTitle = "You've been added to an event!";
      const rawMessage = `${eventName} is live — start sharing your link`;
      const encryptedTitle = encrypt(rawTitle);
      const encryptedMessage = encrypt(rawMessage);

      await Promise.all([
        ...newlyAdded.map((promoterId) =>
          db.collection('notifications').add({
            recipientId: promoterId,
            recipientType: 'promoter',
            type: 'promoter_assignment',
            title: encryptedTitle,
            message: encryptedMessage,
            read: false,
            createdAt: now,
            data: {
              eventId,
              initiatedBy: creatorRole === 'host' ? 'host' : 'venue',
            },
          }),
        ),
        sendPushToUsers(db, newlyAdded, rawTitle, rawMessage, {
          type: 'promoter_assignment',
          eventId,
        }),
      ]);
    }
  } catch (err: any) {
    console.error(`[syncEventPromoters] Error: ${err.message}`);
  }
}

export default async function eventRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/events
   * Public Explore feed events with filters
   */
  fastify.get(
    '/events',
    { preHandler: [fastify.validate({ querystring: ExploreEventListQuery })] },
    async (request: any, reply) => {
      try {
        const { lifecycle, creatorId, venueId } = request.query || {};

        // If query is for partner/draft list (e.g. from partner dashboard)
        if (lifecycle || creatorId) {
          const userId = request.user?.uid;
          if (!userId) {
            return reply.status(401).send(
              buildErrorResponse({
                code: 'UNAUTHORIZED',
                message: 'Unauthorized',
                requestId: request.id,
              }),
            );
          }

          let q: any = fastify.db.collection('events');
          if (creatorId) {
            q = q.where('creatorId', '==', creatorId);
          } else if (venueId) {
            q = q.where('venueId', '==', venueId);
          }

          if (lifecycle) {
            const lifecycles = lifecycle
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            if (lifecycles.length > 0) {
              q = q.where('lifecycle', 'in', lifecycles);
            }
          }

          const limit = Math.min(Number(request.query.limit) || 20, 100);
          let snap;
          let sortedInMemory = false;
          try {
            snap = await q.orderBy('startDate', 'desc').limit(limit).get();
          } catch (err: any) {
            fastify.log.warn(
              `Firestore query with orderBy failed (likely missing index): ${err.message}. Retrying without orderBy and sorting in memory.`,
            );
            snap = await q.get();
            sortedInMemory = true;
          }

          let events = snap.docs.map((doc: any) => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              eventId: doc.id,
            };
          });

          if (sortedInMemory) {
            events.sort((a: any, b: any) => {
              const dateA = a.startDate || '';
              const dateB = b.startDate || '';
              return dateB.localeCompare(dateA);
            });
            events = events.slice(0, limit);
          }

          return { events, success: true };
        }

        await enforcePublicRateLimit(fastify, request, 'events:explore', 120, 60);
        applyPublicCacheHeaders(reply, 60);

        const normalizedQuery = normalizeExploreEventsQuery(request.query || {});
        const rawCacheKey = `explore:v${EXPLORE_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(
          normalizedQuery,
        )}`;
        const cacheKey = await buildVersionedPublicCacheKey(fastify, 'events', rawCacheKey);
        const cached = await fastify.cache.get('public-discovery', cacheKey);
        if (cached) return cached;

        const result = await fastify.publicDiscoveryService.listEvents(normalizedQuery);
        await fastify.cache.set('public-discovery', cacheKey, result, 60);
        return result;
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED')
          return reply.status(429).send(
            buildErrorResponse({
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              requestId: request.id,
            }),
          );
        request.log.error({ error }, 'Failed to list explore events');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load events',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/events/featured
   * Public Explore hero carousel events
   */
  fastify.get(
    '/events/featured',
    { preHandler: [fastify.validate({ querystring: ExploreFeaturedEventListQuery })] },
    async (request: any, reply) => {
      try {
        await enforcePublicRateLimit(fastify, request, 'events:featured', 120, 60);
        applyPublicCacheHeaders(reply, 60);

        const normalizedQuery = normalizeExploreEventsQuery(request.query || {});
        const rawCacheKey = `featured:v${EXPLORE_FEATURED_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(
          normalizedQuery,
        )}`;
        const cacheKey = await buildVersionedPublicCacheKey(fastify, 'events', rawCacheKey);
        const cached = await fastify.cache.get('public-discovery', cacheKey);
        if (cached) return cached;

        const result = await fastify.publicDiscoveryService.listFeaturedEvents(normalizedQuery);
        await fastify.cache.set('public-discovery', cacheKey, result, 60);
        return result;
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED')
          return reply.status(429).send(
            buildErrorResponse({
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              requestId: request.id,
            }),
          );
        request.log.error({ error }, 'Failed to list featured explore events');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load featured events',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/events/map
   * Lightweight pins for zoomable mobile maps.
   */
  fastify.get(
    '/events/map',
    { preHandler: [fastify.validate({ querystring: EventMapQuery })] },
    async (request: any, reply) => {
      try {
        await enforcePublicRateLimit(fastify, request, 'events:map', 180, 60);
        applyPublicCacheHeaders(reply, 30);

        const normalizedQuery = {
          lat: Number(request.query.lat.toFixed(3)),
          lng: Number(request.query.lng.toFixed(3)),
          radius: Number(request.query.radius),
          limit: Number(request.query.limit),
        };
        const rawCacheKey = `map:v${EXPLORE_MAP_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(
          normalizedQuery,
        )}`;
        const cacheKey = await buildVersionedPublicCacheKey(fastify, 'events', rawCacheKey);
        const cached = await fastify.cache.get('public-discovery', cacheKey);
        if (cached) return cached;

        const result = await listEventMapPins(fastify.db, request.query);
        await fastify.cache.set('public-discovery', cacheKey, result, 30);
        return result;
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED')
          return reply.status(429).send(
            buildErrorResponse({
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              requestId: request.id,
            }),
          );
        request.log.error({ error }, 'Failed to list event map pins');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load map events',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * GET /api/v1/events/nearby
   */
  fastify.get(
    '/events/nearby',
    {
      preHandler: [fastify.validate({ querystring: EventNearbyQuery })],
    },
    async (request: any, reply) => {
      const { lat, lng, radius = 50, limit = 20 } = request.query;
      if (!lat || !lng)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'lat and lng are required',
            requestId: request.id,
          }),
        );

      try {
        const cacheKey = JSON.stringify({ lat, lng, radius, limit });
        const cached = await fastify.cache.get('events:nearby', cacheKey);
        if (cached) return cached;

        const events = await fastify.eventService.listNearby(
          Number(lat),
          Number(lng),
          Number(radius),
          Number(limit),
        );

        await fastify.cache.set('events:nearby', cacheKey, events, 60); // 60s TTL
        return events;
      } catch (error: any) {
        fastify.log.error(`Error in GET /events/nearby: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal Server Error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/events/:id/view',
    {
      preHandler: [fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      try {
        return await trackGuestEventView(fastify.db, {
          eventId: request.params.id,
          viewerId: getRequestViewerId(request),
        });
      } catch (error: any) {
        request.log.warn({ error }, 'Non-critical event view tracking failed');
        return { ok: true };
      }
    },
  );

  fastify.post(
    '/events/:id/track',
    {
      preHandler: [fastify.validate({ params: EventParamId, body: EventTrackBody })],
    },
    async (request: any, reply) => {
      try {
        return await trackGuestEventInteraction(fastify.db, {
          eventId: request.params.id,
          type: request.body?.type,
          ref: request.body?.ref,
        });
      } catch (error: any) {
        request.log.warn({ error }, 'Non-critical event interaction tracking failed');
        return { ok: true };
      }
    },
  );

  fastify.post(
    '/events/:id/rsvp',
    {
      preHandler: [fastify.validate({ params: EventParamId, body: EventRsvpBody })],
    },
    async (request: any, reply) => {
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
        const result = await toggleEventRsvp(fastify.db, {
          eventId: request.params.id,
          userId,
          shouldInclude: request.body.shouldInclude,
        });
        if (typeof fastify.invalidatePublicDiscovery === 'function') {
          await fastify.invalidatePublicDiscovery('events').catch(() => undefined);
        }
        return result;
      } catch (error: any) {
        request.log.error({ error }, 'Failed to update event RSVP');
        const status =
          error.message === 'Event not found' || error.message === 'User profile not found'
            ? 404
            : 500;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Unable to update RSVP',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/events/:id/viewer-state',
    {
      preHandler: [fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      try {
        const eventDoc = await fastify.db.collection('events').doc(request.params.id).get();
        if (!eventDoc.exists) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        }

        const viewerState = await getEventViewerState(
          fastify.db,
          request.params.id,
          request.user?.uid || null,
        );
        return buildSuccessResponse(viewerState);
      } catch (error: any) {
        request.log.error({ error }, 'Failed to load event viewer state');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Unable to load event viewer state',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/events/:id/queue',
    {
      preHandler: [fastify.validate({ params: EventParamId, querystring: EventQueueQuery })],
    },
    async (request: any, reply) => {
      try {
        const eventDoc = await fastify.db.collection('events').doc(request.params.id).get();
        if (!eventDoc.exists) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        }

        const { queueId } = request.query;
        if (!queueId) {
          const status = await getEventSurgeStatus(fastify.db, request.params.id);
          return { surgeActive: status?.status === 'surge' };
        }

        const queueStatus = await getEventQueueStatus(fastify.db, queueId);
        if (queueStatus?.eventId !== request.params.id) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Queue entry not found for this event',
              requestId: request.id,
            }),
          );
        }

        return queueStatus;
      } catch (error: any) {
        request.log.error({ error }, 'Failed to load event queue status');
        const statusCode = error.message === 'Queue entry not found' ? 404 : 500;
        return reply.status(statusCode).send(
          buildErrorResponse({
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Unable to load queue status',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/events/:id/queue',
    {
      preHandler: [fastify.validate({ params: EventParamId, body: EventQueueBody })],
    },
    async (request: any, reply) => {
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
        const deviceId = request.headers['user-agent'] || 'default';
        return await joinEventQueue(fastify.db, {
          eventId: request.params.id,
          userId,
          deviceId,
        });
      } catch (error: any) {
        request.log.error({ error }, 'Failed to join event queue');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Unable to join queue',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/events/:id/waitlist',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: EventParamId, body: EventWaitlistBody }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const email = request.user?.email || request.body?.email || null;
      if (!userId || !email)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Sign in with an email to join the waitlist',
            requestId: request.id,
          }),
        );

      try {
        const entry = await joinEventWaitlist(fastify.db, {
          eventId: request.params.id,
          ticketId: request.body?.ticketId,
          tierId: request.body?.tierId,
          userId,
          email,
          phone: request.body?.phone || request.user?.phoneNumber || null,
        });
        const status = await getEventWaitlistStatus(fastify.db, {
          eventId: request.params.id,
          email,
        });
        return buildSuccessResponse({
          ...status,
          entry: status.entry || entry,
        });
      } catch (error: any) {
        request.log.error({ error }, 'Failed to join event waitlist');
        const message = String(error.message || '');
        const statusCode =
          message === 'Event not found'
            ? 404
            : message === 'Event is not sold out'
              ? 409
              : message.includes('required')
                ? 400
                : 500;
        return reply.status(statusCode).send(
          buildErrorResponse({
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 409
                  ? 'EVENT_NOT_SOLD_OUT'
                  : statusCode === 400
                    ? 'BAD_REQUEST'
                    : 'INTERNAL_ERROR',
            message:
              statusCode === 409
                ? 'Waitlist is only available when this event is sold out'
                : statusCode === 500
                  ? 'Unable to join waitlist'
                  : error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/events/:id/attendees',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: EventParamId, querystring: EventAttendeesQuery }),
      ],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      }

      try {
        reply.header('Cache-Control', 'private, no-store');
        const result = await getEventAttendees(fastify.db, request.params.id, userId, {
          limit: request.query.limit,
        });
        return buildSuccessResponse(result);
      } catch (error: any) {
        request.log.error(
          { error, userId, eventId: request.params.id },
          'GET event attendees failed',
        );
        const status =
          error.message === 'Event not found'
            ? 404
            : error.message?.includes('required')
              ? 400
              : 500;
        return reply.status(status).send(
          buildErrorResponse({
            code: status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
            message: status === 500 ? 'Unable to load attendees' : error.message,
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/events/:id/tickets',
    {
      preHandler: [fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      try {
        await enforcePublicRateLimit(fastify, request, 'events:tickets', 240, 60);
        reply.header('Cache-Control', 'no-store');

        const result = await listAvailableTicketTiers(fastify.db, request.params.id);
        if (!result) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        }

        return buildSuccessResponse(result);
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED') {
          return reply.status(429).send(
            buildErrorResponse({
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              requestId: request.id,
            }),
          );
        }

        const isInventoryUnavailable =
          error instanceof InventoryReadError || error instanceof InventoryUnavailableError;
        request.log.error(
          { error, eventId: request.params.id },
          'Failed to load event ticket tiers',
        );
        return reply.status(isInventoryUnavailable ? 503 : 500).send(
          buildErrorResponse({
            code: isInventoryUnavailable ? 'INVENTORY_UNAVAILABLE' : 'INTERNAL_ERROR',
            message: isInventoryUnavailable
              ? 'Ticket inventory is temporarily unavailable'
              : 'Unable to load ticket tiers',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.get(
    '/events/:id',
    {
      preHandler: [fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      try {
        await enforcePublicRateLimit(fastify, request, 'events:detail', 120, 60);
        applyPublicCacheHeaders(reply, 60);

        const rawCacheKey = `detail:v${EXPLORE_EVENTS_CACHE_SCHEMA_VERSION}:${id}`;
        const cacheKey = await buildVersionedPublicCacheKey(fastify, 'events', rawCacheKey);
        const cached = await fastify.cache.get('public-discovery', cacheKey);
        if (cached) return cached;

        let detail = await fastify.publicDiscoveryService.getEventDetail(id);
        let isPrivateOrDraft = false;

        if (!detail) {
          // Check if this is a draft or private event that the user owns/has access to
          const eventSnap = await fastify.db.collection('events').doc(id).get();
          if (eventSnap.exists) {
            const eventData = eventSnap.data() as any;
            const uid = request.user?.uid;
            let hasAccess = false;

            if (uid) {
              const activePartnerId = request.user?.activeMembership?.partnerId;
              if (
                eventData.creatorId === uid ||
                eventData.hostId === uid ||
                (activePartnerId &&
                  (eventData.hostId === activePartnerId || eventData.venueId === activePartnerId))
              ) {
                hasAccess = true;
              } else {
                if (eventData.hostId) {
                  hasAccess = await fastify
                    .verifyPartnerAccess(request, eventData.hostId)
                    .catch(() => false);
                }
                if (!hasAccess && eventData.venueId) {
                  hasAccess = await fastify
                    .verifyPartnerAccess(request, eventData.venueId)
                    .catch(() => false);
                }
              }
            }

            if (hasAccess) {
              isPrivateOrDraft = true;
              detail = {
                event: {
                  ...eventData,
                  id: eventSnap.id,
                },
                interestedData: {
                  count: 0,
                  users: [],
                },
              };
            }
          }
        }

        if (!detail)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );

        if (!isPrivateOrDraft) {
          await fastify.cache.set('public-discovery', cacheKey, detail, 60);
        }
        return detail;
      } catch (error: any) {
        if (error.message === 'RATE_LIMITED')
          return reply.status(429).send(
            buildErrorResponse({
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              requestId: request.id,
            }),
          );
        request.log.error({ error }, 'Failed to load event detail');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Unable to load event',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/events
   * Create new event
   */
  fastify.post(
    '/events',
    {
      preHandler: [fastify.validate({ body: EventCreateBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const workspaceId = request.workspaceId;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      if (!workspaceId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'MISSING_SCOPE',
            message: 'Missing x-workspace-id header',
            requestId: request.id,
          }),
        );

      let actorId = userId;

      // If a venue/host is creating the event on behalf of their entity, preserve their creatorId
      if (request.body.creatorId && request.body.creatorId !== userId) {
        try {
          await fastify.verifyPartnerAccess(request, request.body.creatorId);
          actorId = request.body.creatorId;
        } catch (error) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden: Cannot create an event for this entity.',
              requestId: request.id,
            }),
          );
        }
      }

      if (request.body.startDate && request.body.endDate) {
        const start = new Date(request.body.startDate);
        const end = new Date(request.body.endDate);
        if (end.getTime() <= start.getTime()) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'End date must be after start date',
              requestId: request.id,
            }),
          );
        }
      }

      try {
        const event = await fastify.eventService.createEvent(request.body, actorId, workspaceId);

        // Invalidate event lists for this workspace
        await fastify.cache.invalidateNamespace('events:list');
        await fastify.cache.invalidateNamespace('events:nearby');

        // Broadcast real-time targeted update
        fastify.broadcast(
          {
            type: 'EVENT_CREATED',
            payload: { id: event.id, title: event.title, status: event.status, workspaceId },
          },
          `workspace:${workspaceId}`,
        );
        await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, {
          type: 'event',
          id: event.id,
        });

        await fastify.invalidatePublicDiscovery('all');
        await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch(() => undefined);

        // Sync promoters (fire-and-forget)
        const bodyPromoters = Array.isArray(request.body.promoters) ? request.body.promoters : [];
        const bodyPromotersEnabled = request.body.promotersEnabled ?? false;
        const commissionRate = request.body.commission ?? 10;

        syncEventPromoters(
          fastify.db,
          event.id,
          event.title || 'Untitled Event',
          event.venueName || event.venue || '',
          bodyPromoters,
          bodyPromotersEnabled,
          commissionRate,
          request.body.creatorRole || 'venue',
        );

        return { success: true, id: event.id };
      } catch (error: any) {
        fastify.log.error(`Error in POST /events: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal Server Error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * PATCH /api/v1/events/:id
   */
  fastify.patch(
    '/events/:id',
    {
      preHandler: [fastify.validate({ params: EventParamId, body: PartnerEventUpdateBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const { id } = request.params;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      // workspaceId from x-workspace-id header or auth context activeMembership.
      // For solo owners (no partner_memberships doc), both may be null — derive from the event itself.
      let workspaceId: string | null = request.workspaceId || null;
      let existingEventSnap: any = null;
      if (!workspaceId) {
        const snap = await fastify.db
          .collection('events')
          .doc(id)
          .get()
          .catch(() => null);
        if (snap?.exists) {
          existingEventSnap = snap.data() as any;
          const candidate: string =
            existingEventSnap.workspaceId ||
            existingEventSnap.creatorId ||
            existingEventSnap.hostId ||
            '';
          if (candidate) {
            const ok =
              candidate === userId ||
              (await fastify.verifyPartnerAccess(request, candidate).catch(() => false));
            if (ok) workspaceId = candidate;
          }
        }
      }
      if (!workspaceId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'MISSING_SCOPE',
            message: 'Missing workspace scope',
            requestId: request.id,
          }),
        );

      // Unwrap wizard auto-save envelope { actor, updates } → use updates as the patch body
      const rawBody: any = request.body;
      const patchFields: any =
        rawBody?.updates && typeof rawBody.updates === 'object' ? rawBody.updates : rawBody;

      // Self-heal: venue-creator events saved before venueId fallback fix had venueId=""
      if (
        existingEventSnap &&
        !existingEventSnap.venueId &&
        (existingEventSnap.creatorRole === 'venue' || existingEventSnap.creatorRole === 'club') &&
        existingEventSnap.creatorId
      ) {
        patchFields.venueId = patchFields.venueId || existingEventSnap.creatorId;
      }

      try {
        const event = await fastify.eventService.updateEvent(id, patchFields, userId, workspaceId);
        if (!event)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found in this workspace',
              requestId: request.id,
            }),
          );

        // Invalidate the specific event detail and all lists
        const cacheKeyId = `${id}:${workspaceId}`;
        await fastify.cache.delete('events:detail', cacheKeyId);
        if (event.slug) await fastify.cache.delete('events:detail', `${event.slug}:${workspaceId}`);

        // Namespace invalidation covers broad lists (nearby, discovery)
        await Promise.all([
          fastify.cache.invalidateNamespace('events:list'),
          fastify.cache.invalidateNamespace('events:nearby'),
        ]);

        // Broadcast real-time targeted update
        fastify.broadcast(
          {
            type: 'EVENT_UPDATED',
            payload: { id: event.id, title: event.title, status: event.status, workspaceId },
          },
          `workspace:${workspaceId}`,
        );
        await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, {
          type: 'event',
          id: event.id,
        });

        await fastify.invalidatePublicDiscovery('all');
        await fastify.publicDiscoveryService.syncEventReadModels(event.id).catch(() => undefined);

        const isPublishing =
          patchFields.lifecycle === 'scheduled' || patchFields.lifecycle === 'submitted';
        if (
          patchFields.promoters !== undefined ||
          patchFields.promotersEnabled !== undefined ||
          patchFields.commission !== undefined ||
          isPublishing
        ) {
          const settingsDoc = await fastify.db
            .collection('event_promoter_settings')
            .doc(id)
            .get()
            .catch(() => null);
          const prevIds: string[] =
            (settingsDoc?.exists ? (settingsDoc.data() as any)?.allowedPromoterIds : null) ?? [];

          const bodyPromoters = Array.isArray(patchFields.promoters)
            ? patchFields.promoters
            : prevIds;
          const bodyPromotersEnabled =
            patchFields.promotersEnabled ?? event.promotersEnabled ?? false;
          const commissionRate =
            patchFields.commission ?? event.promoterSettings?.commissionRate ?? 10;

          syncEventPromoters(
            fastify.db,
            id,
            event.title || 'Untitled Event',
            event.venueName || event.venue || '',
            bodyPromoters,
            bodyPromotersEnabled,
            commissionRate,
            event.creatorRole || 'venue',
          );
        }

        return { success: true, id: event.id };
      } catch (error: any) {
        fastify.log.error(`Error in PATCH /events/:id: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal Server Error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/events/:id/repair
   * Re-saves an event to fix data issues (e.g. missing venueId) and re-syncs discovery index.
   */
  fastify.post(
    '/events/:id/repair',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const { id } = request.params;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      const snap = await fastify.db
        .collection('events')
        .doc(id)
        .get()
        .catch(() => null);
      if (!snap?.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );

      const d = snap.data() as any;
      const candidate: string = d.workspaceId || d.creatorId || d.hostId || '';
      if (!candidate)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'MISSING_SCOPE',
            message: 'Cannot determine event owner',
            requestId: request.id,
          }),
        );

      const ok =
        candidate === userId ||
        (await fastify.verifyPartnerAccess(request, candidate).catch(() => false));
      if (!ok)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Access denied',
            requestId: request.id,
          }),
        );

      const repairs: Record<string, any> = {};
      if (!d.venueId && (d.creatorRole === 'venue' || d.creatorRole === 'club')) {
        // Resolve the actual venue Firestore doc ID via partner context (uid may differ from venueDocId)
        const partnerCtx = await resolvePartnerContext(fastify.db, request).catch(() => null);
        const correctVenueId =
          partnerCtx?.type === 'venue' ? partnerCtx.partnerId : d.creatorId || null;
        if (correctVenueId) repairs.venueId = correctVenueId;
      }

      if (Object.keys(repairs).length > 0) {
        await fastify.db
          .collection('events')
          .doc(id)
          .update({ ...repairs, updatedAt: new Date().toISOString() });
      }
      await fastify.publicDiscoveryService.syncEventReadModels(id).catch(() => undefined);
      await fastify.invalidatePublicDiscovery('all').catch(() => undefined);

      return reply.send({ success: true, repaired: repairs });
    },
  );

  /**
   * DELETE /api/v1/events/:id
   */
  /**
   * POST /api/v1/partner/events/create
   * Partner-specific event creation with pre-flight checks:
   *   - slot availability on the venue calendar
   *   - active host–venue partnership enforcement
   *   - lifecycle enforcement by creator role
   *   - slot request creation after event is saved
   *
   * Does NOT require x-workspace-id — derives actor from auth token.
   */
  fastify.post(
    '/partner/events/create',
    {
      preHandler: [fastify.validate({ body: PartnerEventCreateBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );

      const body: Record<string, any> = { ...request.body };

      let hostId: string = body.creatorId || body.hostId || userId;
      const isDraft: boolean = body.lifecycle === 'draft';
      if (body.creatorRole === 'host') {
        body.creatorId = hostId;
        body.hostId = hostId;
      }

      // Verify the authenticated user has access to the claimed partner identity.
      // Skip when creatorId === userId (solo user whose Firebase UID is the partner doc ID).
      if (hostId !== userId) {
        const hasAccess = await fastify.verifyPartnerAccess(request, hostId).catch(() => false);
        if (!hasAccess) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'You do not have access to this partner account',
              requestId: request.id,
            }),
          );
        }
      }

      // --- Normalize image fields ---
      const normalizedPoster =
        body.coverImage || body.coverPhoto || body.poster || body.image || body.images?.[0] || '';
      if (normalizedPoster) {
        body.coverImage = body.coverImage || normalizedPoster;
        body.coverPhoto = body.coverPhoto || normalizedPoster;
        body.poster = body.poster || normalizedPoster;
        body.image = body.image || normalizedPoster;
      }

      // For venue/club creators, ensure venueId is the actual venue Firestore doc ID.
      // When activeMembership is null on the client, the wizard sends creatorId=uid which
      // can differ from the venue's Firestore document ID. resolvePartnerContext gives the truth.
      if ((body.creatorRole === 'venue' || body.creatorRole === 'club') && !body.venueId) {
        const partnerCtx = await resolvePartnerContext(fastify.db, request).catch(() => null);
        if (partnerCtx?.type === 'venue' && partnerCtx.partnerId) {
          body.venueId = partnerCtx.partnerId;
          body.creatorId = partnerCtx.partnerId;
          hostId = partnerCtx.partnerId; // update so buildEvent uses the venue doc ID, not uid
        }
      }

      // --- Resolve host–venue selection ---
      if (body.creatorRole === 'host' && body.venueId) {
        const activeSnap = await fastify.db
          .collection('partnerships')
          .where('hostId', '==', hostId)
          .where('status', '==', 'active')
          .get();
        const partnerships = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        const exact = partnerships.find((p: any) => p.venueId === body.venueId);
        if (exact) {
          body.venueId = exact.venueId;
          body.venueName = exact.venueName || body.venueName || body.venue || '';
          body.venue = body.venueName;
        }
      }

      // --- Validate end time is after start time ---
      if (!isDraft && body.startDate) {
        const sTime = body.startTime || '00:00';
        const eTime = body.endTime || '00:00';
        const sDate = body.startDate;
        const eDate = body.endDate || sDate;

        const [sYr, sMon, sDay] = sDate.split('-').map(Number);
        const [sHr, sMin] = sTime.split(':').map(Number);
        const startDt = new Date(sYr, sMon - 1, sDay, sHr, sMin);

        const [eYr, eMon, eDay] = eDate.split('-').map(Number);
        const [eHr, eMin] = eTime.split(':').map(Number);
        const endDt = new Date(eYr, eMon - 1, eDay, eHr, eMin);

        const isSameDayOrUnspecified = !body.endDate || body.endDate === sDate;
        if (isSameDayOrUnspecified && body.startTime && body.endTime) {
          const startMinutes = sHr * 60 + sMin;
          const endMinutes = eHr * 60 + eMin;
          if (endMinutes < startMinutes) {
            endDt.setDate(endDt.getDate() + 1);
          }
        }

        if (endDt.getTime() <= startDt.getTime()) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'End time of event must be after the start time',
              requestId: request.id,
            }),
          );
        }
      }

      // --- Scheduling availability checks (single source: availability_slots) ---
      if (!isDraft && body.venueId && body.startDate) {
        const slotsSnap = await fastify.db
          .collection('availability_slots')
          .where('venueId', '==', body.venueId)
          .where('date', '==', body.startDate)
          .limit(50)
          .get();

        if (
          hasSchedulingConflict(slotsSnap.docs, {
            startTime: body.startTime,
            endTime: body.endTime,
          })
        ) {
          return reply.status(409).send(
            buildErrorResponse({
              code: 'CONFLICT',
              message: 'The selected venue time slot is unavailable',
              requestId: request.id,
            }),
          );
        }
      }

      // --- Active partnership enforcement ---
      if (body.creatorRole === 'host' && body.venueId && !isDraft) {
        const partnershipSnap = await fastify.db
          .collection('partnerships')
          .where('hostId', '==', hostId)
          .where('venueId', '==', body.venueId)
          .where('status', '==', 'active')
          .limit(1)
          .get();
        if (partnershipSnap.empty) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'No active partnership with this venue. Access denied.',
              requestId: request.id,
            }),
          );
        }
      }

      // --- Lifecycle enforcement ---
      if (!isDraft) {
        if (body.creatorRole === 'host') {
          body.lifecycle = 'submitted';
          // visibility stays as-is (will be set to 'public' when venue approves)
        } else if (body.creatorRole === 'venue' || body.creatorRole === 'club') {
          body.lifecycle = 'scheduled';
          body.visibility = 'public'; // Venue events self-approve — stamp public immediately
        }
      }

      try {
        const built = buildEvent({
          ...body,
          creatorId: hostId,
          workspaceId: hostId,
        }) as Record<string, any>;
        // Preserve all wizard-specific fields that buildEvent doesn't output
        const event: any = {
          ...body,
          ...built,
          workspaceId: hostId,
        };
        const eventRecord = await enrichPartnerSnapshots(fastify.db, event);

        const slotRecord =
          body.creatorRole === 'host' && body.venueId && !isDraft
            ? {
                eventId: event.id,
                hostId,
                creatorId: hostId,
                hostName: body.host || '',
                venueId: body.venueId,
                venueName: body.venueName || body.venue || '',
                date: body.startDate,
                startTime: body.startTime || null,
                endTime: body.endTime || null,
                requestedDate: body.startDate,
                requestedStartTime: body.startTime || null,
                requestedEndTime: body.endTime || null,
                requestedBy: hostId,
                notes: `Event creation request: ${body.title}`,
                source: 'host_event_request',
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: userId,
              }
            : null;

        await fastify.db.runTransaction(async (transaction: any) => {
          if (slotRecord) {
            const conflictingSlots = await transaction.get(
              fastify.db
                .collection('availability_slots')
                .where('venueId', '==', body.venueId)
                .where('date', '==', body.startDate)
                .limit(50),
            );

            if (
              hasSchedulingConflict(
                conflictingSlots.docs,
                { startTime: body.startTime, endTime: body.endTime },
                event.id,
              )
            ) {
              const conflictError: any = new Error('The selected venue time slot is unavailable');
              conflictError.statusCode = 409;
              conflictError.code = 'CONFLICT';
              throw conflictError;
            }

            transaction.create(
              fastify.db.collection('availability_slots').doc(event.id),
              slotRecord,
            );
          }

          transaction.create(fastify.db.collection('events').doc(event.id), eventRecord);
        });

        await fastify.cache.invalidateNamespace('events:list');
        await fastify.cache.invalidateNamespace('events:nearby');
        await fastify.publicDiscoveryService.syncEventReadModels(event.id);
        await fastify.invalidatePublicDiscovery('all');

        // Sync promoters (fire-and-forget)
        const bodyPromoters = Array.isArray(body.promoters) ? body.promoters : [];
        const bodyPromotersEnabled = body.promotersEnabled ?? false;
        const commissionRate = body.commission ?? 10;

        syncEventPromoters(
          fastify.db,
          event.id,
          eventRecord.title || 'Untitled Event',
          eventRecord.venueName || eventRecord.venue || '',
          bodyPromoters,
          bodyPromotersEnabled,
          commissionRate,
          body.creatorRole || 'venue',
        );

        return reply.status(201).send({ success: true, event: { id: event.id } });
      } catch (error: any) {
        fastify.log.error(`[partner/events/create] ${error.message}`);
        const statusCode = Number(error?.statusCode) || 500;
        return reply.status(statusCode).send(
          buildErrorResponse({
            code: error?.code || (statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR'),
            message: error?.message || 'Failed to create event',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete(
    '/events/:id',
    {
      preHandler: [fastify.validate({ params: EventParamId })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      const workspaceId = request.workspaceId;
      const { id } = request.params;
      if (!userId)
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      if (!workspaceId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'MISSING_SCOPE',
            message: 'Missing x-workspace-id header',
            requestId: request.id,
          }),
        );

      try {
        await fastify.eventService.deleteEvent(id, userId, workspaceId);

        // Invalidate cache
        const cacheKeyId = `${id}:${workspaceId}`;
        await fastify.cache.delete('events:detail', cacheKeyId);
        await fastify.cache.invalidateNamespace('events:list');
        await fastify.cache.invalidateNamespace('events:nearby');
        await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, {
          type: 'event',
          id: id,
        });
        await fastify.invalidatePublicDiscovery('all');
        await fastify.publicDiscoveryService.syncEventReadModels(id).catch(() => undefined);
        return { success: true, message: 'Event deleted', workspaceId };
      } catch (error: any) {
        fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal Server Error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/events/wizard/preview-breakdown
   * Computes revenue projection for event creation wizard.
   * Accepts the raw wizard formData and returns commission/discount/net metrics.
   * Frontend must call this and render the result — never compute projections locally.
   */
  const WizardPreviewSchema = z.object({
    isRSVP: z.boolean().optional(),
    promotersEnabled: z.boolean().optional(),
    buyerDiscountsEnabled: z.boolean().optional(),
    commission: z.number().optional(),
    commissionType: z.string().optional(),
    discount: z.number().optional(),
    discountType: z.string().optional(),
    tickets: z
      .array(
        z.object({
          name: z.string().optional(),
          price: z.number(),
          quantity: z.number(),
          overrideCommission: z.boolean().optional(),
          promoterCommission: z.number().optional(),
          promoterCommissionType: z.string().optional(),
          overrideDiscount: z.boolean().optional(),
          promoterDiscount: z.number().optional(),
          promoterDiscountType: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
    tables: z
      .array(
        z.object({
          name: z.string().optional(),
          price: z.number(),
          quantity: z.number(),
          capacity: z.number().optional(),
          buyerDiscountEnabled: z.boolean().optional(),
          promoterDiscount: z.number().optional(),
          promoterDiscountType: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
  });

  fastify.post(
    '/events/wizard/preview-breakdown',
    {
      preHandler: [fastify.validate({ body: WizardPreviewSchema })],
    },
    async (request: any, reply) => {
      const fd = request.body;
      const isRSVP = fd.isRSVP === true;
      const promotersEnabled = fd.promotersEnabled === true;
      const buyerDiscountsEnabled = fd.buyerDiscountsEnabled === true;

      const computeTier = (tier: any, type: 'ticket' | 'table') => {
        const price = Number(tier.price) || 0;
        const quantity = Number(tier.quantity) || 0;
        const value = price * quantity;
        const isFree = price === 0;

        let commTotal = 0,
          commRate = 0,
          commType = 'percent';
        if (promotersEnabled && !isFree) {
          commRate = tier.overrideCommission
            ? Number(tier.promoterCommission) || 0
            : Number(fd.commission) || 15;
          commType = tier.overrideCommission
            ? tier.promoterCommissionType || 'percent'
            : fd.commissionType || 'percent';
          commTotal = commType === 'percent' ? (value * commRate) / 100 : commRate * quantity;
        }

        let discTotal = 0,
          discRate = 0,
          discType = 'percent';
        if (promotersEnabled && buyerDiscountsEnabled && !isFree && !isRSVP) {
          if (type === 'ticket') {
            discRate = tier.overrideDiscount
              ? Number(tier.promoterDiscount) || 0
              : Number(fd.discount) || 10;
            discType = tier.overrideDiscount
              ? tier.promoterDiscountType || 'percent'
              : fd.discountType || 'percent';
          } else if (tier.buyerDiscountEnabled) {
            discRate = Number(tier.promoterDiscount) || 0;
            discType = tier.promoterDiscountType || 'percent';
          }
          discTotal = discType === 'percent' ? (value * discRate) / 100 : discRate * quantity;
        }

        return {
          name: tier.name,
          price,
          quantity,
          value,
          commRate,
          commType,
          commTotal,
          discRate,
          discType,
          discTotal,
          net: value - discTotal - commTotal,
        };
      };

      const ticketMetrics = (fd.tickets || []).map((t: any) => computeTier(t, 'ticket'));
      const tableMetrics = (fd.tables || []).map((t: any) => computeTier(t, 'table'));

      const sum = (items: any[]) =>
        items.reduce(
          (a, m) => ({
            quantity: a.quantity + m.quantity,
            value: a.value + m.value,
            discTotal: a.discTotal + m.discTotal,
            commTotal: a.commTotal + m.commTotal,
            net: a.net + m.net,
          }),
          { quantity: 0, value: 0, discTotal: 0, commTotal: 0, net: 0 },
        );

      const ticketSubtotal = sum(ticketMetrics);
      const tableSubtotal = sum(tableMetrics);
      const grandTotal = sum([ticketSubtotal, tableSubtotal]);
      const revenueBase = grandTotal.net + grandTotal.commTotal;

      return {
        ticketMetrics,
        tableMetrics,
        ticketSubtotal,
        tableSubtotal,
        grandTotal,
        venueSharePct: revenueBase > 0 ? (grandTotal.net / revenueBase) * 100 : 100,
        promoterSharePct: revenueBase > 0 ? (grandTotal.commTotal / revenueBase) * 100 : 0,
      };
    },
  );

  /**
   * GET /api/v1/debug/venue-events
   * Temporary debug endpoint — shows partner context + raw query results.
   * Remove after event visibility is confirmed working.
   */
  fastify.get('/debug/venue-events', async (request: any, reply) => {
    // Accept uid from query param for easy browser testing when no auth header
    const uid: string = request.user?.uid || (request.query as any)?.uid || '';
    if (!uid)
      return reply
        .status(400)
        .send({ error: 'Pass ?uid=YOUR_FIREBASE_UID or an Authorization header' });

    const ctx = await resolvePartnerContext(fastify.db, request).catch(() => null);

    const [byVenueId, byCreatorIdDoc, byCreatorIdUid, eventCardIndex] = await Promise.all([
      ctx
        ? fastify.db
            .collection('events')
            .where('venueId', '==', ctx.partnerId)
            .limit(10)
            .get()
            .catch(() => null)
        : null,
      ctx
        ? fastify.db
            .collection('events')
            .where('creatorId', '==', ctx.partnerId)
            .limit(10)
            .get()
            .catch(() => null)
        : null,
      fastify.db
        .collection('events')
        .where('creatorId', '==', uid)
        .limit(10)
        .get()
        .catch(() => null),
      fastify.db
        .collection('event_card_index')
        .where('visibility', '==', 'public')
        .limit(10)
        .get()
        .catch(() => null),
    ]);

    return reply.send({
      uid,
      partnerContext: ctx ? { partnerId: ctx.partnerId, uid: ctx.uid, type: ctx.type } : null,
      queries: {
        byVenueId:
          (byVenueId as any)?.docs?.map((d: any) => ({
            id: d.id,
            venueId: d.data().venueId,
            creatorId: d.data().creatorId,
            lifecycle: d.data().lifecycle,
            workspaceId: d.data().workspaceId,
            title: d.data().title,
          })) ?? [],
        byCreatorIdDocId:
          (byCreatorIdDoc as any)?.docs?.map((d: any) => ({
            id: d.id,
            venueId: d.data().venueId,
            creatorId: d.data().creatorId,
            lifecycle: d.data().lifecycle,
            title: d.data().title,
          })) ?? [],
        byCreatorIdUid:
          (byCreatorIdUid as any)?.docs?.map((d: any) => ({
            id: d.id,
            venueId: d.data().venueId,
            creatorId: d.data().creatorId,
            lifecycle: d.data().lifecycle,
            title: d.data().title,
          })) ?? [],
      },
      eventCardIndex:
        (eventCardIndex as any)?.docs?.map((d: any) => ({
          id: d.id,
          visibility: d.data().visibility,
          startAt: d.data().startAt,
          title: d.data().title,
        })) ?? [],
    });
  });
}

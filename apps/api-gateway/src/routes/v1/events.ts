import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
// @ts-ignore - JS module with runtime exports
import { signPromoterAttribution } from '@c1rcle/core/promoter-attribution';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';
import { resolvePartnerContext } from '../../lib/partner-context.js';
import { getPermissionsForRole } from '../../lib/rbac-permissions.js';
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

// Guard against prototype-pollution / remote property injection when a
// user-provided value (promoterId, ticketTierId, …) is used as an object key.
const isUnsafeObjectKey = (key: unknown): boolean =>
  typeof key !== 'string' || key === '__proto__' || key === 'constructor' || key === 'prototype';

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
    fresh: z.enum(['true', 'false']).optional(),
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
  z
    .object({
      actor: z.unknown().optional(),
      updates: z.record(z.string(), z.unknown()),
      action: z.enum(['draft', 'publish', 'submit']).optional(),
    })
    .strict(),
  z.record(z.string(), z.unknown()),
]);

const PROTECTED_EVENT_UPDATE_FIELDS = new Set([
  'id',
  'creatorId',
  'creatorRole',
  'workspaceId',
  'hostId',
  'venueId',
  'ownership',
  'financialAttribution',
  'splitRuleSnapshot',
  'partnerAttribution',
  'lifecycle',
  'status',
  'visibility',
  'approvalState',
  'approvedBy',
  'approvedAt',
  'publishedAt',
  'cancelledAt',
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
    type: z.enum(['view', 'impression', 'click', 'share', 'rsvp_intent']),
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
  delete query.fresh;
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

type CompensationModel = 'standard' | 'custom' | 'salary';

interface PromoterTierCommissionOverrideInput {
  hasCustomCommission?: boolean;
  tierRates?: Record<string, number>;
  globalRate?: number;
  globalRateType?: 'percent' | 'fixed';
}

interface EventTierCommissionInput {
  id: string;
  commissionType?: 'percent' | 'fixed';
  commissionValue?: number;
}

interface SalaryCompensationInput {
  tableIncentivesEnabled?: boolean;
  tableIncentiveType?: 'percent' | 'fixed';
  tableIncentiveValue?: number;
  notes?: string;
}

/**
 * Resolves what a promoter actually earns for an event under its active
 * compensation model:
 * - standard: one flat rate for every promoter and tier
 * - custom: a per-ticket-tier map, optionally overridden per promoter; the
 *   flat `rate`/`type` returned alongside it is just a display fallback for
 *   list views that show one number
 * - salary: promoters are paid outside the platform — ticket commission is
 *   forced to 0 (table incentives are configuration-only today; there is no
 *   existing table-sale attribution pipeline to pay them out through)
 */
/**
 * Resolves what a promoter actually earns for an event.
 *
 * New signature: pass a V2 `promoterCompensation` object as the first argument.
 * Legacy signature: pass individual flat fields (kept for backward compat).
 */
export function resolveEffectiveCommission(
  pcOrPromoterId: any,
  promoterIdOrModel?: string | CompensationModel,
  standardRate?: number,
  standardType?: 'percent' | 'fixed',
  tiers?: EventTierCommissionInput[],
  overrides?: Record<string, PromoterTierCommissionOverrideInput>,
): {
  rate: number;
  type: 'percentage' | 'fixed';
  tierCommissions: Record<string, { rate: number; type: 'percentage' | 'fixed' }> | null;
} {
  const toStored = (t: string | undefined): 'percentage' | 'fixed' =>
    t === 'fixed' || t === 'flat' ? 'fixed' : 'percentage';

  // ── NEW V2 path: resolveEffectiveCommission(pc, promoterId) ─────────────────
  if (
    pcOrPromoterId &&
    typeof pcOrPromoterId === 'object' &&
    pcOrPromoterId.schemaVersion === SCHEMA_VERSION
  ) {
    const pc = pcOrPromoterId;
    const promoterId = promoterIdOrModel as string;
    const model: CompensationModel = pc.model || 'standard';
    const defaults = pc.defaults || {};
    const pcOverrides = pc.overrides || {};

    if (model === 'salary') {
      return { rate: 0, type: 'percentage', tierCommissions: null };
    }

    if (model === 'custom') {
      const ticketCommissions = defaults.ticketCommissions || [];
      const pOv = pcOverrides[promoterId];
      const tierCommissions: Record<string, { rate: number; type: 'percentage' | 'fixed' }> = {};
      for (const tc of ticketCommissions) {
        if (isUnsafeObjectKey(tc.ticketTierId)) continue;
        const ovEntry = pOv?.ticketOverrides?.find((o: any) => o.ticketTierId === tc.ticketTierId);
        const effectiveEntry = ovEntry || tc;
        tierCommissions[tc.ticketTierId] = {
          rate: Number(effectiveEntry.value) || 0,
          type: toStored(effectiveEntry.type),
        };
      }
      const firstEntry = ticketCommissions[0];
      const flat = firstEntry
        ? tierCommissions[firstEntry.ticketTierId] || { rate: 0, type: 'percentage' as const }
        : { rate: 0, type: 'percentage' as const };
      return { rate: flat.rate, type: flat.type, tierCommissions };
    }

    // standard
    const pOv = pcOverrides[promoterId];
    if (pOv?.ticketCommission) {
      return {
        rate: Number(pOv.ticketCommission.value) || 0,
        type: toStored(pOv.ticketCommission.type),
        tierCommissions: null,
      };
    }
    return {
      rate: Number(defaults.ticketCommission?.value) || 0,
      type: toStored(defaults.ticketCommission?.type),
      tierCommissions: null,
    };
  }

  // ── LEGACY flat-field path ─────────────────────────────────────────────────
  const promoterId = pcOrPromoterId as string;
  const compensationModel = promoterIdOrModel as CompensationModel;
  const legacyRate = standardRate ?? 0;
  const legacyType = standardType ?? 'percent';
  const legacyTiers = tiers ?? [];
  const legacyOverrides = overrides ?? {};

  if (compensationModel === 'salary') {
    return { rate: 0, type: 'percentage', tierCommissions: null };
  }

  if (compensationModel === 'custom') {
    const override = legacyOverrides?.[promoterId];
    const tierCommissions: Record<string, { rate: number; type: 'percentage' | 'fixed' }> = {};
    for (const tier of legacyTiers) {
      const overrideRate = override?.hasCustomCommission
        ? override.tierRates?.[tier.id]
        : undefined;
      tierCommissions[tier.id] = {
        rate: typeof overrideRate === 'number' ? overrideRate : tier.commissionValue || 0,
        type: toStored(tier.commissionType),
      };
    }
    const firstTierId = legacyTiers[0]?.id;
    const flat = firstTierId
      ? tierCommissions[firstTierId]
      : { rate: 0, type: 'percentage' as const };
    return { rate: flat.rate, type: flat.type, tierCommissions };
  }

  // standard
  const override = legacyOverrides?.[promoterId];
  if (
    override?.hasCustomCommission &&
    override.globalRate !== undefined &&
    override.globalRate !== null
  ) {
    return {
      rate: Number(override.globalRate) || 0,
      type: toStored(override.globalRateType as any),
      tierCommissions: null,
    };
  }
  return { rate: legacyRate, type: toStored(legacyType), tierCommissions: null };
}

/**
 * Server-side mirror of the wizard's 0-100%/no-negative commission rules —
 * the client already enforces this, but the wizard payload fields are
 * validated with permissive z.number().optional() schemas, so a direct API
 * call could otherwise persist an out-of-range or missing commission.
 */
function validateCommissionRate(
  value: unknown,
  type: 'percent' | 'fixed' | undefined,
  label: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`;
  if (value < 0) return `${label} cannot be negative`;
  if ((type ?? 'percent') === 'percent' && value > 100) return `${label} cannot exceed 100%`;
  return null;
}

/**
 * Server-side mirror of the wizard's 0-100%/no-negative commission rules,
 * validated directly against the canonical V2 `{model, defaults, overrides}`
 * structure — the shape actually persisted to Firestore — regardless of
 * whether the client sent flat wizard fields or the V2 object itself.
 */
function validateCompensationPayload(
  pc: { model: CompensationModel; defaults: any; overrides?: Record<string, any> },
  isPublishing: boolean,
): string | null {
  const { model, defaults = {}, overrides = {} } = pc;

  if (model === 'standard') {
    const err = validateCommissionRate(
      defaults.ticketCommission?.value,
      fromRateType(defaults.ticketCommission?.type),
      'Global commission',
    );
    if (err) return err;

    for (const [promoterId, override] of Object.entries(overrides)) {
      const tc = (override as any)?.ticketCommission;
      if (!tc) continue;
      const err2 = validateCommissionRate(
        tc.value,
        fromRateType(tc.type),
        `Commission override for promoter ${promoterId}`,
      );
      if (err2) return err2;
    }
  }

  if (model === 'custom') {
    for (const tc of defaults.ticketCommissions || []) {
      const tierLabel = `Commission for ticket tier "${tc.ticketTierId}"`;
      if (tc.value === undefined || tc.value === null) {
        if (isPublishing) {
          return `${tierLabel} is missing. Assign a commission to every ticket tier before publishing.`;
        }
        continue;
      }
      const err = validateCommissionRate(tc.value, fromRateType(tc.type), tierLabel);
      if (err) return err;
    }
    for (const [promoterId, override] of Object.entries(overrides)) {
      for (const to of (override as any)?.ticketOverrides || []) {
        const err = validateCommissionRate(
          to.value,
          fromRateType(to.type),
          `Custom commission override for promoter ${promoterId}, tier ${to.ticketTierId}`,
        );
        if (err) return err;
      }
    }
  }

  if (defaults.tableCommission) {
    const tablesErr = validateCommissionRate(
      defaults.tableCommission.value,
      fromRateType(defaults.tableCommission.type),
      'Tables commission',
    );
    if (tablesErr) return tablesErr;
  }

  if (model === 'salary' && defaults.tableIncentive?.enabled) {
    const err = validateCommissionRate(
      defaults.tableIncentive.value,
      fromRateType(defaults.tableIncentive.type),
      'Table incentive',
    );
    if (err) return err;
  }

  return null;
}

// =============================================================================
// V2 SCHEMA HELPERS
// =============================================================================

/** Current promoterCompensation schema version. Bump when the canonical shape changes. */
const SCHEMA_VERSION = 2 as const;

/** Normalises a stored commission type string to 'percentage' | 'flat'. */
function toRateType(t: string | undefined): 'percentage' | 'flat' {
  if (!t) return 'percentage';
  const n = t.toLowerCase();
  return n === 'fixed' || n === 'flat' ? 'flat' : 'percentage';
}

/** Normalises back to legacy 'percent' | 'fixed' for internal resolvers. */
function fromRateType(t: string | undefined): 'percent' | 'fixed' {
  return t === 'flat' || t === 'fixed' ? 'fixed' : 'percent';
}

/**
 * Build the canonical V2 `promoterCompensation` object from the wizard's flat
 * form-data fields. This is the single source that is written to Firestore.
 */
export function buildPromoterCompensationV2(formData: any, tickets: any[] = []): any {
  const model: CompensationModel = formData.compensationModel || 'standard';
  const enabled = formData.promotersEnabled === true;

  // ── defaults block (model-specific) ────────────────────────────────────────
  let defaults: any;

  if (model === 'standard') {
    defaults = {
      ticketCommission: {
        type: toRateType(formData.commissionType),
        value: Number(formData.commission) || 0,
      },
    };
    const tcv = formData.tablesCommissionValue;
    if (tcv !== undefined && tcv !== '' && tcv !== null) {
      defaults.tableCommission = {
        enabled: true,
        type: toRateType(formData.tablesCommissionType),
        value: Number(tcv) || 0,
      };
    }
  } else if (model === 'custom') {
    // Free (RSVP) tiers — price 0 — can never carry a commission; exclude
    // them from the defaults so validation never demands one and revenue
    // math never matches one.
    defaults = {
      ticketCommissions: (tickets || [])
        .filter((t: any) => (Number(t.price) || 0) > 0)
        .map((t: any) => ({
          ticketTierId: t.id || t.tierId,
          type: toRateType(t.commissionType),
          value: Number(t.commissionValue) || 0,
        })),
    };
    const tcv = formData.tablesCommissionValue;
    if (tcv !== undefined && tcv !== '' && tcv !== null) {
      defaults.tableCommission = {
        enabled: true,
        type: toRateType(formData.tablesCommissionType),
        value: Number(tcv) || 0,
      };
    }
  } else {
    // salary
    defaults = {
      notes: formData.salaryNotes || '',
    };
    if (formData.salaryTableIncentivesEnabled) {
      defaults.tableIncentive = {
        enabled: true,
        type: toRateType(formData.salaryTableIncentiveType),
        value: Number(formData.salaryTableIncentiveValue) || 0,
      };
    }
  }

  // ── overrides block ─────────────────────────────────────────────────────────
  // Convert the wizard's `promoterCommissionOverrides` (old flat shape) to V2.
  const overrides: Record<string, any> = {};
  const rawOverrides: Record<string, any> = formData.promoterCommissionOverrides || {};

  for (const [promoterId, ov] of Object.entries(rawOverrides)) {
    if (isUnsafeObjectKey(promoterId)) continue;
    if (!(ov as any)?.hasCustomCommission) continue;
    if (model === 'standard') {
      const gr = (ov as any).globalRate;
      if (gr !== undefined && gr !== null) {
        overrides[promoterId] = {
          ticketCommission: {
            type: toRateType((ov as any).globalRateType),
            value: Number(gr) || 0,
          },
        };
      }
    } else if (model === 'custom') {
      const ticketOverrides = Object.entries((ov as any).tierRates || {}).map(([tierId, rate]) => {
        const defaultEntry = (defaults.ticketCommissions || []).find(
          (tc: any) => tc.ticketTierId === tierId,
        );
        return {
          ticketTierId: tierId,
          type: defaultEntry?.type || 'percentage',
          value: Number(rate) || 0,
        };
      });
      if (ticketOverrides.length > 0) {
        overrides[promoterId] = { ticketOverrides };
      }
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    enabled,
    model,
    defaults,
    overrides,
  };
}

/**
 * Strips any per-tier commission entries whose ticket tier is free (price 0)
 * from a V2 `promoterCompensation` object. Applied regardless of whether the
 * object was just built from flat wizard fields or sent to the API directly
 * as an already-V2 `promoterCompensation` payload — free (RSVP) tickets can
 * never carry a commission, and a client bypassing `buildPromoterCompensationV2`
 * must not be able to smuggle one in.
 */
function stripFreeTicketCommissions(pc: any, tickets: any[]): any {
  if (!pc || pc.model !== 'custom') return pc;
  const freeTierIds = new Set(
    (tickets || [])
      .filter((t: any) => (Number(t.price) || 0) === 0)
      .map((t: any) => String(t.id || t.tierId)),
  );
  if (freeTierIds.size === 0) return pc;

  const defaults = { ...(pc.defaults || {}) };
  if (Array.isArray(defaults.ticketCommissions)) {
    defaults.ticketCommissions = defaults.ticketCommissions.filter(
      (tc: any) => !freeTierIds.has(String(tc.ticketTierId)),
    );
  }

  const overrides: Record<string, any> = {};
  for (const [promoterId, ov] of Object.entries(pc.overrides || {})) {
    if (isUnsafeObjectKey(promoterId)) continue;
    const ovAny = ov as any;
    overrides[promoterId] = Array.isArray(ovAny?.ticketOverrides)
      ? {
          ...ovAny,
          ticketOverrides: ovAny.ticketOverrides.filter(
            (to: any) => !freeTierIds.has(String(to.ticketTierId)),
          ),
        }
      : ovAny;
  }

  return { ...pc, defaults, overrides };
}

/**
 * Convert a V2 `promoterCompensation` object back to the flat field set that
 * internal helpers (`resolveEffectiveCommission`, `syncEventPromoters`) expect.
 */
export function flattenCompensationV2(pc: any): any {
  if (!pc || pc.schemaVersion !== 2) return {};

  const model: CompensationModel = pc.model || 'standard';
  const defaults = pc.defaults || {};

  const flat: any = {
    compensationModel: model,
    promotersEnabled: pc.enabled ?? false,
  };

  if (model === 'standard') {
    flat.commission = defaults.ticketCommission?.value ?? 0;
    flat.commissionType = fromRateType(defaults.ticketCommission?.type);
    if (defaults.tableCommission) {
      flat.tablesCommissionValue = defaults.tableCommission.value ?? 0;
      flat.tablesCommissionType = fromRateType(defaults.tableCommission.type);
    }
  } else if (model === 'custom') {
    flat.commission = 0;
    flat.commissionType = 'percent';
    if (defaults.tableCommission) {
      flat.tablesCommissionValue = defaults.tableCommission.value ?? 0;
      flat.tablesCommissionType = fromRateType(defaults.tableCommission.type);
    }
  } else {
    // salary
    flat.commission = 0;
    flat.commissionType = 'percent';
    flat.salaryNotes = defaults.notes || '';
    flat.salaryTableIncentivesEnabled = !!defaults.tableIncentive?.enabled;
    if (defaults.tableIncentive) {
      flat.salaryTableIncentiveValue = defaults.tableIncentive.value ?? 0;
      flat.salaryTableIncentiveType = fromRateType(defaults.tableIncentive.type);
    }
  }

  // Map V2 overrides → old promoterCommissionOverrides shape
  const promoterCommissionOverrides: Record<string, any> = {};
  for (const [promoterId, ov] of Object.entries(pc.overrides || {})) {
    if (isUnsafeObjectKey(promoterId)) continue;
    const ovAny = ov as any;
    if (model === 'standard' && ovAny.ticketCommission) {
      promoterCommissionOverrides[promoterId] = {
        hasCustomCommission: true,
        globalRate: ovAny.ticketCommission.value,
        globalRateType: fromRateType(ovAny.ticketCommission.type),
      };
    } else if (model === 'custom' && ovAny.ticketOverrides) {
      const tierRates: Record<string, number> = {};
      for (const to of ovAny.ticketOverrides as any[]) {
        if (isUnsafeObjectKey(to.ticketTierId)) continue;
        tierRates[to.ticketTierId] = to.value;
      }
      promoterCommissionOverrides[promoterId] = {
        hasCustomCommission: true,
        tierRates,
      };
    }
  }
  flat.promoterCommissionOverrides = promoterCommissionOverrides;

  return flat;
}

/**
 * Convert a stored V1 `promoterCompensation` doc (model/standard/custom/salary
 * sub-objects) to the clean V2 shape.  Call this on every Firestore read until
 * a migration script has back-filled all events.
 *
 * If `schemaVersion === SCHEMA_VERSION` the object is returned as-is.
 */
export function normalizeCompensationForRead(pc: any): any {
  if (!pc) return pc;
  if (pc.schemaVersion === SCHEMA_VERSION) return pc;

  const model: CompensationModel = pc.model || 'standard';
  let defaults: any = {};
  const overrides: Record<string, any> = {};

  if (model === 'standard') {
    const s = pc.standard || {};
    defaults = {
      ticketCommission: {
        type: toRateType(s.commissionType),
        value: Number(s.commissionValue) || 0,
      },
    };
    if (s.tableCommission) {
      defaults.tableCommission = {
        enabled: s.tableCommission.enabled ?? true,
        type: toRateType(s.tableCommission.type),
        value: Number(s.tableCommission.value) || 0,
      };
    }
  } else if (model === 'custom') {
    const c = pc.custom || {};
    defaults = {
      ticketCommissions: (c.ticketCommissions || []).map((tc: any) => ({
        ticketTierId: tc.ticketTierId,
        type: toRateType(tc.commissionType),
        value: Number(tc.commissionValue) || 0,
      })),
    };
    if (c.tableCommission) {
      defaults.tableCommission = {
        enabled: c.tableCommission.enabled ?? true,
        type: toRateType(c.tableCommission.type),
        value: Number(c.tableCommission.value) || 0,
      };
    }
  } else {
    // salary
    const s = pc.salary || {};
    defaults = { notes: s.notes || '' };
    if (s.tableIncentives?.enabled) {
      defaults.tableIncentive = {
        enabled: true,
        type: toRateType(s.tableIncentives.type),
        value: Number(s.tableIncentives.value) || 0,
      };
    }
  }

  // Extract per-promoter overrides from V1 promoters array
  for (const promoter of pc.promoters || []) {
    if (isUnsafeObjectKey(promoter.promoterId)) continue;
    if (promoter.useEventDefault === false && promoter.overrides) {
      const pOv = promoter.overrides;
      if (model === 'standard' && pOv.tableCommission) {
        overrides[promoter.promoterId] = {
          ticketCommission: {
            type: toRateType(pOv.tableCommission.type),
            value: Number(pOv.tableCommission.value) || 0,
          },
        };
      } else if (model === 'custom' && pOv.ticketCommissions) {
        overrides[promoter.promoterId] = {
          ticketOverrides: (pOv.ticketCommissions || []).map((tc: any) => ({
            ticketTierId: tc.ticketTierId,
            type: toRateType(tc.commissionType),
            value: Number(tc.commissionValue) || 0,
          })),
        };
      }
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: pc.enabled ?? false,
    model,
    defaults,
    overrides,
    revenueSummary: pc.revenueSummary,
  };
}

/**
 * Compute revenue summary from a V2 promoterCompensation object and the event
 * ticket tiers.
 */
export function calculateRevenueSummary(pc: any, tickets: any[]): any;
/** @deprecated Pass the V2 promoterCompensation object directly. */
export function calculateRevenueSummary(params: {
  model: 'standard' | 'custom' | 'salary';
  standard?: any;
  custom?: any;
  salary?: any;
  tickets: any[];
}): any;
export function calculateRevenueSummary(pcOrParams: any, ticketsArg?: any[]): any {
  // Support both new signature (pc, tickets) and old signature ({ model, standard, ... })
  let model: string;
  let defaults: any;
  let tickets: any[];

  if (ticketsArg !== undefined) {
    // New V2 call: calculateRevenueSummary(pc, tickets)
    const pc = pcOrParams;
    model = pc?.model || 'standard';
    const pc2 = normalizeCompensationForRead(pc);
    defaults = pc2?.defaults || {};
    tickets = ticketsArg || [];
  } else {
    // Legacy call: calculateRevenueSummary({ model, standard, custom, ... })
    const params = pcOrParams;
    model = params.model || 'standard';
    tickets = params.tickets || [];
    // Convert legacy shape to V2 defaults for unified logic below
    if (model === 'standard' && params.standard) {
      defaults = {
        ticketCommission: {
          type: params.standard.commissionType === 'flat' ? 'flat' : 'percentage',
          value: Number(params.standard.commissionValue) || 0,
        },
      };
    } else if (model === 'custom' && params.custom) {
      defaults = {
        ticketCommissions: (params.custom.ticketCommissions || []).map((tc: any) => ({
          ticketTierId: tc.ticketTierId,
          type: tc.commissionType === 'flat' ? 'flat' : 'percentage',
          value: Number(tc.commissionValue) || 0,
        })),
      };
    } else {
      defaults = {};
    }
  }

  let estimatedGrossRevenue = 0;
  let estimatedPromoterCommission = 0;

  for (const tier of tickets) {
    const price = Number(tier.price) || 0;
    const capacity = Number(tier.quantity) || 0;
    const value = price * capacity;
    estimatedGrossRevenue += value;
    // Free (RSVP) tiers never earn a commission — this matters beyond the
    // percent case: a flat/fixed rate would otherwise still multiply out
    // to a nonzero amount even though the ticket sold for ₹0.
    const isFree = price === 0;

    if (!isFree && model === 'standard') {
      const tc = defaults.ticketCommission;
      if (tc) {
        const commRate = Number(tc.value) || 0;
        const comm = tc.type === 'flat' ? commRate * capacity : (value * commRate) / 100;
        estimatedPromoterCommission += comm;
      }
    } else if (!isFree && model === 'custom') {
      const match = (defaults.ticketCommissions || []).find(
        (c: any) => String(c.ticketTierId) === String(tier.id || tier.tierId),
      );
      if (match) {
        const commRate = Number(match.value) || 0;
        const comm = match.type === 'flat' ? commRate * capacity : (value * commRate) / 100;
        estimatedPromoterCommission += comm;
      }
    }
    // salary: no ticket commission
  }

  estimatedGrossRevenue = Math.round(estimatedGrossRevenue * 100) / 100;
  estimatedPromoterCommission = Math.round(estimatedPromoterCommission * 100) / 100;
  const estimatedVenueRevenue =
    Math.round((estimatedGrossRevenue - estimatedPromoterCommission) * 100) / 100;

  return { estimatedGrossRevenue, estimatedPromoterCommission, estimatedVenueRevenue };
}

/**
 * @deprecated Use `buildPromoterCompensationV2` + `flattenCompensationV2` instead.
 * Kept for callers that haven't been migrated yet — reads the V1 pc object and
 * produces legacy flat fields.
 */
export function mapPromoterCompensationToLegacy(pc: any, tickets: any[] = []) {
  if (!pc) return {};
  // If this is already V2, flatten it directly
  if (pc.schemaVersion === SCHEMA_VERSION) {
    const flat = flattenCompensationV2(pc);
    flat.promoters = Object.keys(pc.overrides || []);
    flat.promotersEnabled = pc.enabled ?? false;
    flat.promoterSettings = { enabled: flat.promotersEnabled };
    return flat;
  }

  // Legacy V1 path — kept for any remaining callers
  const toLegacyType = (t: string | undefined): 'percent' | 'fixed' => {
    if (!t) return 'percent';
    const normalized = t.toLowerCase();
    if (normalized === 'fixed' || normalized === 'flat') return 'fixed';
    return 'percent';
  };

  const legacy: any = { compensationModel: pc.model || 'standard' };

  if (pc.model === 'standard' && pc.standard) {
    legacy.commission = pc.standard.commissionValue;
    legacy.commissionType = toLegacyType(pc.standard.commissionType);
    legacy.tablesCommissionValue = pc.standard.tableCommission?.value;
    legacy.tablesCommissionType = toLegacyType(pc.standard.tableCommission?.type);
  }
  if (pc.model === 'custom' && pc.custom) {
    legacy.tablesCommissionValue = pc.custom.tableCommission?.value;
    legacy.tablesCommissionType = toLegacyType(pc.custom.tableCommission?.type);
    legacy.tickets = (tickets || []).map((ticket: any) => {
      const match = (pc.custom.ticketCommissions || []).find(
        (tc: any) => String(tc.ticketTierId) === String(ticket.id || ticket.tierId),
      );
      const copy = { ...ticket };
      if (match?.commissionValue !== undefined) copy.commissionValue = match.commissionValue;
      if (match?.commissionType !== undefined)
        copy.commissionType = toLegacyType(match.commissionType);
      return copy;
    });
  }
  if (pc.model === 'salary' && pc.salary) {
    legacy.salaryNotes = pc.salary.notes;
    legacy.salaryTableIncentivesEnabled = !!pc.salary.tableIncentives?.enabled;
    legacy.salaryTableIncentiveValue = pc.salary.tableIncentives?.value;
    legacy.salaryTableIncentiveType = toLegacyType(pc.salary.tableIncentives?.type);
  }
  legacy.promoters = (pc.promoters || []).map((p: any) => p.promoterId);
  legacy.promotersEnabled = pc.enabled ?? (pc.promoters || []).length > 0;
  legacy.promoterSettings = { enabled: legacy.promotersEnabled };
  return legacy;
}

export async function populatePromoterDetails(db: any, promoterId: string) {
  try {
    const doc = await db.collection('promoters').doc(promoterId).get();
    if (doc.exists) {
      const data = doc.data();
      return {
        name: data.displayName || data.name || 'Promoter',
        email: data.email || '',
        phone: data.phoneNumber || data.phone || '',
        role: data.role || 'promoter',
      };
    }
  } catch (err) {
    console.error(`Failed to fetch promoter details for ${promoterId}:`, err);
  }
  return {
    name: 'Promoter',
    email: '',
    phone: '',
    role: 'promoter',
  };
}

/**
 * @deprecated Use `buildPromoterCompensationV2` for new writes.
 * This function remains for `updateEventPromoterCompensation` (settings sync path)
 * which still reads from the legacy `event_promoter_settings` collection.
 */
export async function mapLegacyToPromoterCompensation(
  db: any,
  legacy: any,
  tickets: any[] = [],
  _currentPromotersList: any[] = [],
) {
  // Delegate to V2 builder — treat legacy flat fields as wizard formData
  const pc = buildPromoterCompensationV2(legacy, tickets);
  pc.revenueSummary = calculateRevenueSummary(pc, tickets);
  return pc;
}

export async function updateEventPromoterCompensation(db: any, eventId: string, settingsData: any) {
  try {
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return;
    const eventData = eventDoc.data() || {};

    const legacyMerged = {
      commission: settingsData.defaultCommission ?? settingsData.commissionRate ?? 10,
      commissionType: settingsData.defaultCommissionType ?? 'percent',
      compensationModel: settingsData.compensationModel ?? 'standard',
      promotersEnabled: settingsData.enabled ?? eventData.promotersEnabled ?? false,
      promoterCommissionOverrides: settingsData.promoterCommissionOverrides || {},
      tablesCommissionValue: settingsData.tablesCommissionValue ?? 0,
      tablesCommissionType: settingsData.tablesCommissionType ?? 'percent',
      salaryTableIncentivesEnabled: !!settingsData.salary?.tableIncentivesEnabled,
      salaryTableIncentiveValue: settingsData.salary?.tableIncentiveValue ?? 0,
      salaryTableIncentiveType: settingsData.salary?.tableIncentiveType ?? 'percent',
      salaryNotes: settingsData.salary?.notes ?? '',
    };

    const pc = await mapLegacyToPromoterCompensation(
      db,
      legacyMerged,
      eventData.tickets || eventData.ticketTiers || [],
    );

    // Only promoterCompensation + the assignment array are canonical on the
    // event document — event_promoter_settings (written by the caller) is the
    // denormalised index that still carries the flattened legacy fields.
    await db
      .collection('events')
      .doc(eventId)
      .update({
        promoterCompensation: pc,
        promoters: normalizePromotersArray(settingsData.allowedPromoterIds ?? []),
        updatedAt: new Date().toISOString(),
      });
  } catch (err) {
    // eventId passed as a separate arg (not in the format string) to avoid
    // externally-controlled format-string / log-injection issues.
    console.error('Failed to update promoterCompensation for event %s:', String(eventId), err);
  }
}

export function mapEventPromoterSettingsForClient(event: any) {
  if (event.promoterSettings) {
    return event.promoterSettings;
  }
  if (event.promoterCompensation) {
    const pc = event.promoterCompensation;
    const promoters = pc.promoters || [];
    return {
      enabled: promoters.length > 0,
      allowedPromoterIds: promoters.map((p: any) => p.promoterId),
    };
  }
  return { enabled: false, allowedPromoterIds: [] };
}

/**
 * When the compensation model changes, the fields that belong to the model
 * being left behind must be cleared server-side — mirroring the wizard's
 * switch-model confirmation copy ("...will be removed/deleted") — instead of
 * relying on the client to resend cleared values on every request.
 */
function computeModelSwitchClears(
  previousModel: CompensationModel | undefined,
  nextModel: CompensationModel,
): Record<string, any> {
  if (!previousModel || previousModel === nextModel) return {};
  const clears: Record<string, any> = {};

  if (previousModel === 'custom') {
    clears.promoterCommissionOverrides = {};
    clears.clearTierCommissions = true;
  }

  if (previousModel === 'salary') {
    clears.salaryTableIncentivesEnabled = false;
    clears.salaryTableIncentiveType = 'percent';
    clears.salaryTableIncentiveValue = 0;
    clears.salaryNotes = '';
  }

  return clears;
}

export async function ensurePromoterLink(
  db: any,
  promoterId: string,
  eventId: string,
  eventTitle: string,
  commissionRate: number,
  commissionType: 'percentage' | 'fixed' = 'percentage',
  tierCommissions: Record<string, { rate: number; type: 'percentage' | 'fixed' }> | null = null,
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
    const assignmentVersion = 2;
    const termsVersion = 2;
    const attributionSignature = signPromoterAttribution({
      assignmentId: linkId,
      assignmentVersion,
      termsVersion,
      promoterId,
      eventId,
      commissionRate,
      commissionType,
      ticketTierIds: [],
      tierCommissions,
    });

    const now = new Date().toISOString();
    if (!linkDoc.exists) {
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
        commissionType,
        tierCommissions,
        assignmentId: linkId,
        assignmentVersion,
        termsVersion,
        attributionSignature,
        code: trackingCode,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        commission: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Keep the link's payout-time commission in sync with the current
      // effective rate (standard flat rate, per-tier custom map, or salary's 0).
      await linkRef.set(
        {
          commissionRate,
          commissionType,
          tierCommissions,
          assignmentId: linkId,
          assignmentVersion,
          termsVersion,
          attributionSignature,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    return trackingCode || '';
  } catch (err: any) {
    console.error(`[ensurePromoterLink] Error: ${err.message}`);
    throw err;
  }
}

/** Legacy flat compensation fields — no longer written to the event document. */
const LEGACY_COMPENSATION_FIELDS = [
  'commission',
  'commissionType',
  'compensationModel',
  'promotersEnabled',
  'promoterCommissionOverrides',
  'tablesCommissionValue',
  'tablesCommissionType',
  'salaryTableIncentivesEnabled',
  'salaryTableIncentiveValue',
  'salaryTableIncentiveType',
  'salaryNotes',
] as const;

/** Removes legacy flat compensation fields in place — call right before persisting an event doc. */
function stripLegacyCompensationFields(target: Record<string, any>): void {
  for (const key of LEGACY_COMPENSATION_FIELDS) {
    delete target[key];
  }
}

/**
 * Normalises whatever shape the client sent for `promoters` (array of plain
 * ID strings, or partial `{promoterId}` objects) into the canonical
 * `{ promoterId, status: 'accepted' }[]` shape written to the event document.
 * Promoters on this array are, by definition, currently assigned/active —
 * pending/declined states live in `promoter_assignments`, not here.
 */
function normalizePromotersArray(raw: unknown): { promoterId: string; status: 'accepted' }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) => (typeof p === 'string' ? p : p?.promoterId))
    .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
    .map((promoterId: string) => ({ promoterId, status: 'accepted' as const }));
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
  /** Pass a V2 promoterCompensation object OR the legacy compensationModel string. */
  compensationModelOrPc: CompensationModel | any = 'standard',
  commissionType: 'percent' | 'fixed' = 'percent',
  tiers: EventTierCommissionInput[] = [],
  commissionOverrides: Record<string, PromoterTierCommissionOverrideInput> = {},
  tablesCommission: { type?: 'percent' | 'fixed'; value?: number } = {},
  salary: SalaryCompensationInput = {},
): Promise<void> {
  // Detect if called with a V2 pc object (new path) or legacy flat fields
  const isV2Call =
    compensationModelOrPc &&
    typeof compensationModelOrPc === 'object' &&
    compensationModelOrPc.schemaVersion === SCHEMA_VERSION;

  // Derive the flat fields needed for event_promoter_settings and legacy resolvers
  let compensationModel: CompensationModel;
  let effectivePc: any;

  if (isV2Call) {
    effectivePc = compensationModelOrPc;
    compensationModel = effectivePc.model || 'standard';
    const flat = flattenCompensationV2(effectivePc);
    commissionRate = flat.commission ?? commissionRate;
    commissionType = flat.commissionType ?? commissionType;
    tablesCommission = {
      type: flat.tablesCommissionType === 'fixed' ? 'fixed' : 'percent',
      value: flat.tablesCommissionValue ?? 0,
    };
    salary = {
      tableIncentivesEnabled: flat.salaryTableIncentivesEnabled,
      tableIncentiveType: flat.salaryTableIncentiveType,
      tableIncentiveValue: flat.salaryTableIncentiveValue,
      notes: flat.salaryNotes,
    };
    commissionOverrides = flat.promoterCommissionOverrides || {};
  } else {
    compensationModel = compensationModelOrPc as CompensationModel;
    effectivePc = null;
  }

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
        compensationModel,
        defaultCommission: commissionRate,
        defaultCommissionType: commissionType,
        tablesCommissionType: tablesCommission.type === 'fixed' ? 'fixed' : 'percent',
        tablesCommissionValue: tablesCommission.value || 0,
        salary: {
          tableIncentivesEnabled: !!salary.tableIncentivesEnabled,
          tableIncentiveType: salary.tableIncentiveType === 'fixed' ? 'fixed' : 'percent',
          tableIncentiveValue: salary.tableIncentiveValue || 0,
          notes: salary.notes || '',
        },
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

    // 2. Diff newly added / staying / removed promoters
    const newlyAdded = nextIds.filter((id) => !prevIds.includes(id));
    const staying = nextIds.filter((id) => prevIds.includes(id));
    const removed = prevIds.filter((id) => !nextIds.includes(id));
    const now = new Date().toISOString();

    const encryptedEventName = encrypt(eventName);
    const encryptedVenueName = encrypt(venueName);

    // 3. Create assignments for newly added promoters
    await Promise.all(
      newlyAdded.map(async (promoterId) => {
        const effective = isV2Call
          ? resolveEffectiveCommission(effectivePc, promoterId)
          : resolveEffectiveCommission(
              promoterId,
              compensationModel,
              commissionRate,
              commissionType,
              tiers,
              commissionOverrides,
            );
        const trackingCode = await ensurePromoterLink(
          db,
          promoterId,
          eventId,
          eventName,
          effective.rate,
          effective.type,
          effective.tierCommissions,
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
              commissionRate: effective.rate,
              commissionType: effective.type,
              tierCommissions: effective.tierCommissions,
              assignmentVersion: 2,
              termsVersion: 2,
              approvedByPartnerId:
                eventData?.hostId || eventData?.venueId || eventData?.creatorId || null,
              approvedAt: now,
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

    // 3b. Re-sync commission for promoters who remain assigned — this is what
    // makes a compensation-model switch or a standard-rate change automatically
    // flow through to every promoter, without resetting their sales totals.
    await Promise.all(
      staying.map(async (promoterId) => {
        const effective = isV2Call
          ? resolveEffectiveCommission(effectivePc, promoterId)
          : resolveEffectiveCommission(
              promoterId,
              compensationModel,
              commissionRate,
              commissionType,
              tiers,
              commissionOverrides,
            );
        await ensurePromoterLink(
          db,
          promoterId,
          eventId,
          eventName,
          effective.rate,
          effective.type,
          effective.tierCommissions,
        );
        const assignId = `${promoterId}_${eventId}`;
        await db
          .collection('promoter_assignments')
          .doc(assignId)
          .set(
            {
              commissionRate: effective.rate,
              commissionType: effective.type,
              tierCommissions: effective.tierCommissions,
              assignmentVersion: 2,
              termsVersion: 2,
              approvedByPartnerId:
                eventData?.hostId || eventData?.venueId || eventData?.creatorId || null,
              approvedAt: now,
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
    throw err;
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

          let partnerCtx;
          try {
            partnerCtx = await resolvePartnerContext(fastify.db, request);
          } catch {
            return reply.status(503).send(
              buildErrorResponse({
                code: 'AUTHORIZATION_UNAVAILABLE',
                message: 'Partner authorization is unavailable',
                requestId: request.id,
              }),
            );
          }
          if (!partnerCtx) {
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Events not found',
                requestId: request.id,
              }),
            );
          }
          const membership = (request.authContext?.memberships || []).find(
            (candidate: any) =>
              candidate.partnerId === partnerCtx.partnerId &&
              (candidate.isActive === true || candidate.status === 'active'),
          );
          const fallbackRole = partnerCtx.roles.some((role: string) => role.endsWith('_owner'))
            ? 'owner'
            : 'staff';
          if (
            !getPermissionsForRole(
              partnerCtx.type,
              String(membership?.role || fallbackRole),
            ).includes('MANAGE_EVENTS')
          ) {
            return reply.status(403).send(
              buildErrorResponse({
                code: 'PERMISSION_REQUIRED',
                message: 'MANAGE_EVENTS permission is required',
                requestId: request.id,
              }),
            );
          }
          if (
            (creatorId && creatorId !== partnerCtx.partnerId) ||
            (venueId && venueId !== partnerCtx.partnerId)
          ) {
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Events not found',
                requestId: request.id,
              }),
            );
          }

          let q: any = fastify.db.collection('events');
          q =
            partnerCtx.type === 'venue'
              ? q.where('venueId', '==', partnerCtx.partnerId)
              : q.where('creatorId', '==', partnerCtx.partnerId);

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
        const forceFresh = request.query?.fresh === 'true';
        if (forceFresh) {
          reply.header('Cache-Control', 'no-store');
        } else {
          applyPublicCacheHeaders(reply, 60);
        }

        const normalizedQuery = normalizeExploreEventsQuery(request.query || {});
        const rawCacheKey = `explore:v${EXPLORE_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(
          normalizedQuery,
        )}`;
        const cacheKey = await buildVersionedPublicCacheKey(fastify, 'events', rawCacheKey);
        const cached = forceFresh ? null : await fastify.cache.get('public-discovery', cacheKey);
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
      if (lat == null || lat === '' || lng == null || lng === '')
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

        // Backward-compat: normalise any v1-shaped stored promoterCompensation
        // before it reaches the client, so consumers only ever see the V2 shape.
        if (detail.event?.promoterCompensation) {
          detail.event.promoterCompensation = normalizeCompensationForRead(
            detail.event.promoterCompensation,
          );
        }

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
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
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
        // ── Build canonical V2 promoterCompensation ──────────────────────────
        const baseTickets = Array.isArray(request.body.tickets) ? request.body.tickets : [];
        let pc: any;

        if (request.body.promoterCompensation?.schemaVersion === SCHEMA_VERSION) {
          // Already V2 from the client (future-proof path)
          pc = request.body.promoterCompensation;
        } else if (request.body.promoterCompensation) {
          // V1 pc object sent — normalise to V2
          pc = normalizeCompensationForRead(request.body.promoterCompensation);
        } else {
          // Flat wizard fields — build V2 fresh
          pc = buildPromoterCompensationV2(request.body, baseTickets);
        }

        pc = stripFreeTicketCommissions(pc, baseTickets);
        pc.revenueSummary = calculateRevenueSummary(pc, baseTickets);
        request.body.promoterCompensation = pc;

        // Capture assigned promoter ids before normalising the array shape, then
        // write only the canonical { promoterId, status } shape + promoterCompensation.
        const bodyPromoters = normalizePromotersArray(request.body.promoters).map(
          (p) => p.promoterId,
        );
        request.body.promoters = normalizePromotersArray(request.body.promoters);
        stripLegacyCompensationFields(request.body);

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
        await fastify.publicDiscoveryService.syncEventReadModels(event.id);
        await fastify.revalidateGuestEvent(event.id, 'created');

        // Promoter attribution must be durable before the event mutation succeeds.
        const bodyPromotersEnabled = pc.enabled ?? false;

        await syncEventPromoters(
          fastify.db,
          event.id,
          event.title || 'Untitled Event',
          event.venueName || event.venue || '',
          bodyPromoters,
          bodyPromotersEnabled,
          0, // commissionRate — overridden by V2 pc inside syncEventPromoters
          request.body.creatorRole || 'venue',
          pc, // V2 promoterCompensation object
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

      const existingEventDoc = await fastify.db.collection('events').doc(id).get();
      if (!existingEventDoc.exists) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );
      }
      const existingEventSnap = existingEventDoc.data() as Record<string, any>;

      let partnerCtx;
      try {
        partnerCtx = await resolvePartnerContext(fastify.db, request);
      } catch (error: any) {
        request.log.error({ error }, 'Unable to resolve event update authorization');
        return reply.status(503).send(
          buildErrorResponse({
            code: 'AUTHORIZATION_UNAVAILABLE',
            message: 'Partner authorization is unavailable',
            requestId: request.id,
          }),
        );
      }
      if (!partnerCtx || !['host', 'venue'].includes(partnerCtx.type)) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );
      }
      const membership = (request.authContext?.memberships || []).find(
        (candidate: any) =>
          candidate.partnerId === partnerCtx.partnerId &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const fallbackRole = partnerCtx.roles.some((role: string) => role.endsWith('_owner'))
        ? 'owner'
        : 'staff';
      if (
        !getPermissionsForRole(partnerCtx.type, String(membership?.role || fallbackRole)).includes(
          'MANAGE_EVENTS',
        )
      ) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'PERMISSION_REQUIRED',
            message: 'MANAGE_EVENTS permission is required',
            requestId: request.id,
          }),
        );
      }
      const authorizedPartnerIds = new Set(
        [
          existingEventSnap.workspaceId,
          existingEventSnap.creatorId,
          existingEventSnap.hostId,
          existingEventSnap.venueId,
        ].filter(Boolean),
      );
      if (!authorizedPartnerIds.has(partnerCtx.partnerId)) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Event not found',
            requestId: request.id,
          }),
        );
      }
      const workspaceId: string =
        existingEventSnap.workspaceId ||
        existingEventSnap.creatorId ||
        existingEventSnap.hostId ||
        partnerCtx.partnerId;

      // Unwrap wizard auto-save envelope { actor, updates } → use updates as the patch body
      const rawBody: any = request.body;
      const submittedPatch: Record<string, unknown> =
        rawBody?.updates && typeof rawBody.updates === 'object' ? rawBody.updates : rawBody;
      const protectedFields = Object.keys(submittedPatch).filter((field) =>
        PROTECTED_EVENT_UPDATE_FIELDS.has(field),
      );
      if (protectedFields.length > 0) {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'PROTECTED_EVENT_FIELD',
            message: `Protected event fields cannot be patched: ${protectedFields.join(', ')}`,
            requestId: request.id,
          }),
        );
      }
      const patchFields: Record<string, any> = { ...submittedPatch };
      const action = rawBody?.updates ? rawBody.action : undefined;
      if (action === 'submit') {
        return reply.status(400).send(
          buildErrorResponse({
            code: 'EVENT_COMMAND_REQUIRED',
            message: 'Host submission must use the host event submission command',
            requestId: request.id,
          }),
        );
      }
      if (action === 'publish') {
        if (partnerCtx.type !== 'venue' || existingEventSnap.venueId !== partnerCtx.partnerId) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'PERMISSION_REQUIRED',
              message: 'Only the assigned venue can publish this event',
              requestId: request.id,
            }),
          );
        }
        patchFields.lifecycle = 'scheduled';
        patchFields.status = 'active';
        patchFields.visibility = 'public';
        patchFields.publishedAt = new Date().toISOString();
      }

      // --- Promoter compensation validation + stale-model cleanup ---
      // Runs before the event is persisted so an invalid publish attempt never
      // saves, and so switching models clears the previous model's fields on
      // the event doc itself instead of relying on the client to resend them.
      const patchIsPublishing =
        patchFields.lifecycle === 'scheduled' || patchFields.lifecycle === 'submitted';
      const touchesCompensation =
        patchFields.promoters !== undefined ||
        patchFields.promotersEnabled !== undefined ||
        patchFields.commission !== undefined ||
        patchFields.commissionType !== undefined ||
        patchFields.compensationModel !== undefined ||
        patchFields.promoterCommissionOverrides !== undefined ||
        patchFields.tickets !== undefined ||
        patchFields.tablesCommissionType !== undefined ||
        patchFields.tablesCommissionValue !== undefined ||
        patchFields.salaryTableIncentivesEnabled !== undefined ||
        patchFields.salaryNotes !== undefined ||
        patchIsPublishing;

      let preEventData: any = existingEventSnap;
      if (!preEventData) {
        const preEventSnap = await fastify.db
          .collection('events')
          .doc(id)
          .get()
          .catch(() => null);
        preEventData = preEventSnap?.exists ? preEventSnap.data() : null;
      }

      // ── Build/normalise V2 promoterCompensation for patch ──────────────────
      const baseTickets = Array.isArray(patchFields.tickets)
        ? patchFields.tickets
        : Array.isArray(preEventData?.tickets)
          ? preEventData.tickets
          : [];

      if (patchFields.promoterCompensation) {
        // Incoming pc object — normalise to V2
        const incomingPc = patchFields.promoterCompensation;
        patchFields.promoterCompensation = stripFreeTicketCommissions(
          incomingPc.schemaVersion === SCHEMA_VERSION
            ? incomingPc
            : normalizeCompensationForRead(incomingPc),
          baseTickets,
        );
        patchFields.promoterCompensation.revenueSummary = calculateRevenueSummary(
          patchFields.promoterCompensation,
          baseTickets,
        );
      } else if (touchesCompensation) {
        // Flat compensation fields changed — merge with existing and build V2
        const existingPc = preEventData?.promoterCompensation
          ? normalizeCompensationForRead(preEventData.promoterCompensation)
          : null;
        const existingFlat = existingPc ? flattenCompensationV2(existingPc) : {};

        const mergedFormData = {
          compensationModel:
            patchFields.compensationModel ?? existingFlat.compensationModel ?? 'standard',
          promotersEnabled: patchFields.promotersEnabled ?? existingFlat.promotersEnabled ?? false,
          commission: patchFields.commission ?? existingFlat.commission ?? 0,
          commissionType: patchFields.commissionType ?? existingFlat.commissionType ?? 'percent',
          tablesCommissionValue:
            patchFields.tablesCommissionValue ?? existingFlat.tablesCommissionValue,
          tablesCommissionType:
            patchFields.tablesCommissionType ?? existingFlat.tablesCommissionType ?? 'percent',
          promoterCommissionOverrides:
            patchFields.promoterCommissionOverrides ??
            existingFlat.promoterCommissionOverrides ??
            {},
          salaryTableIncentivesEnabled:
            patchFields.salaryTableIncentivesEnabled ??
            existingFlat.salaryTableIncentivesEnabled ??
            false,
          salaryTableIncentiveValue:
            patchFields.salaryTableIncentiveValue ?? existingFlat.salaryTableIncentiveValue ?? 0,
          salaryTableIncentiveType:
            patchFields.salaryTableIncentiveType ??
            existingFlat.salaryTableIncentiveType ??
            'percent',
          salaryNotes: patchFields.salaryNotes ?? existingFlat.salaryNotes ?? '',
        };

        patchFields.promoterCompensation = buildPromoterCompensationV2(mergedFormData, baseTickets);
        patchFields.promoterCompensation.revenueSummary = calculateRevenueSummary(
          patchFields.promoterCompensation,
          baseTickets,
        );
      }

      if (touchesCompensation) {
        const preSettingsDoc = await fastify.db
          .collection('event_promoter_settings')
          .doc(id)
          .get()
          .catch(() => null);
        const preSettingsData: any = preSettingsDoc?.exists ? preSettingsDoc.data() : null;

        const previousCompensationModel: CompensationModel | undefined =
          preSettingsData?.compensationModel;

        if (
          patchFields.compensationModel &&
          patchFields.compensationModel !== previousCompensationModel
        ) {
          const clears = computeModelSwitchClears(
            previousCompensationModel,
            patchFields.compensationModel,
          );

          if (clears.clearTierCommissions) {
            const baseTickets: any[] = Array.isArray(patchFields.tickets)
              ? patchFields.tickets
              : Array.isArray(preEventData?.tickets)
                ? preEventData.tickets
                : [];
            patchFields.tickets = baseTickets.map(
              ({ commissionValue, commissionType, ...rest }: any) => rest,
            );
            delete clears.clearTierCommissions;
          }

          for (const [key, value] of Object.entries(clears)) {
            if (patchFields[key] === undefined) patchFields[key] = value;
          }
        }

        // Validate directly against the canonical V2 object built above — the
        // shape that is actually about to be persisted.
        const compensationValidationError = validateCompensationPayload(
          patchFields.promoterCompensation,
          patchIsPublishing,
        );
        if (compensationValidationError) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: compensationValidationError,
              requestId: request.id,
            }),
          );
        }
      }

      // Normalise the assigned-promoters array shape and drop legacy flat
      // fields — only promoterCompensation + promoters get persisted.
      if (patchFields.promoters !== undefined) {
        patchFields.promoters = normalizePromotersArray(patchFields.promoters);
      }
      stripLegacyCompensationFields(patchFields);

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
        await fastify.publicDiscoveryService.syncEventReadModels(event.id);
        await fastify.revalidateGuestEvent(event.id, 'updated');

        if (touchesCompensation) {
          const settingsDoc = await fastify.db
            .collection('event_promoter_settings')
            .doc(id)
            .get()
            .catch(() => null);
          const prevIds: string[] =
            (settingsDoc?.exists ? (settingsDoc.data() as any)?.allowedPromoterIds : null) ?? [];

          // Promoter attribution is part of the authoritative event mutation.
          const resolvedPc = patchFields.promoterCompensation
            ? patchFields.promoterCompensation
            : preEventData?.promoterCompensation
              ? normalizeCompensationForRead(preEventData.promoterCompensation)
              : buildPromoterCompensationV2(patchFields, baseTickets);

          const bodyPromotersNorm = Array.isArray(patchFields.promoters)
            ? patchFields.promoters.map((p: any) => (typeof p === 'string' ? p : p.promoterId))
            : prevIds;
          const bodyPromotersEnabled = resolvedPc.enabled ?? false;

          await syncEventPromoters(
            fastify.db,
            id,
            event.title || 'Untitled Event',
            event.venueName || event.venue || '',
            bodyPromotersNorm,
            bodyPromotersEnabled,
            0, // overridden by V2 pc
            event.creatorRole || 'venue',
            resolvedPc,
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
      await fastify.publicDiscoveryService.syncEventReadModels(id);
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
      let partnerCtx;
      try {
        partnerCtx = await resolvePartnerContext(fastify.db, request);
      } catch (error: any) {
        request.log.error({ error }, 'Unable to resolve event creator partner context');
        return reply.status(503).send(
          buildErrorResponse({
            code: 'AUTHORIZATION_UNAVAILABLE',
            message: 'Partner authorization is unavailable',
            requestId: request.id,
          }),
        );
      }
      if (!partnerCtx || !['host', 'venue'].includes(partnerCtx.type)) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'PARTNER_SCOPE_REQUIRED',
            message: 'An active host or venue membership is required',
            requestId: request.id,
          }),
        );
      }
      const membership = (request.authContext?.memberships || []).find(
        (candidate: any) =>
          candidate.partnerId === partnerCtx.partnerId &&
          (candidate.isActive === true || candidate.status === 'active'),
      );
      const fallbackRole = partnerCtx.roles.some((role: string) => role.endsWith('_owner'))
        ? 'owner'
        : 'staff';
      const permissions = getPermissionsForRole(
        partnerCtx.type,
        String(membership?.role || fallbackRole),
      );
      if (!permissions.includes('MANAGE_EVENTS')) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'PERMISSION_REQUIRED',
            message: 'MANAGE_EVENTS permission is required',
            requestId: request.id,
          }),
        );
      }

      const creatorRole = partnerCtx.type;
      const creatorPartnerId = partnerCtx.partnerId;
      let hostId: string = creatorPartnerId;
      const isDraft: boolean = body.lifecycle === 'draft';
      body.creatorRole = creatorRole;
      body.creatorId = creatorPartnerId;
      body.workspaceId = creatorPartnerId;
      body.hostId = creatorPartnerId;
      if (creatorRole === 'venue') body.venueId = creatorPartnerId;

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
      // --- Resolve host–venue selection ---
      if (creatorRole === 'host' && body.venueId) {
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
      if (creatorRole === 'host' && body.venueId && !isDraft) {
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
        if (creatorRole === 'host') {
          body.lifecycle = 'submitted';
          // visibility stays as-is (will be set to 'public' when venue approves)
        } else if (creatorRole === 'venue') {
          body.lifecycle = 'scheduled';
          body.visibility = 'public'; // Venue events self-approve — stamp public immediately
        }
      }

      // ── Build canonical V2 promoterCompensation ──────────────────────────
      const baseTickets = Array.isArray(body.tickets) ? body.tickets : [];
      let pcBody: any;

      if (body.promoterCompensation?.schemaVersion === SCHEMA_VERSION) {
        pcBody = body.promoterCompensation;
      } else if (body.promoterCompensation) {
        pcBody = normalizeCompensationForRead(body.promoterCompensation);
      } else {
        pcBody = buildPromoterCompensationV2(body, baseTickets);
      }
      pcBody = stripFreeTicketCommissions(pcBody, baseTickets);

      // --- Promoter compensation validation (0-100%, no negative, custom tiers required to publish) ---
      // Validated against the canonical V2 object — the shape actually persisted.
      if (body.promotersEnabled) {
        const compensationValidationError = validateCompensationPayload(pcBody, !isDraft);
        if (compensationValidationError) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: compensationValidationError,
              requestId: request.id,
            }),
          );
        }
      }

      pcBody.revenueSummary = calculateRevenueSummary(pcBody, baseTickets);
      body.promoterCompensation = pcBody;

      // Capture assigned promoter ids before normalising the array shape, then
      // write only the canonical { promoterId, status } shape + promoterCompensation.
      const bodyPromoterIds = normalizePromotersArray(body.promoters).map((p) => p.promoterId);
      body.promoters = normalizePromotersArray(body.promoters);
      stripLegacyCompensationFields(body);

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

        body.creatorRole = creatorRole;
        body.creatorId = creatorPartnerId;
        body.workspaceId = creatorPartnerId;
        body.hostId = creatorPartnerId;
        if (creatorRole === 'venue') body.venueId = creatorPartnerId;

        const slotRecord =
          body.venueId && !isDraft
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
                source: creatorRole === 'host' ? 'host_event_request' : 'venue_self_booking',
                status: creatorRole === 'host' ? 'pending' : 'booked',
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
        await fastify.revalidateGuestEvent(event.id, 'created');

        // Promoter attribution must be durable before creation returns.
        const bodyPromotersEnabled = pcBody.enabled ?? false;

        await syncEventPromoters(
          fastify.db,
          event.id,
          eventRecord.title || 'Untitled Event',
          eventRecord.venueName || eventRecord.venue || '',
          bodyPromoterIds,
          bodyPromotersEnabled,
          0, // overridden by V2 pc
          body.creatorRole || 'venue',
          pcBody,
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
        await fastify.publicDiscoveryService.syncEventReadModels(id);
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
    compensationModel: z.string().optional(),
    commission: z.number().optional(),
    commissionType: z.string().optional(),
    tablesCommissionType: z.string().optional(),
    tablesCommissionValue: z.number().optional(),
    salaryTableIncentivesEnabled: z.boolean().optional(),
    salaryTableIncentiveType: z.string().optional(),
    salaryTableIncentiveValue: z.number().optional(),
    discount: z.number().optional(),
    discountType: z.string().optional(),
    tickets: z
      .array(
        z.object({
          name: z.string().optional(),
          price: z.number(),
          quantity: z.number(),
          commissionType: z.string().optional(),
          commissionValue: z.number().optional(),
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
      const compensationModel = fd.compensationModel || 'standard';

      // Read commission rates from the canonical V2 `defaults` shape instead of
      // re-deriving per-model field names ad hoc. Custom-model per-tier rates
      // still come straight off each tier — this preview payload has no stable
      // ticketTierId to match `defaults.ticketCommissions` entries against.
      const previewPc = buildPromoterCompensationV2(fd, []);
      const defaults: any = previewPc.defaults || {};

      const computeTier = (tier: any, type: 'ticket' | 'table') => {
        const price = Number(tier.price) || 0;
        const quantity = Number(tier.quantity) || 0;
        const value = price * quantity;
        const isFree = price === 0;

        let commTotal = 0,
          commRate = 0,
          commType = 'percent';
        if (promotersEnabled && !isFree) {
          if (compensationModel === 'salary') {
            // Ticket commissions are disabled under Salary; table sales may
            // still earn an optional incentive.
            if (type === 'table' && defaults.tableIncentive?.enabled) {
              commRate = Number(defaults.tableIncentive.value) || 0;
              commType = fromRateType(defaults.tableIncentive.type);
            }
          } else if (compensationModel === 'custom') {
            if (type === 'ticket') {
              commRate = Number(tier.commissionValue) || 0;
              commType = tier.commissionType || 'percent';
            } else {
              commRate = Number(defaults.tableCommission?.value) || 0;
              commType = defaults.tableCommission
                ? fromRateType(defaults.tableCommission.type)
                : 'percent';
            }
          } else {
            // standard
            if (type === 'ticket') {
              commRate = Number(defaults.ticketCommission?.value) || 15;
              commType = defaults.ticketCommission
                ? fromRateType(defaults.ticketCommission.type)
                : 'percent';
            } else {
              commRate = defaults.tableCommission
                ? Number(defaults.tableCommission.value)
                : Number(defaults.ticketCommission?.value) || 15;
              commType = defaults.tableCommission
                ? fromRateType(defaults.tableCommission.type)
                : defaults.ticketCommission
                  ? fromRateType(defaults.ticketCommission.type)
                  : 'percent';
            }
          }
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

/**
 * THE C1RCLE - Master Inventory Engine
 * Production-grade inventory management with cart reservations, holdbacks, and atomic operations.
 * Unified source of truth for Apps, API, and Functions.
 */

import { randomUUID } from 'node:crypto';
import { getRedisClient } from './redis.js';
import { getAdminDb } from './admin.js';
import { PUBLIC_LIFECYCLE_STATES } from './events.js';
import { getEffectivePrice } from './pricing-engine.js';
import { resolveFiniteInventoryRead } from './inventory-v2-engine.js';

// ---------------------------------------------------------------------------
// Typed error classes — callers must catch these and return HTTP 503
// ---------------------------------------------------------------------------
export class InventoryUnavailableError extends Error {
  constructor(message = 'Inventory service unavailable') {
    super(message);
    this.name = 'InventoryUnavailableError';
  }
}
export class LockAcquisitionError extends Error {
  constructor(message = 'Could not acquire inventory lock') {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}
export class ReservationCommitError extends Error {
  constructor(message = 'Failed to commit reservation to Redis') {
    super(message);
    this.name = 'ReservationCommitError';
  }
}
export class InventoryReadError extends Error {
  constructor(message = 'Failed to read effective inventory') {
    super(message);
    this.name = 'InventoryReadError';
  }
}

// ---------------------------------------------------------------------------
// Redis circuit breaker — opens after 3 errors in 30s, half-opens after 30s
// ---------------------------------------------------------------------------
const _circuit = {
  failures: 0,
  lastFailureAt: 0,
  openAt: 0,
  THRESHOLD: 3,
  RESET_MS: 10_000,
};

function circuitIsOpen() {
  if (_circuit.openAt === 0) return false;
  if (Date.now() - _circuit.openAt >= _circuit.RESET_MS) {
    // Half-open: allow one probe
    _circuit.openAt = 0;
    return false;
  }
  return true;
}

function recordCircuitSuccess() {
  _circuit.failures = 0;
  _circuit.openAt = 0;
  _circuit.lastFailureAt = 0;
}

function recordCircuitFailure() {
  const now = Date.now();
  if (now - _circuit.lastFailureAt > _circuit.RESET_MS) {
    _circuit.failures = 0;
  }
  _circuit.failures += 1;
  _circuit.lastFailureAt = now;
  if (_circuit.failures >= _circuit.THRESHOLD && _circuit.openAt === 0) {
    _circuit.openAt = now;
    console.error(
      '[Inventory] Redis circuit OPEN after repeated failures — all reservations will fail until circuit resets',
    );
  }
}

// Cart reservation timeout (default 10 minutes)
const DEFAULT_RESERVATION_MINUTES = 10;

// Shard configuration for Firestore sharded counters
const NUM_SHARDS = 10;
const PUBLIC_TICKET_EVENT_LIFECYCLES = new Set(PUBLIC_LIFECYCLE_STATES);
const HIDDEN_TICKET_STATUSES = new Set(['hidden', 'disabled', 'inactive', 'deleted', 'archived']);

/**
 * REDIS KEYS:
 * res:data:{id} -> JSON reservation object (EX: 10m)
 * res:event:{eventId}:tier:{tierId} -> Set of active reservation IDs for a specific tier
 * inv:lock:{eventId} -> Mutex for atomic inventory checks
 */
const REDIS_RES_PREFIX = 'res:data:';
const REDIS_TIER_RES_PREFIX = 'res:event:';

// Internal helper for inventory calculations
function getBaseRemaining(tier) {
  const inv = tier.inventory || {};
  const totalCapacity = Number(
    inv.totalQuantity ?? tier.totalQuantity ?? tier.quantity ?? tier.capacity ?? 0,
  );
  const sold = Number(inv.soldQuantity ?? tier.soldQuantity ?? tier.sold ?? tier.soldCount ?? 0);

  let holdbackQuantity = 0;
  if (inv.holdbacks && Array.isArray(inv.holdbacks)) {
    const now = new Date();
    for (const h of inv.holdbacks) {
      if (h.expiresAt && new Date(h.expiresAt) < now) continue;
      holdbackQuantity += Number(h.quantity || 0);
    }
  }

  const legacyRemaining = tier.remaining !== undefined ? Number(tier.remaining) : null;

  const calculatedRemaining =
    legacyRemaining !== null && inv.soldQuantity === undefined && tier.sold === undefined
      ? legacyRemaining
      : Math.max(0, totalCapacity - sold - holdbackQuantity);

  return resolveFiniteInventoryRead({
    tier,
    legacyRemaining: calculatedRemaining,
  }).remaining;
}

function getTicketTiers(event = {}) {
  const catalogTiers = Array.isArray(event.ticketCatalog?.tiers) ? event.ticketCatalog.tiers : [];
  const legacyTiers = Array.isArray(event.tickets) ? event.tickets : [];
  return catalogTiers.length > 0 ? catalogTiers : legacyTiers;
}

function timestampMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(parsed)) return null;
  return typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : parsed;
}

function isPublicTicketEvent(event = {}, now = new Date()) {
  if (event.isPrivate || event.isDeleted) return false;
  const visibility = String(
    event.visibility || event.settings?.visibility || 'public',
  ).toLowerCase();
  if (visibility && visibility !== 'public') return false;

  const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  if (!PUBLIC_TICKET_EVENT_LIFECYCLES.has(lifecycle)) return false;

  const cutoffValue = event.endDate ?? event.endAt ?? event.startDate ?? event.startAt ?? event.date;
  if (cutoffValue !== undefined && cutoffValue !== null && cutoffValue !== '') {
    const cutoff = timestampMillis(cutoffValue);
    if (cutoff === null || cutoff <= now.getTime()) return false;
  }
  return true;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getSaleStatus(tier = {}, now = new Date()) {
  const startsAt = toIsoOrNull(tier.salesStart || tier.saleWindow?.startsAt);
  const endsAt = toIsoOrNull(tier.salesEnd || tier.saleWindow?.endsAt);
  const nowTime = now.getTime();

  if (startsAt && nowTime < new Date(startsAt).getTime()) return 'not_started';
  if (endsAt && nowTime > new Date(endsAt).getTime()) return 'ended';
  return 'active';
}

function getTierStatus(tier = {}) {
  return String(tier.status || tier.lifecycle || '').toLowerCase();
}

function isTierVisible(tier = {}) {
  const status = getTierStatus(tier);
  if (HIDDEN_TICKET_STATUSES.has(status)) return false;
  if (tier.isHidden === true || tier.hidden === true || tier.isDeleted === true) return false;
  return true;
}

function getTierCapacity(tier = {}) {
  const inv = tier.inventory || {};
  const raw = inv.totalQuantity ?? tier.totalQuantity ?? tier.quantity ?? tier.capacity ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function getTierSoldQuantity(tier = {}) {
  const inv = tier.inventory || {};
  const raw = inv.soldQuantity ?? tier.soldQuantity ?? tier.sold ?? tier.soldCount ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getMaxPerOrder(tier = {}, event = {}, remaining = 0) {
  const raw =
    tier.limits?.maxPerOrder ??
    tier.maxPerOrder ??
    event.maxTicketsPerOrder ??
    (Number(tier.basePrice ?? tier.price ?? 0) <= 0 ? 1 : 10);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.min(value, remaining));
}

function formatInr(amount = 0) {
  return `INR ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function normalizeTicketTier(tier, event, remaining, timestamp) {
  const priceInfo = getEffectivePrice(tier, timestamp);
  const price = Number(priceInfo.price || 0);
  const saleStatus = getSaleStatus(tier, timestamp);
  const status = getTierStatus(tier) || null;
  const isUnlimited = (tier.inventory?.type || tier.type) === 'unlimited';
  const safeRemaining = isUnlimited ? null : Math.max(0, Number(remaining) || 0);
  const soldOut = !isUnlimited && safeRemaining <= 0;
  const salesActive = saleStatus === 'active';

  return {
    id: String(tier.id || tier.tierId),
    tierId: String(tier.id || tier.tierId),
    name: tier.name || tier.label || 'Ticket',
    description: tier.description || tier.summary || null,
    entryType: tier.entryType || tier.type || null,
    currency: tier.currency || event.currency || event.priceRange?.currency || 'INR',
    price,
    unitPrice: price,
    basePrice: Number(tier.basePrice ?? tier.price ?? price),
    formattedPrice: price <= 0 ? 'Free' : formatInr(price),
    priceLabel: priceInfo.label || null,
    isScheduledPrice: Boolean(priceInfo.isScheduled),
    totalQuantity: isUnlimited ? null : getTierCapacity(tier),
    soldQuantity: isUnlimited ? null : getTierSoldQuantity(tier),
    remaining: safeRemaining,
    availableQuantity: safeRemaining,
    isUnlimited,
    isFree: price <= 0,
    isSoldOut: soldOut,
    soldOut,
    isAvailable: salesActive && !soldOut && !HIDDEN_TICKET_STATUSES.has(status || ''),
    saleStatus,
    salesStart: toIsoOrNull(tier.salesStart || tier.saleWindow?.startsAt),
    salesEnd: toIsoOrNull(tier.salesEnd || tier.saleWindow?.endsAt),
    minPerOrder: Math.max(0, Number(tier.limits?.minPerOrder ?? tier.minPerOrder ?? 0) || 0),
    maxPerOrder: getMaxPerOrder(tier, event, safeRemaining ?? Number.MAX_SAFE_INTEGER),
    status,
  };
}

function normalizeReservationItems(items = []) {
  return items
    .map((item) => ({
      tierId: item?.tierId || item?.id || null,
      quantity: Number(item?.quantity || 0),
    }))
    .filter((item) => item.tierId && item.quantity > 0)
    .sort((a, b) => String(a.tierId).localeCompare(String(b.tierId)));
}

function reservationItemsMatch(left = [], right = []) {
  const normalizedLeft = normalizeReservationItems(left);
  const normalizedRight = normalizeReservationItems(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function reservationCheckoutSnapshotsMatch(left, right) {
  if (right === undefined || right === null) return true;
  if (left === undefined || left === null) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function isReservationUsable(reservation) {
  if (!reservation || reservation.status !== 'active') return false;
  if (!reservation.expiresAt) return true;
  return new Date(reservation.expiresAt) > new Date();
}

async function removeTrackedReservation(redis, reservationId, reservation, userResKey = null) {
  const multi = redis.multi();
  multi.del(`${REDIS_RES_PREFIX}${reservationId}`);

  for (const item of reservation?.items || []) {
    if (!item?.tierId) continue;
    multi.srem(`${REDIS_TIER_RES_PREFIX}${reservation.eventId}:tier:${item.tierId}`, reservationId);
  }

  if (userResKey) {
    multi.srem(userResKey, reservationId);
  } else if (
    reservation?.customerId &&
    reservation.customerId !== 'anonymous' &&
    reservation?.eventId
  ) {
    multi.srem(`res:user:${reservation.customerId}:event:${reservation.eventId}`, reservationId);
  }

  try {
    await multi.exec();
  } catch (e) {
    console.warn('[Redis] Failed to clean up stale reservation:', e.message);
  }
}

/**
 * Calculate effective inventory for a tier.
 * Accounts for:
 * 1. Base remaining (from Firestore doc)
 * 2. Holdbacks (manually held tickets)
 * 3. Redis Cart Reservations (live carts)
 * 4. (Optional) Firestore Shard Aggregation (for high-concurrency sold counts)
 */
export async function calculateEffectiveInventory(
  tier,
  event,
  excludeReservationId = null,
  db = null,
  strictMode = false,
) {
  // 1. Unlimited inventory
  if ((tier.inventory?.type || tier.type) === 'unlimited') return Infinity;

  // 2. Get base remaining quantity.
  let remaining = getBaseRemaining(tier);

  // 3. Sharded counters (Functions mode) — authoritative sold count correction
  if (db) {
    let soldFromShards = 0;
    const shardsRef = db
      .collection('events')
      .doc(event.id)
      .collection('ticket_shards')
      .where('tierId', '==', tier.id);
    const snapshot = await shardsRef.get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      soldFromShards += data.soldQuantity || 0;
    });
    // If sharded count exists, it overrides the document-level sold count
    if (soldFromShards > 0) {
      const totalCapacity = Number(
        tier.inventory?.totalQuantity ?? tier.totalQuantity ?? tier.quantity ?? tier.capacity ?? 0,
      );
      const sold = Number(
        tier.inventory?.soldQuantity ?? tier.soldQuantity ?? tier.sold ?? tier.soldCount ?? 0,
      );

      let holdbackQuantity = 0;
      if (tier.inventory?.holdbacks && Array.isArray(tier.inventory.holdbacks)) {
        const now = new Date();
        for (const h of tier.inventory.holdbacks) {
          if (h.expiresAt && new Date(h.expiresAt) < now) continue;
          holdbackQuantity += Number(h.quantity || 0);
        }
      }

      remaining = Math.max(0, totalCapacity - (sold + soldFromShards) - holdbackQuantity);
    }
  }

  // 5. Subtract active cart reservations from Redis.
  // strictMode = true (high-demand events): throw InventoryUnavailableError when Redis is down
  //   so callers return 503 instead of overselling from stale Firestore counts.
  // strictMode = false (default): fail-open to Firestore base count to avoid blocking all sales.
  if (circuitIsOpen()) {
    if (strictMode)
      throw new InventoryUnavailableError(
        'Redis circuit open — cannot guarantee accurate inventory',
      );
    console.warn('[Inventory] Degraded mode: Redis circuit open, using Firestore base count only');
    return Math.max(0, remaining);
  }
  try {
    const redis = getRedisClient();
    if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
      const tierResKey = `${REDIS_TIER_RES_PREFIX}${event.id}:tier:${tier.id}`;
      const activeResIds = await redis.smembers(tierResKey);

      for (const resId of activeResIds) {
        if (resId === excludeReservationId) continue;
        const resData = await redis.get(`${REDIS_RES_PREFIX}${resId}`);
        if (!resData) {
          redis.srem(tierResKey, resId).catch(() => {});
          continue;
        }
        const reservation = JSON.parse(resData);
        const item = reservation.items.find((i) => i.tierId === tier.id);
        if (item) remaining -= item.quantity;
      }
      recordCircuitSuccess();
    } else {
      recordCircuitFailure();
      if (strictMode)
        throw new InventoryUnavailableError(
          'Redis not ready — cannot guarantee accurate inventory',
        );
      console.warn(
        '[Inventory] Degraded mode: Redis client not ready, using Firestore base count only',
      );
      return Math.max(0, remaining);
    }
  } catch (e) {
    if (e instanceof InventoryUnavailableError) throw e;
    if (e instanceof InventoryReadError) throw e;
    recordCircuitFailure();
    if (strictMode)
      throw new InventoryUnavailableError(
        `Redis unavailable — cannot guarantee accurate inventory: ${e.message}`,
      );
    console.warn(
      '[Inventory] Degraded mode: Redis unavailable, using Firestore base count only:',
      e.message,
    );
    return Math.max(0, remaining);
  }

  return Math.max(0, remaining);
}

/**
 * Public ticket tier read model for mobile event detail screens.
 * Returns guest-safe tier data with live prices and effective inventory.
 */
export async function listAvailableTicketTiers(db, eventId, options = {}) {
  if (!db?.collection) throw new Error('Firestore db is required');
  if (!eventId) throw new Error('eventId is required');

  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp
      : new Date(options.timestamp || Date.now());
  const eventRef = db.collection('events').doc(String(eventId));
  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) return null;

  const event = { id: eventDoc.id || String(eventId), ...(eventDoc.data() || {}) };
  if (!isPublicTicketEvent(event, timestamp)) return null;

  const inventoryDb = typeof eventRef.collection === 'function' ? db : null;
  const tiers = getTicketTiers(event)
    .map((tier) => ({ ...tier, id: tier?.id || tier?.tierId }))
    .filter((tier) => tier.id && isTierVisible(tier))
    .sort((a, b) => {
      const aOrder = Number(a.displayOrder ?? a.sortOrder ?? a.order ?? 0);
      const bOrder = Number(b.displayOrder ?? b.sortOrder ?? b.order ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });

  const normalizedTiers = await Promise.all(
    tiers.map(async (tier) => {
      const remaining = await calculateEffectiveInventory(
        tier,
        event,
        options.excludeReservationId || null,
        inventoryDb,
        Boolean(options.strictMode),
      );
      return normalizeTicketTier(tier, event, remaining, timestamp);
    }),
  );

  const availableTiers = normalizedTiers.filter((tier) => tier.isAvailable);
  return {
    eventId: event.id,
    currency: event.currency || event.priceRange?.currency || 'INR',
    tiers: normalizedTiers,
    availableTiers,
    count: normalizedTiers.length,
    availableCount: availableTiers.length,
    hasAvailableTickets: availableTiers.length > 0,
    soldOut: normalizedTiers.length > 0 && availableTiers.length === 0,
    generatedAt: timestamp.toISOString(),
  };
}

/**
 * Main availability and restriction check
 */
export async function validatePurchase(event, items, options = {}) {
  const {
    timestamp = new Date(),
    userId = null,
    deviceId = null,
    db = null, // Provide Firestore db instance for sharded check
    strictMode = false, // true = throw on Redis unavailability (high-demand events)
  } = options;

  const results = [];
  let allValid = true;

  for (const item of items) {
    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const tier = tiers.find((t) => t.id === item.tierId);

    if (!tier) {
      results.push({ tierId: item.tierId, valid: false, error: 'Tier not found' });
      allValid = false;
      continue;
    }

    // 1. Sales Window Check
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const startsAt = new Date(tier.salesStart || tier.saleWindow?.startsAt || 0);
    const endsAt = new Date(tier.salesEnd || tier.saleWindow?.endsAt || '2099-01-01');

    if (now < startsAt) {
      results.push({ tierId: tier.id, valid: false, error: `Sales haven't started` });
      allValid = false;
      continue;
    }
    if (now > endsAt) {
      results.push({ tierId: tier.id, valid: false, error: `Sales have ended` });
      allValid = false;
      continue;
    }

    // 2. Inventory Check
    const available = await calculateEffectiveInventory(tier, event, null, db, strictMode);
    if (item.quantity > available) {
      results.push({ tierId: tier.id, valid: false, error: `Only ${available} left` });
      allValid = false;
      continue;
    }

    // 3. Purchase Limit Check (Simpified for MVP)
    const maxPerOrder = tier.limits?.maxPerOrder || 10;
    if (item.quantity > maxPerOrder) {
      results.push({ tierId: tier.id, valid: false, error: `Max ${maxPerOrder} per order` });
      allValid = false;
      continue;
    }

    results.push({ tierId: tier.id, valid: true, available });
  }

  return { success: allValid, items: results };
}

/**
 * Create a cart reservation with REDIS ATOMICITY
 */
export async function createReservation(event, customerId, deviceId, items, options = {}) {
  const { reservationMinutes = DEFAULT_RESERVATION_MINUTES } = options;
  const redis = getRedisClient();
  const reservationId = randomUUID();
  const ttlSeconds = reservationMinutes * 60;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  if (!redis) {
    throw new InventoryUnavailableError(
      'Redis is required for reservation creation — not available',
    );
  }
  if (circuitIsOpen()) {
    throw new InventoryUnavailableError('Redis circuit is open — reservation creation suspended');
  }

  // Mutex Lock — fail-closed: never proceed without the lock
  // TTL 10s: must exceed the max expected duration of validatePurchase + multi.exec
  const lockKey = `inv:lock:${event.id}`;
  let acquiredLock = false;
  try {
    acquiredLock = await redis.set(lockKey, 'locked', 'NX', 'EX', 10);
    if (!acquiredLock) {
      throw new Error('System busy, please retry in 1s');
    }
  } catch (e) {
    if (e.message.includes('System busy')) throw e;
    recordCircuitFailure();
    throw new LockAcquisitionError(`Redis lock acquisition failed: ${e.message}`);
  }

  try {
    // 0. Per-user reservation cap: one active reservation per user per event
    if (customerId && customerId !== 'anonymous') {
      const userResKey = `res:user:${customerId}:event:${event.id}`;
      try {
        const existingResIds = await redis.smembers(userResKey);
        for (const existingId of existingResIds) {
          const existingData = await redis.get(`${REDIS_RES_PREFIX}${existingId}`);
          if (existingData) {
            const existingReservation = JSON.parse(existingData);

            if (
              isReservationUsable(existingReservation) &&
              reservationItemsMatch(existingReservation.items, items) &&
              reservationCheckoutSnapshotsMatch(
                existingReservation.checkoutSnapshot,
                options.checkoutSnapshot,
              )
            ) {
              return {
                success: true,
                reservationId: existingReservation.id,
                items: existingReservation.items,
                checkoutSnapshot: existingReservation.checkoutSnapshot || null,
                expiresAt: existingReservation.expiresAt,
                expiresInSeconds: Math.max(
                  0,
                  Math.floor((new Date(existingReservation.expiresAt) - new Date()) / 1000),
                ),
              };
            }

            await removeTrackedReservation(redis, existingId, existingReservation, userResKey);
            continue;
          }

          // Stale entry from an expired reservation — remove it
          await redis.srem(userResKey, existingId).catch(() => {});
        }
      } catch (e) {
        console.warn('[Redis] Per-user check failed, skipping:', e.message);
      }
    }

    // 1. Double-check availability under lock
    // strictInventory on the event doc opts this event into fail-closed Redis behaviour
    const strictMode = !!(event.strictInventory || options.strictMode);
    const validation = await validatePurchase(event, items, { strictMode });
    if (!validation.success) {
      const errors = validation.items.filter((i) => !i.valid).map((i) => i.error);
      throw new Error(errors.join(', '));
    }

    // 2. Commit to Redis
    const reservation = {
      id: reservationId,
      eventId: event.id,
      customerId,
      deviceId,
      items: items.map((i) => ({ tierId: i.tierId, quantity: i.quantity })),
      checkoutSnapshot: options.checkoutSnapshot || null,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    const multi = redis.multi();
    multi.set(`${REDIS_RES_PREFIX}${reservationId}`, JSON.stringify(reservation), 'EX', ttlSeconds);
    for (const item of items) {
      multi.sadd(`${REDIS_TIER_RES_PREFIX}${event.id}:tier:${item.tierId}`, reservationId);
    }
    // Track per-user active reservation for this event (same TTL as reservation)
    if (customerId && customerId !== 'anonymous') {
      const userResKey = `res:user:${customerId}:event:${event.id}`;
      multi.sadd(userResKey, reservationId);
      multi.expire(userResKey, ttlSeconds);
    }
    try {
      await multi.exec();
      recordCircuitSuccess();
    } catch (e) {
      recordCircuitFailure();
      throw new ReservationCommitError(
        `Redis multi-exec failed — reservation not tracked: ${e.message}`,
      );
    }

    return {
      success: true,
      reservationId,
      expiresAt: reservation.expiresAt,
      checkoutSnapshot: reservation.checkoutSnapshot,
    };
    } finally {
    try {
      await redis.del(lockKey);
    } catch (e) {
      // Lock TTL is 10s so it will expire naturally; log but don't throw from finally
      console.warn('[Redis] Failed to release inventory lock (will expire in 10s):', e.message);
    }
  }
}

/**
 * Release a cart reservation
 */
export async function releaseReservation(reservationId) {
  const redis = getRedisClient();
  if (!redis) return { success: false };

  const resKey = `${REDIS_RES_PREFIX}${reservationId}`;
  const resData = await redis.get(resKey);
  if (!resData) return { success: false, error: 'Not found' };

  const reservation = JSON.parse(resData);
  const multi = redis.multi();
  multi.del(resKey);
  for (const item of reservation.items) {
    multi.srem(`${REDIS_TIER_RES_PREFIX}${reservation.eventId}:tier:${item.tierId}`, reservationId);
  }
  // Clean up per-user reservation tracking
  if (reservation.customerId && reservation.customerId !== 'anonymous') {
    multi.srem(`res:user:${reservation.customerId}:event:${reservation.eventId}`, reservationId);
  }
  try {
    await multi.exec();
  } catch (e) {
    console.warn('[Redis] Multi-exec failed in releaseReservation:', e.message);
  }
  return { success: true };
}

function inventoryCommitError(message, code, details = {}) {
  return Object.assign(new Error(message), {
    name: 'InventoryCommitError',
    code,
    statusCode: 409,
    details,
  });
}

function assertTierStillSaleable(tier, now = new Date()) {
  const status = String(tier?.status || tier?.lifecycle || '').toLowerCase();
  if (
    HIDDEN_TICKET_STATUSES.has(status) ||
    tier?.isHidden === true ||
    tier?.hidden === true ||
    tier?.isDeleted === true
  ) {
    throw inventoryCommitError(
      'Ticket tier is no longer available',
      'STALE_CART',
      { tierId: tier?.id || tier?.tierId || null, reason: 'hidden' },
    );
  }

  const saleStatus = getSaleStatus(tier, now);
  if (saleStatus !== 'active') {
    throw inventoryCommitError(
      saleStatus === 'not_started' ? 'Ticket sales have not started' : 'Ticket sales have ended',
      'STALE_CART',
      { tierId: tier?.id || tier?.tierId || null, reason: saleStatus },
    );
  }
}

function legacyRemainingForCommit(tier) {
  if (tier?.remaining !== undefined && tier?.remaining !== null && tier?.remaining !== '') {
    const remaining = Number(tier.remaining);
    if (Number.isSafeInteger(remaining) && remaining >= 0) return remaining;
    throw inventoryCommitError('Ticket inventory is invalid', 'INVENTORY_INCONSISTENT', {
      tierId: tier?.id || tier?.tierId || null,
      field: 'remaining',
    });
  }

  const inventory = tier?.inventory || {};
  const capacity = Number(
    inventory.totalQuantity ?? tier?.totalQuantity ?? tier?.quantity ?? tier?.capacity,
  );
  const sold = Number(
    inventory.soldQuantity ?? tier?.soldQuantity ?? tier?.sold ?? tier?.soldCount ?? 0,
  );
  const allocated = Number(
    inventory.allocatedQuantity ?? tier?.allocatedQuantity ?? tier?.lockedQuantity ?? 0,
  );
  const activeHoldbacks = Array.isArray(inventory.holdbacks)
    ? inventory.holdbacks.reduce((sum, holdback) => {
        if (holdback?.expiresAt && new Date(holdback.expiresAt) < new Date()) return sum;
        return sum + Number(holdback?.quantity || 0);
      }, 0)
    : 0;

  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 0 ||
    !Number.isSafeInteger(sold) ||
    sold < 0 ||
    !Number.isSafeInteger(allocated) ||
    allocated < 0 ||
    !Number.isSafeInteger(activeHoldbacks) ||
    activeHoldbacks < 0
  ) {
    throw inventoryCommitError('Ticket inventory is invalid', 'INVENTORY_INCONSISTENT', {
      tierId: tier?.id || tier?.tierId || null,
    });
  }
  return Math.max(0, capacity - sold - allocated - activeHoldbacks);
}

/**
 * Commits a reservation into a sale or deducts inventory directly.
 * Handles both sharded and standard Firestore structures.
 */
export async function commitInventory(transaction, { event, items, reservationId = null }) {
  const db = getAdminDb();
  const eventRef = db.collection('events').doc(event.id);
  const usesTicketCatalog = Array.isArray(event.ticketCatalog?.tiers);
  const sourceTiers = usesTicketCatalog ? event.ticketCatalog.tiers : event.tickets;
  if (!Array.isArray(sourceTiers)) {
    throw inventoryCommitError('Event has no ticket inventory', 'INVENTORY_INCONSISTENT', {
      eventId: event.id,
    });
  }
  const updatedTickets = [...sourceTiers];
  const shardReads = [];

  for (const item of items) {
    const tierId = String(item?.ticketId || item?.tierId || '').trim();
    const quantity = Number(item?.quantity);
    if (!tierId || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw inventoryCommitError('Ticket quantity is invalid', 'INVENTORY_INVALID_QUANTITY', {
        tierId: tierId || null,
        quantity: item?.quantity,
      });
    }

    const ticketIndex = updatedTickets.findIndex(
      (t) => String(t?.id || t?.tierId || '') === tierId,
    );
    if (ticketIndex === -1) {
      throw inventoryCommitError('Ticket tier no longer exists', 'STALE_CART', { tierId });
    }

    const tier = updatedTickets[ticketIndex];
    assertTierStillSaleable(tier);

    const isUnlimited = (tier.inventory?.type || tier.type) === 'unlimited';
    if (isUnlimited) continue;

    const legacyRemaining = legacyRemainingForCommit(tier);
    const currentRemaining = resolveFiniteInventoryRead({
      tier,
      legacyRemaining,
    }).remaining;
    if (!Number.isSafeInteger(currentRemaining) || currentRemaining < quantity) {
      throw inventoryCommitError('This ticket tier is now sold out', 'SOLD_OUT', {
        tierId,
        requested: quantity,
        remaining: currentRemaining,
      });
    }

    // Check for Sharded Counter sub-collection
    const shardsRef = eventRef.collection('ticket_shards');
    const shardsExist = (await transaction.get(shardsRef.limit(1))).size > 0;

    if (shardsExist) {
      // Pick a random shard (or use same shard as reservation if we tracked it)
      // For now, simpler random shard for 'sold' increment
      const shardId = Math.floor(Math.random() * 10).toString();
      const shardRef = shardsRef.doc(`${tier.id}_${shardId}`);
      const shardDoc = await transaction.get(shardRef);
      shardReads.push({ shardRef, shardDoc, quantity });
    } else {
      // Standard update
      if (reservationId) {
        updatedTickets[ticketIndex] = {
          ...tier,
          remaining: currentRemaining - quantity,
          lockedQuantity: Math.max(0, (tier.lockedQuantity || 0) - quantity),
          ...(tier.inventory
            ? { inventory: { ...tier.inventory, remaining: currentRemaining - quantity } }
            : {}),
        };
      } else {
        updatedTickets[ticketIndex] = {
          ...tier,
          remaining: currentRemaining - quantity,
          ...(tier.inventory
            ? { inventory: { ...tier.inventory, remaining: currentRemaining - quantity } }
            : {}),
        };
      }
    }
  }

  for (const { shardRef, shardDoc, quantity } of shardReads) {
    if (reservationId && shardDoc.exists) {
      transaction.update(shardRef, {
        lockedQuantity: Math.max(0, (shardDoc.data().lockedQuantity || 0) - quantity),
        soldQuantity: (shardDoc.data().soldQuantity || 0) + quantity,
        updatedAt: new Date().toISOString(),
      });
    } else {
      transaction.update(shardRef, {
        soldQuantity: (shardDoc.data().soldQuantity || 0) + quantity,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (usesTicketCatalog) {
    transaction.update(eventRef, {
      'ticketCatalog.tiers': updatedTickets,
      updatedAt: new Date().toISOString(),
    });
  } else {
    transaction.update(eventRef, { tickets: updatedTickets, updatedAt: new Date().toISOString() });
  }
}

/**
 * Deduct inventory for a tier within an existing Firestore transaction.
 * Single source of truth for all ticket deductions (checkout, RSVP claim, bundle creation).
 * Throws if the tier is sold out.
 */
export async function prepareInventoryDeduction(transaction, db, eventId, tierId, quantity) {
  const eventRef = db.collection('events').doc(eventId);
  const eDoc = await transaction.get(eventRef);
  if (!eDoc.exists) throw new Error('Event not found');

  const eData = eDoc.data();
  const isCatalog = !!eData.ticketCatalog;
  const tiers = isCatalog ? [...(eData.ticketCatalog.tiers || [])] : [...(eData.tickets || [])];
  const tIdx = tiers.findIndex((t) => t.id === tierId);
  if (tIdx === -1) throw new Error('Ticket tier not found');

  const currentRem = Number(tiers[tIdx].remaining ?? tiers[tIdx].quantity) || 0;
  if (currentRem < quantity) throw new Error('This ticket tier is now sold out');

  tiers[tIdx] = { ...tiers[tIdx], remaining: currentRem - quantity };

  return { eventRef, isCatalog, tiers };
}

export function applyPreparedInventoryDeduction(transaction, prepared) {
  if (prepared.isCatalog) {
    transaction.update(prepared.eventRef, {
      'ticketCatalog.tiers': prepared.tiers,
      updatedAt: new Date().toISOString(),
    });
  } else {
    transaction.update(prepared.eventRef, {
      tickets: prepared.tiers,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function deductInventory(transaction, db, eventId, tierId, quantity) {
  const prepared = await prepareInventoryDeduction(transaction, db, eventId, tierId, quantity);
  applyPreparedInventoryDeduction(transaction, prepared);
}

export default {
  calculateEffectiveInventory,
  validatePurchase,
  createReservation,
  listAvailableTicketTiers,
  releaseReservation,
  commitInventory,
  deductInventory,
  InventoryUnavailableError,
  LockAcquisitionError,
  ReservationCommitError,
  InventoryReadError,
};

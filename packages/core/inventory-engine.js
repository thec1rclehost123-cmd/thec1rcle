/**
 * THE C1RCLE - Master Inventory Engine
 * Production-grade inventory management with cart reservations, holdbacks, and atomic operations.
 * Unified source of truth for Apps, API, and Functions.
 */

import { randomUUID } from 'node:crypto';
import { getRedisClient } from './redis.js';
import { getAdminDb } from './admin.js';
import { getEffectivePrice } from './pricing-engine.js';

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
export class PurchaseValidationError extends Error {
  constructor(message = 'Ticket selection is invalid', issues = []) {
    super(message);
    this.name = 'PurchaseValidationError';
    this.code = 'CHECKOUT_VALIDATION_ERROR';
    this.issues = issues;
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
const PUBLIC_TICKET_EVENT_LIFECYCLES = new Set(['active', 'published', 'scheduled', 'live']);
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

  if (legacyRemaining !== null && inv.soldQuantity === undefined && tier.sold === undefined) {
    return legacyRemaining;
  }

  return Math.max(0, totalCapacity - sold - holdbackQuantity);
}

function getTicketTiers(event = {}) {
  const catalogTiers = Array.isArray(event.ticketCatalog?.tiers) ? event.ticketCatalog.tiers : [];
  const legacyTiers = Array.isArray(event.tickets) ? event.tickets : [];
  return catalogTiers.length > 0 ? catalogTiers : legacyTiers;
}

function isPublicTicketEvent(event = {}) {
  if (event.isPrivate || event.isDeleted) return false;
  const visibility = String(
    event.visibility || event.settings?.visibility || 'public',
  ).toLowerCase();
  if (visibility && visibility !== 'public') return false;

  const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  if (!lifecycle) return Boolean(event.publishedAt || event.startDate || event.startAt);
  return PUBLIC_TICKET_EVENT_LIFECYCLES.has(lifecycle);
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
  const eventDefaultScheduledPrices = Array.isArray(event?.defaultScheduledPrices)
    ? event.defaultScheduledPrices
    : [];
  const priceInfo = getEffectivePrice(tier, timestamp, eventDefaultScheduledPrices);
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

  // The event tier document is the sole sale authority. Historical shard
  // documents are projections only and must never be added to the canonical
  // sold value or used as a second source of inventory truth.
  void db;

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

export async function calculateEffectiveInventories(
  tiers,
  event,
  excludeReservationId = null,
  strictMode = false,
) {
  const results = new Map();
  const finiteTiers = [];
  for (const tier of tiers || []) {
    if ((tier.inventory?.type || tier.type) === 'unlimited') {
      results.set(tier.id, Infinity);
    } else {
      finiteTiers.push(tier);
      results.set(tier.id, getBaseRemaining(tier));
    }
  }
  if (finiteTiers.length === 0) return results;

  const fallbackToBase = (message) => {
    if (strictMode) throw new InventoryUnavailableError(message);
    console.warn(`[Inventory] Degraded mode: ${message}, using base counts only`);
    for (const tier of finiteTiers) {
      results.set(tier.id, Math.max(0, results.get(tier.id) || 0));
    }
    return results;
  };

  if (circuitIsOpen()) {
    return fallbackToBase('Redis circuit open — cannot guarantee accurate inventory');
  }

  try {
    const redis = getRedisClient();
    if (!redis || (redis.status !== 'ready' && redis.status !== 'connecting')) {
      recordCircuitFailure();
      return fallbackToBase('Redis not ready — cannot guarantee accurate inventory');
    }

    const tierKeys = finiteTiers.map(
      (tier) => `${REDIS_TIER_RES_PREFIX}${event.id}:tier:${tier.id}`,
    );
    let membershipResults;
    if (typeof redis.pipeline === 'function') {
      const pipeline = redis.pipeline();
      tierKeys.forEach((key) => pipeline.smembers(key));
      membershipResults = (await pipeline.exec()).map(([error, value]) => {
        if (error) throw error;
        return value || [];
      });
    } else {
      membershipResults = await Promise.all(tierKeys.map((key) => redis.smembers(key)));
    }

    const reservationIdsByTier = new Map();
    finiteTiers.forEach((tier, index) => {
      reservationIdsByTier.set(
        tier.id,
        (membershipResults[index] || []).filter((id) => id !== excludeReservationId),
      );
    });
    const reservationIds = [...new Set([...reservationIdsByTier.values()].flat().filter(Boolean))];
    const reservationPayloads = reservationIds.length
      ? await redis.mget(reservationIds.map((id) => `${REDIS_RES_PREFIX}${id}`))
      : [];
    const reservations = new Map();
    reservationIds.forEach((reservationId, index) => {
      const payload = reservationPayloads[index];
      if (!payload) {
        for (const [tierId, ids] of reservationIdsByTier) {
          if (ids.includes(reservationId)) {
            redis
              .srem(`${REDIS_TIER_RES_PREFIX}${event.id}:tier:${tierId}`, reservationId)
              .catch(() => {});
          }
        }
        return;
      }
      reservations.set(reservationId, JSON.parse(payload));
    });

    for (const tier of finiteTiers) {
      let remaining = results.get(tier.id) || 0;
      for (const reservationId of reservationIdsByTier.get(tier.id) || []) {
        const reservation = reservations.get(reservationId);
        const item = reservation?.items?.find((candidate) => candidate.tierId === tier.id);
        if (item) remaining -= Number(item.quantity || 0);
      }
      results.set(tier.id, Math.max(0, remaining));
    }
    recordCircuitSuccess();
    return results;
  } catch (error) {
    if (error instanceof InventoryUnavailableError) throw error;
    recordCircuitFailure();
    return fallbackToBase(`Redis inventory batch failed: ${error.message}`);
  }
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
  if (!isPublicTicketEvent(event)) return null;

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
  const seenTierIds = new Set();

  for (const item of items) {
    if (seenTierIds.has(item.tierId)) {
      results.push({
        tierId: item.tierId,
        valid: false,
        error: 'Duplicate ticket tier rows are not allowed',
      });
      allValid = false;
      continue;
    }
    seenTierIds.add(item.tierId);
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

    // 3. Purchase Limit Check. Free tiers default to one per order even when
    // older event documents do not carry an explicit limits object.
    const maxPerOrder = getMaxPerOrder(tier, event, available);
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
  if (!customerId || customerId === 'anonymous') {
    throw new InventoryUnavailableError('Authenticated reservation ownership is required');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new PurchaseValidationError('At least one ticket tier is required', [
      { field: 'items', message: 'Select at least one ticket tier' },
    ]);
  }
  if (new Set(items.map((item) => String(item.tierId))).size !== items.length) {
    throw new PurchaseValidationError('Duplicate ticket tier rows are not allowed', [
      { field: 'items', message: 'Each ticket tier may appear only once' },
    ]);
  }

  if (!redis) {
    throw new InventoryUnavailableError(
      'Redis is required for reservation creation — not available',
    );
  }
  if (circuitIsOpen()) {
    throw new InventoryUnavailableError('Redis circuit is open — reservation creation suspended');
  }

  // Mutex Lock — fail-closed: never proceed without the lock
  const lockKey = `inv:lock:${event.id}`;
  const lockToken = randomUUID();
  let acquiredLock = false;
  let lockRenewal = null;
  try {
    acquiredLock = await redis.set(lockKey, lockToken, 'NX', 'EX', 10);
    if (!acquiredLock) {
      throw new Error('System busy, please retry in 1s');
    }
    lockRenewal = setInterval(() => {
      redis
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
          1,
          lockKey,
          lockToken,
          10,
        )
        .catch((error) => {
          recordCircuitFailure();
          console.error('[Inventory] Failed to renew owned inventory lock:', error.message);
        });
    }, 3_000);
    lockRenewal.unref?.();
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
              reservationItemsMatch(existingReservation.items, items)
            ) {
              return {
                success: true,
                reservationId: existingReservation.id,
                items: existingReservation.items,
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
        recordCircuitFailure();
        throw new InventoryUnavailableError(`Unable to verify existing reservations: ${e.message}`);
      }
    }

    // 1. Double-check availability under lock
    // strictInventory on the event doc opts this event into fail-closed Redis behaviour
    const strictMode = true;
    const validation = await validatePurchase(event, items, { strictMode });
    if (!validation.success) {
      const issues = validation.items
        .filter((item) => !item.valid)
        .map((item) => ({
          field: `items.${item.tierId}`,
          tierId: item.tierId,
          message: item.error,
        }));
      throw new PurchaseValidationError(issues.map((issue) => issue.message).join(', '), issues);
    }

    // 2. Commit to Redis
    const reservation = {
      id: reservationId,
      eventId: event.id,
      customerId,
      deviceId,
      items: items.map((i) => ({ tierId: i.tierId, quantity: i.quantity })),
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
      const results = await multi.exec();
      if (results?.some?.(([error]) => error)) {
        throw new Error('One or more reservation writes failed');
      }
      recordCircuitSuccess();
    } catch (e) {
      recordCircuitFailure();
      throw new ReservationCommitError(
        `Redis multi-exec failed — reservation not tracked: ${e.message}`,
      );
    }

    return { success: true, reservationId, expiresAt: reservation.expiresAt };
  } finally {
    if (lockRenewal) clearInterval(lockRenewal);
    try {
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockToken,
      );
    } catch (e) {
      console.warn('[Redis] Failed to release owned inventory lock:', e.message);
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
    const results = await multi.exec();
    if (results?.some?.(([error]) => error)) {
      return { success: false, error: 'Reservation release was only partially applied' };
    }
  } catch (e) {
    return { success: false, error: `Reservation release failed: ${e.message}` };
  }
  return { success: true };
}

/**
 * Commits a reservation into a sale or deducts inventory directly.
 * Handles both sharded and standard Firestore structures.
 */
export async function commitInventory(
  transaction,
  { event, items, reservationId = null, db: passedDb = null },
) {
  const db = passedDb || getAdminDb();
  const eventRef = db.collection('events').doc(event.id);
  const updatedTickets = [...(event.tickets || event.ticketCatalog?.tiers || [])];

  for (const item of items) {
    const ticketIndex = updatedTickets.findIndex(
      (t) => t.id === item.ticketId || t.id === item.tierId,
    );
    if (ticketIndex === -1) {
      throw new Error(`Inventory tier not found: ${item.ticketId || item.tierId}`);
    }

    const tier = updatedTickets[ticketIndex];
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error('Inventory quantity must be a positive integer');
    }
    const remaining = getBaseRemaining(tier);
    if (!Number.isFinite(remaining) || remaining < quantity) {
      throw new Error(`Insufficient inventory for tier ${tier.id}`);
    }
    const sold = Number(tier.inventory?.soldQuantity ?? tier.soldQuantity ?? tier.sold ?? 0);
    const nextTier = {
      ...tier,
      remaining: remaining - quantity,
      soldQuantity: sold + quantity,
      ...(tier.inventory
        ? {
            inventory: {
              ...tier.inventory,
              soldQuantity: sold + quantity,
            },
          }
        : {}),
    };
    if (reservationId) {
      nextTier.lockedQuantity = Math.max(0, Number(tier.lockedQuantity || 0) - quantity);
      if (nextTier.inventory) {
        nextTier.inventory.lockedQuantity = Math.max(
          0,
          Number(tier.inventory?.lockedQuantity || 0) - quantity,
        );
      }
    }
    updatedTickets[ticketIndex] = nextTier;
  }

  if (event.ticketCatalog) {
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
export async function deductInventory(transaction, db, eventId, tierId, quantity) {
  const eventRef = db.collection('events').doc(eventId);
  const eDoc = await transaction.get(eventRef);
  if (!eDoc.exists) return;

  const eData = eDoc.data();
  const isCatalog = !!eData.ticketCatalog;
  const tiers = isCatalog ? [...(eData.ticketCatalog.tiers || [])] : [...(eData.tickets || [])];
  const tIdx = tiers.findIndex((t) => t.id === tierId);
  if (tIdx === -1) return;

  const currentRem = Number(tiers[tIdx].remaining ?? tiers[tIdx].quantity) || 0;
  if (currentRem < quantity) throw new Error('This ticket tier does not have enough inventory');

  tiers[tIdx] = { ...tiers[tIdx], remaining: currentRem - quantity };

  if (isCatalog) {
    transaction.update(eventRef, {
      'ticketCatalog.tiers': tiers,
      updatedAt: new Date().toISOString(),
    });
  } else {
    transaction.update(eventRef, { tickets: tiers, updatedAt: new Date().toISOString() });
  }
}

export default {
  calculateEffectiveInventory,
  calculateEffectiveInventories,
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

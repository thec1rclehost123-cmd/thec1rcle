/**
 * Pure finite-tier inventory accounting.
 *
 * This module deliberately performs no Firestore or Redis I/O. Firestore holds
 * durable inventory state; Redis cart reservations are a separate, temporary
 * availability concern and never become part of the conservation invariant.
 */

export class InventoryIntegrityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InventoryIntegrityError';
    this.details = Object.freeze({ ...details });
  }
}

export const INVENTORY_TRANSITIONS = Object.freeze({
  RESERVATION_TO_PAYMENT_PENDING: 'reservation_to_payment_pending',
  PAYMENT_CAPTURED: 'payment_captured',
  PAYMENT_FAILED_OR_EXPIRED: 'payment_failed_or_expired',
  FREE_OR_RSVP_CONFIRMED: 'free_or_rsvp_confirmed',
  REFUND_PROCESSED: 'refund_processed',
});

const INACTIVE_HOLDBACK_STATUSES = new Set([
  'cancelled',
  'expired',
  'inactive',
  'released',
  'removed',
]);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function toNonNegativeInteger(value, field, defaultValue = undefined) {
  const resolved = value === undefined || value === null || value === '' ? defaultValue : value;
  const number = Number(resolved);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new InventoryIntegrityError(`${field} must be a non-negative safe integer`, {
      field,
      value: resolved,
    });
  }

  return number;
}

function toTimestamp(value, field) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  } else if (typeof value === 'string' && value.trim()) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  throw new InventoryIntegrityError(`${field} must be a valid date`, { field, value });
}

function isFiniteTier(tier = {}) {
  return String(tier.inventory?.type || tier.type || '').toLowerCase() !== 'unlimited';
}

/**
 * Sum only holdbacks that are active at the supplied instant.
 */
export function sumActiveHoldbacks(holdbacks = [], now = new Date()) {
  if (!Array.isArray(holdbacks)) {
    throw new InventoryIntegrityError('holdbacks must be an array', { holdbacks });
  }

  const nowTimestamp = toTimestamp(now, 'now');

  return holdbacks.reduce((total, holdback, index) => {
    if (!holdback || typeof holdback !== 'object') {
      throw new InventoryIntegrityError(`holdbacks[${index}] must be an object`, { holdback });
    }

    const status = String(holdback.status || '').toLowerCase();
    if (holdback.active === false || INACTIVE_HOLDBACK_STATUSES.has(status)) return total;

    if (holdback.expiresAt !== undefined && holdback.expiresAt !== null) {
      const expiresAt = toTimestamp(holdback.expiresAt, `holdbacks[${index}].expiresAt`);
      if (expiresAt <= nowTimestamp) return total;
    }

    return total + toNonNegativeInteger(holdback.quantity, `holdbacks[${index}].quantity`, 0);
  }, 0);
}

function sumShardSoldQuantity(shards) {
  if (!Array.isArray(shards)) {
    throw new InventoryIntegrityError('shards must be an array when supplied', { shards });
  }

  return shards.reduce((total, shard, index) => {
    const quantity = shard && typeof shard === 'object' ? shard.soldQuantity : shard;
    return total + toNonNegativeInteger(quantity, `shards[${index}].soldQuantity`, 0);
  }, 0);
}

function readSoldMirrors(tier, inventory) {
  const candidates = {
    'inventory.soldQuantity': inventory.soldQuantity,
    'tier.soldQuantity': tier.soldQuantity,
    'tier.sold': tier.sold,
    'tier.soldCount': tier.soldCount,
  };
  const mirrors = {};

  for (const [field, value] of Object.entries(candidates)) {
    if (value === undefined || value === null || value === '') continue;
    mirrors[field] = toNonNegativeInteger(value, field);
  }

  return Object.freeze(mirrors);
}

/**
 * Read a tier into the canonical finite inventory shape without repairing it.
 *
 * Passing `shards` (including an empty array) makes their sum authoritative.
 * Omitting `shards` uses the parent sold mirror.
 */
export function readFiniteTierInventory(tier, options = {}) {
  if (!tier || typeof tier !== 'object') {
    throw new InventoryIntegrityError('tier must be an object', { tier });
  }
  if (!isFiniteTier(tier)) {
    throw new InventoryIntegrityError('Unlimited tiers do not use finite inventory accounting', {
      tierId: tier.id || tier.tierId || null,
    });
  }

  const inventory = tier.inventory || {};
  const capacity = toNonNegativeInteger(
    firstDefined(inventory.totalQuantity, tier.totalQuantity, tier.quantity, tier.capacity),
    'capacity',
  );
  const remaining = toNonNegativeInteger(
    firstDefined(inventory.remaining, tier.remaining),
    'remaining',
  );
  const allocatedQuantity = toNonNegativeInteger(
    firstDefined(inventory.allocatedQuantity, tier.allocatedQuantity, tier.lockedQuantity),
    'allocatedQuantity',
    0,
  );
  const soldMirrors = readSoldMirrors(tier, inventory);
  const parentSoldQuantity = toNonNegativeInteger(
    firstDefined(inventory.soldQuantity, tier.soldQuantity, tier.sold, tier.soldCount),
    'soldQuantity',
    0,
  );
  const hasShardAuthority = Object.prototype.hasOwnProperty.call(options, 'shards');
  const soldQuantity = hasShardAuthority
    ? sumShardSoldQuantity(options.shards)
    : parentSoldQuantity;
  const activeHoldbacks = sumActiveHoldbacks(
    inventory.holdbacks || tier.holdbacks || [],
    options.now || new Date(),
  );
  const parentSoldMirrorMismatch = new Set(Object.values(soldMirrors)).size > 1;

  return Object.freeze({
    capacity,
    remaining,
    allocatedQuantity,
    soldQuantity,
    activeHoldbacks,
    soldSource: hasShardAuthority ? 'shards' : 'parent',
    parentSoldQuantity,
    soldMirrors,
    parentSoldMirrorMismatch,
  });
}

/**
 * Inspect conservation without mutating or silently repairing the state.
 */
export function auditFiniteInventory(state) {
  const normalized = normalizeState(state);
  const accountedQuantity =
    normalized.remaining +
    normalized.allocatedQuantity +
    normalized.soldQuantity +
    normalized.activeHoldbacks;
  const delta = normalized.capacity - accountedQuantity;

  return Object.freeze({
    state: normalized,
    accountedQuantity,
    delta,
    isBalanced: delta === 0,
    unaccountedQuantity: Math.max(0, delta),
    overAccountedQuantity: Math.max(0, -delta),
  });
}

/**
 * Enforce: capacity = remaining + allocated + sold + active holdbacks.
 */
export function assertFiniteInventoryInvariant(state) {
  const audit = auditFiniteInventory(state);
  if (!audit.isBalanced) {
    throw new InventoryIntegrityError('Finite inventory conservation invariant failed', {
      capacity: audit.state.capacity,
      accountedQuantity: audit.accountedQuantity,
      delta: audit.delta,
      state: audit.state,
    });
  }
  return audit.state;
}

function normalizeState(state) {
  if (!state || typeof state !== 'object') {
    throw new InventoryIntegrityError('inventory state must be an object', { state });
  }

  return Object.freeze({
    capacity: toNonNegativeInteger(state.capacity, 'capacity'),
    remaining: toNonNegativeInteger(state.remaining, 'remaining'),
    allocatedQuantity: toNonNegativeInteger(state.allocatedQuantity, 'allocatedQuantity', 0),
    soldQuantity: toNonNegativeInteger(state.soldQuantity, 'soldQuantity', 0),
    activeHoldbacks: toNonNegativeInteger(state.activeHoldbacks, 'activeHoldbacks', 0),
  });
}

function requireAvailable(state, field, quantity, transition) {
  if (state[field] < quantity) {
    throw new InventoryIntegrityError(`Insufficient ${field} for ${transition}`, {
      transition,
      requestedQuantity: quantity,
      availableQuantity: state[field],
    });
  }
}

/**
 * Apply one durable state transition. The input is never mutated and both the
 * input and output must satisfy conservation.
 */
export function transitionFiniteInventory(state, transition, quantity) {
  const current = assertFiniteInventoryInvariant(state);
  const units = toNonNegativeInteger(quantity, 'quantity');
  if (units === 0) {
    throw new InventoryIntegrityError('quantity must be greater than zero', { quantity });
  }

  const next = { ...current };

  switch (transition) {
    case INVENTORY_TRANSITIONS.RESERVATION_TO_PAYMENT_PENDING:
      requireAvailable(current, 'remaining', units, transition);
      next.remaining -= units;
      next.allocatedQuantity += units;
      break;
    case INVENTORY_TRANSITIONS.PAYMENT_CAPTURED:
      requireAvailable(current, 'allocatedQuantity', units, transition);
      next.allocatedQuantity -= units;
      next.soldQuantity += units;
      break;
    case INVENTORY_TRANSITIONS.PAYMENT_FAILED_OR_EXPIRED:
      requireAvailable(current, 'allocatedQuantity', units, transition);
      next.allocatedQuantity -= units;
      next.remaining += units;
      break;
    case INVENTORY_TRANSITIONS.FREE_OR_RSVP_CONFIRMED:
      requireAvailable(current, 'remaining', units, transition);
      next.remaining -= units;
      next.soldQuantity += units;
      break;
    case INVENTORY_TRANSITIONS.REFUND_PROCESSED:
      requireAvailable(current, 'soldQuantity', units, transition);
      next.soldQuantity -= units;
      next.remaining += units;
      break;
    default:
      throw new InventoryIntegrityError('Unknown inventory transition', { transition });
  }

  return assertFiniteInventoryInvariant(next);
}

/**
 * Calculate temporary cart availability without modifying durable inventory.
 */
export function calculateReservableQuantity(state, activeRedisReservationQuantity = 0) {
  const current = assertFiniteInventoryInvariant(state);
  const reserved = toNonNegativeInteger(
    activeRedisReservationQuantity,
    'activeRedisReservationQuantity',
    0,
  );
  return Math.max(0, current.remaining - reserved);
}

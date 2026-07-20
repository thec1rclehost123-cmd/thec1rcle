/**
 * Feature-gated Firestore transaction primitives for finite inventory V2.
 *
 * The transaction adapter performs Firestore reads/writes only. Redis cart
 * reservations, payment-provider calls, logging and fulfillment must happen
 * outside this function.
 */

import {
  assertFiniteInventoryInvariant,
  readFiniteTierInventory,
  transitionFiniteInventory,
} from './inventory-integrity.js';

export const INVENTORY_V2_FLAGS = Object.freeze({
  READS: 'FF_INVENTORY_V2_READS',
  WRITES: 'FF_INVENTORY_V2_WRITES',
});

export const INVENTORY_V2_SOLD_AUTHORITIES = Object.freeze({
  PARENT: 'parent',
  SHARDS: 'shards',
});

export class InventoryV2Error extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'InventoryV2Error';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function runtimeEnv() {
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

function parseEnabled(value) {
  return (
    value === true ||
    String(value || '')
      .trim()
      .toLowerCase() === 'true'
  );
}

/**
 * Both switches are false unless explicitly enabled. Direct booleans override
 * environment values so an API-layer feature service can pass its decision in.
 */
export function getInventoryV2FeatureState(options = {}) {
  const env = options.env || runtimeEnv();
  return Object.freeze({
    readsEnabled:
      options.readsEnabled === undefined
        ? parseEnabled(env[INVENTORY_V2_FLAGS.READS])
        : options.readsEnabled === true,
    writesEnabled:
      options.writesEnabled === undefined
        ? parseEnabled(env[INVENTORY_V2_FLAGS.WRITES])
        : options.writesEnabled === true,
  });
}

/**
 * Read seam used by inventory-engine. Legacy remains selected by default.
 */
export function resolveFiniteInventoryRead({ tier, legacyRemaining, shards, now, featureFlags }) {
  const flags = getInventoryV2FeatureState(featureFlags);
  if (!flags.readsEnabled) {
    return Object.freeze({ mode: 'legacy', remaining: legacyRemaining, state: null });
  }

  const readOptions = { now };
  if (shards !== undefined) readOptions.shards = shards;
  const state = readFiniteTierInventory(tier, readOptions);
  const canonical = assertFiniteInventoryInvariant(state);

  return Object.freeze({ mode: 'v2', remaining: canonical.remaining, state: canonical });
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object') {
    throw new InventoryV2Error(`${field} is required`, 'INVENTORY_V2_INVALID_INPUT', { field });
  }
  return value;
}

function requireIdentifier(value, field) {
  const identifier = String(value || '').trim();
  if (!identifier || identifier.includes('/') || Buffer.byteLength(identifier, 'utf8') > 512) {
    throw new InventoryV2Error(
      `${field} must be a non-empty Firestore document id without slashes`,
      'INVENTORY_V2_INVALID_INPUT',
      { field },
    );
  }
  return identifier;
}

function requireQuantity(value) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new InventoryV2Error(
      'quantity must be a positive safe integer',
      'INVENTORY_V2_INVALID_INPUT',
      { quantity: value },
    );
  }
  return quantity;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new InventoryV2Error('now must be a valid date', 'INVENTORY_V2_INVALID_INPUT');
  }
  return date.toISOString();
}

function findTier(event, tierId) {
  const usesTicketCatalog = Array.isArray(event.ticketCatalog?.tiers);
  const sourceTiers = usesTicketCatalog ? event.ticketCatalog.tiers : event.tickets;
  if (!Array.isArray(sourceTiers)) {
    throw new InventoryV2Error('Event has no ticket tiers', 'INVENTORY_V2_TIER_NOT_FOUND', {
      tierId,
    });
  }

  const tierIndex = sourceTiers.findIndex(
    (tier) => String(tier?.id || tier?.tierId || '') === tierId,
  );
  if (tierIndex < 0) {
    throw new InventoryV2Error('Ticket tier not found', 'INVENTORY_V2_TIER_NOT_FOUND', {
      tierId,
    });
  }

  return { usesTicketCatalog, sourceTiers, tierIndex, tier: sourceTiers[tierIndex] };
}

function getSoldAuthority(value) {
  const kind = typeof value === 'string' ? value : value?.kind;
  if (
    kind !== INVENTORY_V2_SOLD_AUTHORITIES.PARENT &&
    kind !== INVENTORY_V2_SOLD_AUTHORITIES.SHARDS
  ) {
    throw new InventoryV2Error(
      'soldAuthority must explicitly be parent or shards',
      'INVENTORY_V2_AUTHORITY_REQUIRED',
      { soldAuthority: kind || null },
    );
  }
  return kind;
}

function getSnapshotDocuments(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.docs)) {
    throw new InventoryV2Error('Invalid shard query result', 'INVENTORY_V2_SHARD_UNSUPPORTED');
  }
  return snapshot.docs;
}

function readShardAuthority(snapshot, tierId) {
  const docs = getSnapshotDocuments(snapshot);
  if (docs.length === 0) {
    throw new InventoryV2Error(
      'Explicit shard authority requires at least one shard',
      'INVENTORY_V2_SHARD_UNSUPPORTED',
      { tierId },
    );
  }

  const seenIds = new Set();
  const shards = docs.map((doc) => {
    const id = String(doc?.id || '');
    const ref = doc?.ref;
    const data = doc?.data?.();
    if (!id || !ref || !data || seenIds.has(id)) {
      throw new InventoryV2Error(
        'Shard documents must have unique ids, refs and data',
        'INVENTORY_V2_SHARD_UNSUPPORTED',
        { tierId, shardId: id || null },
      );
    }
    seenIds.add(id);
    if (String(data.tierId || '') !== tierId) {
      throw new InventoryV2Error(
        'Shard tier does not match requested tier',
        'INVENTORY_V2_SHARD_INCONSISTENT',
        { tierId, shardId: id, shardTierId: data.tierId || null },
      );
    }

    const soldQuantity = Number(data.soldQuantity || 0);
    if (!Number.isSafeInteger(soldQuantity) || soldQuantity < 0) {
      throw new InventoryV2Error(
        'Shard sold quantity is invalid',
        'INVENTORY_V2_SHARD_INCONSISTENT',
        { tierId, shardId: id },
      );
    }
    for (const field of [
      'lockedQuantity',
      'allocatedQuantity',
      'heldQuantity',
      'reservedQuantity',
    ]) {
      const value = Number(data[field] || 0);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new InventoryV2Error(
          `Shard ${field} is invalid`,
          'INVENTORY_V2_SHARD_INCONSISTENT',
          { tierId, shardId: id, field },
        );
      }
      if (value !== 0) {
        throw new InventoryV2Error(
          'Legacy shard-local allocations are unsupported',
          'INVENTORY_V2_SHARD_UNSUPPORTED',
          { tierId, shardId: id, field, value },
        );
      }
    }

    return { id, ref, data, soldQuantity };
  });

  return shards.sort((left, right) => left.id.localeCompare(right.id));
}

function stableIndex(value, length) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function prepareShardWrites(shards, soldDelta, operationKey, updatedAt) {
  if (soldDelta === 0) return [];
  if (soldDelta > 0) {
    const target = shards[stableIndex(operationKey, shards.length)];
    return [
      {
        ref: target.ref,
        updates: { soldQuantity: target.soldQuantity + soldDelta, updatedAt },
      },
    ];
  }

  let remainingToRestore = Math.abs(soldDelta);
  const writes = [];
  for (const shard of shards) {
    if (remainingToRestore === 0) break;
    const decrement = Math.min(shard.soldQuantity, remainingToRestore);
    if (decrement === 0) continue;
    writes.push({
      ref: shard.ref,
      updates: { soldQuantity: shard.soldQuantity - decrement, updatedAt },
    });
    remainingToRestore -= decrement;
  }

  if (remainingToRestore !== 0) {
    throw new InventoryV2Error(
      'Shard sold sum cannot satisfy transition',
      'INVENTORY_V2_SHARD_INCONSISTENT',
      { requestedQuantity: Math.abs(soldDelta), unavailableQuantity: remainingToRestore },
    );
  }
  return writes;
}

function buildTierMirrors(tier, state) {
  const nextTier = {
    ...tier,
    remaining: state.remaining,
    allocatedQuantity: state.allocatedQuantity,
    soldQuantity: state.soldQuantity,
    sold: state.soldQuantity,
    inventory: {
      ...(tier.inventory || {}),
      totalQuantity: state.capacity,
      remaining: state.remaining,
      allocatedQuantity: state.allocatedQuantity,
      soldQuantity: state.soldQuantity,
    },
  };

  if (Object.prototype.hasOwnProperty.call(tier, 'soldCount')) {
    nextTier.soldCount = state.soldQuantity;
  }
  return nextTier;
}

function mutationMatches(data, expected) {
  return (
    Number(data?.version) === 2 &&
    data?.operationKey === expected.operationKey &&
    data?.eventId === expected.eventId &&
    data?.tierId === expected.tierId &&
    data?.transition === expected.transition &&
    Number(data?.quantity) === expected.quantity &&
    data?.soldAuthority === expected.soldAuthority
  );
}

/**
 * Apply exactly one durable inventory transition inside an existing Firestore
 * transaction. The caller owns transaction retries and all external work.
 */
export async function applyInventoryTransitionV2InTransaction(transaction, params) {
  requireObject(transaction, 'transaction');
  requireObject(params, 'params');
  const db = requireObject(params.db, 'db');
  if (!getInventoryV2FeatureState(params.featureFlags).writesEnabled) {
    throw new InventoryV2Error('Inventory V2 writes are disabled', 'INVENTORY_V2_WRITES_DISABLED');
  }

  const operationKey = requireIdentifier(params.operationKey, 'operationKey');
  const eventId = requireIdentifier(params.eventId, 'eventId');
  const tierId = requireIdentifier(params.tierId, 'tierId');
  const transition = String(params.transition || '');
  const quantity = requireQuantity(params.quantity);
  const soldAuthority = getSoldAuthority(params.soldAuthority);
  const updatedAt = toIso(params.now);
  const eventRef = db.collection('events').doc(eventId);
  const mutationRef = db.collection('inventory_mutations').doc(operationKey);
  const expectedMutation = {
    operationKey,
    eventId,
    tierId,
    transition,
    quantity,
    soldAuthority,
  };

  // Read the mutation first. A Firestore retry after a concurrent create then
  // becomes a cheap replay and does not need to re-read the event.
  const mutationDoc = await transaction.get(mutationRef);
  if (mutationDoc.exists) {
    const existing = mutationDoc.data();
    if (!mutationMatches(existing, expectedMutation)) {
      throw new InventoryV2Error(
        'Inventory mutation operation key was reused with different inputs',
        'INVENTORY_V2_OPERATION_CONFLICT',
        { operationKey },
      );
    }
    return Object.freeze({
      alreadyApplied: true,
      ...expectedMutation,
      before: existing.before,
      after: existing.after,
    });
  }

  const eventDoc = await transaction.get(eventRef);
  if (!eventDoc.exists) {
    throw new InventoryV2Error('Event not found', 'INVENTORY_V2_EVENT_NOT_FOUND', { eventId });
  }

  const event = eventDoc.data();
  const { usesTicketCatalog, sourceTiers, tierIndex, tier } = findTier(event, tierId);
  const shardQuery = eventRef.collection('ticket_shards').where('tierId', '==', tierId);
  const shardSnapshot = await transaction.get(shardQuery);
  let shards = null;
  if (soldAuthority === INVENTORY_V2_SOLD_AUTHORITIES.SHARDS) {
    shards = readShardAuthority(shardSnapshot, tierId);
  } else if (getSnapshotDocuments(shardSnapshot).length > 0) {
    throw new InventoryV2Error(
      'Parent sold authority conflicts with existing shard documents',
      'INVENTORY_V2_AUTHORITY_CONFLICT',
      { eventId, tierId },
    );
  }

  const readOptions = { now: updatedAt };
  if (shards) readOptions.shards = shards.map((shard) => shard.data);
  const observedBefore = readFiniteTierInventory(tier, readOptions);
  if (
    soldAuthority === INVENTORY_V2_SOLD_AUTHORITIES.PARENT &&
    observedBefore.parentSoldMirrorMismatch
  ) {
    throw new InventoryV2Error(
      'Parent sold mirrors disagree; inventory authority is ambiguous',
      'INVENTORY_V2_PARENT_MIRROR_CONFLICT',
      { eventId, tierId, soldMirrors: observedBefore.soldMirrors },
    );
  }
  const before = assertFiniteInventoryInvariant(observedBefore);
  const after = transitionFiniteInventory(before, transition, quantity);
  const soldDelta = after.soldQuantity - before.soldQuantity;
  const shardWrites = shards ? prepareShardWrites(shards, soldDelta, operationKey, updatedAt) : [];
  const updatedTiers = [...sourceTiers];
  updatedTiers[tierIndex] = buildTierMirrors(tier, after);

  for (const write of shardWrites) {
    transaction.update(write.ref, write.updates);
  }
  transaction.update(
    eventRef,
    usesTicketCatalog
      ? { 'ticketCatalog.tiers': updatedTiers, updatedAt }
      : { tickets: updatedTiers, updatedAt },
  );
  transaction.create(mutationRef, {
    version: 2,
    ...expectedMutation,
    before,
    after,
    createdAt: updatedAt,
  });

  return Object.freeze({ alreadyApplied: false, ...expectedMutation, before, after });
}

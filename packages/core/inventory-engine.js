/**
 * THE C1RCLE - Master Inventory Engine
 * Production-grade inventory management with cart reservations, holdbacks, and atomic operations.
 * Unified source of truth for Apps, API, and Functions.
 */

import { randomUUID } from "node:crypto";
import { getRedisClient } from "./redis.js";

// Cart reservation timeout (default 10 minutes)
const DEFAULT_RESERVATION_MINUTES = 10;

// Shard configuration for Firestore sharded counters
const NUM_SHARDS = 10;

/**
 * REDIS KEYS:
 * res:data:{id} -> JSON reservation object (EX: 10m)
 * res:event:{eventId}:tier:{tierId} -> Set of active reservation IDs for a specific tier
 * inv:lock:{eventId} -> Mutex for atomic inventory checks
 */
const REDIS_RES_PREFIX = "res:data:";
const REDIS_TIER_RES_PREFIX = "res:event:";

/**
 * Calculate effective inventory for a tier.
 * Accounts for:
 * 1. Base remaining (from Firestore doc)
 * 2. Holdbacks (manually held tickets)
 * 3. Redis Cart Reservations (live carts)
 * 4. (Optional) Firestore Shard Aggregation (for high-concurrency sold counts)
 */
export async function calculateEffectiveInventory(tier, event, excludeReservationId = null, db = null) {
    const inventory = tier.inventory || {};

    // 1. Unlimited inventory
    if (inventory.type === 'unlimited') return Infinity;

    // 2. Get base remaining quantity
    let totalCapacity = Number(inventory.totalQuantity ?? tier.quantity ?? 0);
    let sold = Number(inventory.soldQuantity ?? tier.sold ?? 0);

    // 3. Fallback to sharded counters if db provided (Functions mode)
    if (db) {
        const shardsRef = db.collection('events').doc(event.id).collection('ticket_shards')
            .where('tierId', '==', tier.id);
        const snapshot = await shardsRef.get();
        snapshot.forEach(doc => {
            const data = doc.data();
            sold += (data.soldQuantity || 0);
        });
    }

    let remaining = totalCapacity - sold;

    // 4. Subtract active holdbacks
    if (inventory.holdbacks && Array.isArray(inventory.holdbacks)) {
        const now = new Date();
        for (const holdback of inventory.holdbacks) {
            if (holdback.expiresAt && new Date(holdback.expiresAt) < now) continue;
            remaining -= holdback.quantity;
        }
    }

    // 5. Subtract active cart reservations from Redis (if available)
    const redis = getRedisClient();
    if (redis) {
        const tierResKey = `${REDIS_TIER_RES_PREFIX}${event.id}:tier:${tier.id}`;
        const activeResIds = await redis.smembers(tierResKey);

        for (const resId of activeResIds) {
            if (resId === excludeReservationId) continue;
            const resData = await redis.get(`${REDIS_RES_PREFIX}${resId}`);
            if (!resData) {
                redis.srem(tierResKey, resId).catch(() => { });
                continue;
            }
            const reservation = JSON.parse(resData);
            const item = reservation.items.find(i => i.tierId === tier.id);
            if (item) remaining -= item.quantity;
        }
    }

    return Math.max(0, remaining);
}

/**
 * Main availability and restriction check
 */
export async function validatePurchase(event, items, options = {}) {
    const {
        timestamp = new Date(),
        userId = null,
        deviceId = null,
        db = null // Provide Firestore db instance for sharded check
    } = options;

    const results = [];
    let allValid = true;

    for (const item of items) {
        const tiers = event.ticketCatalog?.tiers || event.tickets || [];
        const tier = tiers.find(t => t.id === item.tierId);

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
        const available = await calculateEffectiveInventory(tier, event, null, db);
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
    if (!redis) throw new Error("Redis connection required for real-time inventory locking");

    const reservationId = randomUUID();
    const ttlSeconds = reservationMinutes * 60;

    // Mutex Lock
    const lockKey = `inv:lock:${event.id}`;
    const acquiredLock = await redis.set(lockKey, "locked", "NX", "EX", 5);
    if (!acquiredLock) throw new Error("System busy, please retry in 1s");

    try {
        // 0. Per-user reservation cap: one active reservation per user per event
        if (customerId && customerId !== 'anonymous') {
            const userResKey = `res:user:${customerId}:event:${event.id}`;
            const existingResIds = await redis.smembers(userResKey);
            for (const existingId of existingResIds) {
                const existingData = await redis.get(`${REDIS_RES_PREFIX}${existingId}`);
                if (existingData) {
                    throw new Error("You already have an active reservation for this event. Please complete or cancel your existing checkout first.");
                }
                // Stale entry from an expired reservation — remove it
                await redis.srem(userResKey, existingId);
            }
        }

        // 1. Double-check availability under lock
        const validation = await validatePurchase(event, items);
        if (!validation.success) {
            const errors = validation.items.filter(i => !i.valid).map(i => i.error);
            throw new Error(errors.join(', '));
        }

        // 2. Commit to Redis
        const reservation = {
            id: reservationId,
            eventId: event.id,
            customerId,
            deviceId,
            items: items.map(i => ({ tierId: i.tierId, quantity: i.quantity })),
            status: 'active',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
        };

        const multi = redis.multi();
        multi.set(`${REDIS_RES_PREFIX}${reservationId}`, JSON.stringify(reservation), "EX", ttlSeconds);
        for (const item of items) {
            multi.sadd(`${REDIS_TIER_RES_PREFIX}${event.id}:tier:${item.tierId}`, reservationId);
        }
        // Track per-user active reservation for this event (same TTL as reservation)
        if (customerId && customerId !== 'anonymous') {
            const userResKey = `res:user:${customerId}:event:${event.id}`;
            multi.sadd(userResKey, reservationId);
            multi.expire(userResKey, ttlSeconds);
        }
        await multi.exec();

        return { success: true, reservationId, expiresAt: reservation.expiresAt };
    } finally {
        await redis.del(lockKey);
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
    await multi.exec();
    return { success: true };
}

/**
 * Commits a reservation into a sale or deducts inventory directly.
 * Handles both sharded and standard Firestore structures.
 */
export async function commitInventory(transaction, { event, items, reservationId = null }) {
    const eventRef = transaction.db.collection('events').doc(event.id);
    const updatedTickets = [...(event.tickets || event.ticketCatalog?.tiers || [])];

    for (const item of items) {
        const ticketIndex = updatedTickets.findIndex(t => t.id === item.ticketId || t.id === item.tierId);
        if (ticketIndex === -1) continue;

        const tier = updatedTickets[ticketIndex];
        const quantity = Number(item.quantity);

        // Check for Sharded Counter sub-collection
        const shardsRef = eventRef.collection('ticket_shards');
        const shardsExist = (await transaction.get(shardsRef.limit(1))).size > 0;

        if (shardsExist) {
            // Pick a random shard (or use same shard as reservation if we tracked it)
            // For now, simpler random shard for 'sold' increment
            const shardId = Math.floor(Math.random() * 10).toString();
            const shardRef = shardsRef.doc(`${tier.id}_${shardId}`);

            const shardDoc = await transaction.get(shardRef);
            if (reservationId && shardDoc.exists) {
                transaction.update(shardRef, {
                    lockedQuantity: Math.max(0, (shardDoc.data().lockedQuantity || 0) - quantity),
                    soldQuantity: (shardDoc.data().soldQuantity || 0) + quantity,
                    updatedAt: new Date().toISOString()
                });
            } else {
                transaction.update(shardRef, {
                    soldQuantity: (shardDoc.data().soldQuantity || 0) + quantity,
                    updatedAt: new Date().toISOString()
                });
            }
        } else {
            // Standard update
            if (reservationId) {
                updatedTickets[ticketIndex] = {
                    ...tier,
                    remaining: Math.max(0, (tier.remaining ?? tier.quantity) - quantity),
                    lockedQuantity: Math.max(0, (tier.lockedQuantity || 0) - quantity)
                };
            } else {
                updatedTickets[ticketIndex] = {
                    ...tier,
                    remaining: Math.max(0, (tier.remaining ?? tier.quantity) - quantity)
                };
            }
        }
    }

    if (event.ticketCatalog) {
        transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTickets, updatedAt: new Date().toISOString() });
    } else {
        transaction.update(eventRef, { tickets: updatedTickets, updatedAt: new Date().toISOString() });
    }
}

export default {
    calculateEffectiveInventory,
    validatePurchase,
    createReservation,
    releaseReservation,
    commitInventory
};

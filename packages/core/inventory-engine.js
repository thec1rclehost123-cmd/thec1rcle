/**
 * THE C1RCLE - Inventory Engine
 * Production-grade inventory management with cart reservations, holdbacks, and atomic operations
 */

import { randomUUID } from "node:crypto";
import { getRedisClient } from "./redis.js";

// Cart reservation timeout (default 10 minutes)
const DEFAULT_RESERVATION_MINUTES = 10;

/**
 * REDIS KEYS:
 * res:data:{id} -> JSON reservation object (EX: 10m)
 * res:event:{eventId}:tier:{tierId} -> Set of active reservation IDs for a specific tier
 * inv:lock:{eventId}:{tierId} -> Mutex for atomic inventory checks (Redlock pattern)
 */
const REDIS_RES_PREFIX = "res:data:";
const REDIS_TIER_RES_PREFIX = "res:event:";

/**
 * Check availability for requested items
 */
export function checkAvailability(event, items, options = {}) {
    const { excludeReservationId = null, timestamp = new Date() } = options;
    const results = [];
    let allAvailable = true;
    const warnings = [];

    for (const item of items) {
        const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId) ||
            event.tickets?.find(t => t.id === item.tierId);

        if (!tier) {
            results.push({
                tierId: item.tierId,
                requested: item.quantity,
                available: 0,
                canFulfill: false,
                error: 'Tier not found'
            });
            allAvailable = false;
            continue;
        }

        // Check sale window
        const saleWindow = tier.saleWindow || tier.salesWindow;
        if (saleWindow) {
            const now = timestamp instanceof Date ? timestamp : new Date(timestamp);
            const startsAt = new Date(saleWindow.startsAt || saleWindow.salesStart);
            const endsAt = new Date(saleWindow.endsAt || saleWindow.salesEnd);

            if (now < startsAt) {
                results.push({
                    tierId: item.tierId,
                    tierName: tier.name,
                    requested: item.quantity,
                    available: 0,
                    canFulfill: false,
                    error: `Sales start at ${startsAt.toLocaleString()}`
                });
                allAvailable = false;
                continue;
            }

            if (now > endsAt) {
                results.push({
                    tierId: item.tierId,
                    tierName: tier.name,
                    requested: item.quantity,
                    available: 0,
                    canFulfill: false,
                    error: 'Sales have ended for this tier'
                });
                allAvailable = false;
                continue;
            }
        }

        // Check visibility
        const visibility = tier.visibility;
        if (visibility) {
            if (visibility.isHidden && !options.accessCode) {
                results.push({
                    tierId: item.tierId,
                    tierName: tier.name,
                    requested: item.quantity,
                    available: 0,
                    canFulfill: false,
                    error: 'This tier is not available'
                });
                allAvailable = false;
                continue;
            }

            if (visibility.requiresCode) {
                const validCode = visibility.accessCodes?.includes(options.accessCode);
                if (!validCode) {
                    results.push({
                        tierId: item.tierId,
                        tierName: tier.name,
                        requested: item.quantity,
                        available: 0,
                        canFulfill: false,
                        error: 'Access code required'
                    });
                    allAvailable = false;
                    continue;
                }
            }

            if (visibility.inviteOnly && options.userId) {
                if (!visibility.allowedUserIds?.includes(options.userId)) {
                    results.push({
                        tierId: item.tierId,
                        tierName: tier.name,
                        requested: item.quantity,
                        available: 0,
                        canFulfill: false,
                        error: 'This tier is invite-only'
                    });
                    allAvailable = false;
                    continue;
                }
            }
        }

        // Calculate available inventory
        let available = calculateEffectiveInventory(tier, event, excludeReservationId);

        const canFulfill = item.quantity <= available;
        if (!canFulfill) {
            allAvailable = false;
        }

        // Check if oversell is allowed
        if (!canFulfill && tier.inventory?.allowOversell) {
            const oversellLimit = tier.inventory.oversellLimit || 0;
            const oversellAvailable = available + oversellLimit;
            if (item.quantity <= oversellAvailable) {
                warnings.push(`${tier.name}: Overselling ${item.quantity - available} tickets`);
            }
        }

        results.push({
            tierId: item.tierId,
            tierName: tier.name,
            requested: item.quantity,
            available,
            canFulfill,
            error: canFulfill ? null : `Only ${available} tickets available`
        });
    }

    return {
        available: allAvailable,
        items: results,
        warnings
    };
}

/**
 * Calculate effective inventory for a tier (accounting for holdbacks and Redis reservations)
 */
export async function calculateEffectiveInventory(tier, event, excludeReservationId = null) {
    const inventory = tier.inventory || {};

    // Unlimited inventory
    if (inventory.type === 'unlimited') {
        return Infinity;
    }

    // Get base remaining quantity
    let remaining = inventory.remainingQuantity ?? tier.remaining ?? tier.quantity ?? 0;

    // Subtract active holdbacks (these are typically metadata on the event/tier doc)
    if (inventory.holdbacks && Array.isArray(inventory.holdbacks)) {
        const now = new Date();
        for (const holdback of inventory.holdbacks) {
            if (holdback.expiresAt && new Date(holdback.expiresAt) < now) continue;
            remaining -= holdback.quantity;
        }
    }

    // Subtract active cart reservations from Redis
    const redis = getRedisClient();
    const tierResKey = `${REDIS_TIER_RES_PREFIX}${event.id}:tier:${tier.id}`;
    const activeResIds = await redis.smembers(tierResKey);

    for (const resId of activeResIds) {
        if (resId === excludeReservationId) continue;

        const resData = await redis.get(`${REDIS_RES_PREFIX}${resId}`);
        if (!resData) {
            // Cleanup orphaned reference in background
            redis.srem(tierResKey, resId).catch(() => { });
            continue;
        }

        const reservation = JSON.parse(resData);
        const reservedItem = reservation.items.find(i => i.tierId === tier.id);
        if (reservedItem) {
            remaining -= reservedItem.quantity;
        }
    }

    return Math.max(0, remaining);
}

/**
 * Get active reservations for a tier
 */
export function getActiveReservationsForTier(eventId, tierId, excludeId = null) {
    const active = [];
    const now = new Date();

    for (const [id, reservation] of reservations) {
        if (id === excludeId) continue;
        if (reservation.eventId !== eventId) continue;
        if (reservation.status !== 'active') continue;
        if (new Date(reservation.expiresAt) < now) continue;

        const hasItem = reservation.items.some(i => i.tierId === tierId);
        if (hasItem) {
            active.push(reservation);
        }
    }

    return active;
}

/**
 * Check purchase limits for a user/device
 */
export function checkPurchaseLimits(tier, quantity, context = {}) {
    const { userId, deviceId, existingPurchases = [] } = context;
    const limits = tier.limits || {};
    const violations = [];

    // Min per order
    if (limits.minPerOrder && quantity < limits.minPerOrder) {
        violations.push({
            tierId: tier.id,
            limit: 'minPerOrder',
            current: quantity,
            requested: quantity,
            min: limits.minPerOrder,
            message: `Minimum ${limits.minPerOrder} tickets per order`
        });
    }

    // Max per order
    if (limits.maxPerOrder && quantity > limits.maxPerOrder) {
        violations.push({
            tierId: tier.id,
            limit: 'maxPerOrder',
            current: quantity,
            requested: quantity,
            max: limits.maxPerOrder,
            message: `Maximum ${limits.maxPerOrder} tickets per order`
        });
    }

    // Max per user
    if (limits.maxPerUser && userId) {
        const userPurchased = existingPurchases
            .filter(p => p.userId === userId && p.tierId === tier.id)
            .reduce((sum, p) => sum + p.quantity, 0);

        if (userPurchased + quantity > limits.maxPerUser) {
            violations.push({
                tierId: tier.id,
                limit: 'maxPerUser',
                current: userPurchased,
                requested: quantity,
                max: limits.maxPerUser,
                message: `You can only purchase ${limits.maxPerUser - userPurchased} more tickets`
            });
        }
    }

    // Max per device
    if (limits.maxPerDevice && deviceId) {
        const devicePurchased = existingPurchases
            .filter(p => p.deviceId === deviceId && p.tierId === tier.id)
            .reduce((sum, p) => sum + p.quantity, 0);

        if (devicePurchased + quantity > limits.maxPerDevice) {
            violations.push({
                tierId: tier.id,
                limit: 'maxPerDevice',
                current: devicePurchased,
                requested: quantity,
                max: limits.maxPerDevice,
                message: `Device limit reached for this ticket type`
            });
        }
    }

    return {
        allowed: violations.length === 0,
        violations
    };
}

/**
 * Create a cart reservation with REDIS ATOMICITY
 * This prevents two people from snagging the last ticket simultaneously.
 */
export async function createReservation(event, customerId, deviceId, items, options = {}) {
    const {
        reservationMinutes = DEFAULT_RESERVATION_MINUTES,
        accessCode = null
    } = options;

    const redis = getRedisClient();
    const reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
    const ttlSeconds = reservationMinutes * 60;

    // We use a Redis Mutex (Lock) to ensure atomic check-and-reserve
    // This is the "Double Purchase Protection" you asked about.
    const lockKey = `inv:lock:${event.id}`;
    const acquiredLock = await redis.set(lockKey, "locked", "NX", "EX", 5); // 5 sec lock

    if (!acquiredLock) {
        throw new Error("System is busy processing transactions. Please try again in 1 second.");
    }

    try {
        // 1. Re-check availability now that we have the lock
        for (const item of items) {
            const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId) ||
                event.tickets?.find(t => t.id === item.tierId);

            const available = await calculateEffectiveInventory(tier, event);
            if (item.quantity > available) {
                throw new Error(`Insufficient tickets available for ${tier.name}.`);
            }
        }

        // 2. All items available, commit the reservation to Redis
        const reservation = {
            id: reservationId,
            eventId: event.id,
            customerId,
            deviceId,
            items: items.map(i => ({ tierId: i.tierId, quantity: i.quantity })),
            accessCode,
            status: 'active',
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString()
        };

        const multi = redis.multi();

        // Store reservation data
        multi.set(`${REDIS_RES_PREFIX}${reservationId}`, JSON.stringify(reservation), "EX", ttlSeconds);

        // Index by tier for fast availability calculations
        for (const item of items) {
            multi.sadd(`${REDIS_TIER_RES_PREFIX}${event.id}:tier:${item.tierId}`, reservationId);
        }

        await multi.exec();

        return {
            success: true,
            reservationId,
            expiresAt: reservation.expiresAt,
            expiresInSeconds: ttlSeconds
        };
    } finally {
        // Always release the lock
        await redis.del(lockKey);
    }
}

/**
 * Release a cart reservation (and remove from Redis indices)
 */
export async function releaseReservation(reservationId) {
    const redis = getRedisClient();
    const resKey = `${REDIS_RES_PREFIX}${reservationId}`;

    const resData = await redis.get(resKey);
    if (!resData) return { success: false, error: 'Reservation not found' };

    const reservation = JSON.parse(resData);

    // Atomically remove data and index references
    const multi = redis.multi();
    multi.del(resKey);
    for (const item of reservation.items) {
        multi.srem(`${REDIS_TIER_RES_PREFIX}${reservation.eventId}:tier:${item.tierId}`, reservationId);
    }

    await multi.exec();
    return { success: true };
}

/**
 * Convert a reservation to an order (Permanent conversion)
 */
export async function convertReservation(reservationId, orderId) {
    const redis = getRedisClient();
    const resKey = `${REDIS_RES_PREFIX}${reservationId}`;

    const resData = await redis.get(resKey);
    if (!resData) return { success: false, error: 'Reservation not found' };

    const reservation = JSON.parse(resData);
    reservation.status = 'converted';
    reservation.orderId = orderId;
    reservation.convertedAt = new Date().toISOString();

    // Kill the reservation in Redis (it's now a permanent order in Firestore)
    await releaseReservation(reservationId);

    return { success: true };
}

/**
 * Get reservation by ID from Redis
 */
export async function getReservation(reservationId) {
    const redis = getRedisClient();
    const resData = await redis.get(`${REDIS_RES_PREFIX}${reservationId}`);
    return resData ? JSON.parse(resData) : null;
}

/**
 * Clean up expired reservations
 */
export function cleanupExpiredReservations() {
    const now = new Date();
    let cleaned = 0;

    for (const [id, reservation] of reservations) {
        if (reservation.status === 'active' && new Date(reservation.expiresAt) < now) {
            reservation.status = 'expired';
            cleaned++;
        }
    }

    return { cleaned };
}

/**
 * Create a holdback for a tier
 */
export function createHoldback(event, tierId, holdback) {
    const tier = event.ticketCatalog?.tiers?.find(t => t.id === tierId) ||
        event.tickets?.find(t => t.id === tierId);

    if (!tier) {
        return { success: false, error: 'Tier not found' };
    }

    // Check if we have enough inventory
    const available = calculateEffectiveInventory(tier, event);
    if (holdback.quantity > available) {
        return {
            success: false,
            error: `Cannot hold ${holdback.quantity} tickets. Only ${available} available.`
        };
    }

    const newHoldback = {
        id: randomUUID(),
        pool: holdback.pool,          // 'venue', 'host', 'promoter', 'admin'
        quantity: holdback.quantity,
        reason: holdback.reason,
        heldBy: holdback.heldBy,
        heldAt: new Date().toISOString(),
        expiresAt: holdback.expiresAt || null
    };

    // Initialize holdbacks array if needed
    if (!tier.inventory) {
        tier.inventory = {};
    }
    if (!tier.inventory.holdbacks) {
        tier.inventory.holdbacks = [];
    }

    tier.inventory.holdbacks.push(newHoldback);

    return { success: true, holdback: newHoldback };
}

/**
 * Release a holdback
 */
export function releaseHoldback(event, tierId, holdbackId) {
    const tier = event.ticketCatalog?.tiers?.find(t => t.id === tierId) ||
        event.tickets?.find(t => t.id === tierId);

    if (!tier || !tier.inventory?.holdbacks) {
        return { success: false, error: 'Holdback not found' };
    }

    const index = tier.inventory.holdbacks.findIndex(h => h.id === holdbackId);
    if (index === -1) {
        return { success: false, error: 'Holdback not found' };
    }

    const released = tier.inventory.holdbacks.splice(index, 1)[0];

    return { success: true, released };
}

/**
 * Create an inventory release (drop)
 */
export function createInventoryRelease(event, tierId, release) {
    const tier = event.ticketCatalog?.tiers?.find(t => t.id === tierId) ||
        event.tickets?.find(t => t.id === tierId);

    if (!tier) {
        return { success: false, error: 'Tier not found' };
    }

    const newRelease = {
        id: randomUUID(),
        name: release.name,
        quantity: release.quantity,
        releasesAt: release.releasesAt,
        status: 'pending'
    };

    if (!tier.inventory) {
        tier.inventory = {};
    }
    if (!tier.inventory.releaseSchedule) {
        tier.inventory.releaseSchedule = [];
    }

    tier.inventory.releaseSchedule.push(newRelease);

    return { success: true, release: newRelease };
}

/**
 * Process scheduled inventory releases
 */
export function processScheduledReleases(event) {
    const now = new Date();
    const released = [];

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];

    for (const tier of tiers) {
        if (!tier.inventory?.releaseSchedule) continue;

        for (const release of tier.inventory.releaseSchedule) {
            if (release.status === 'pending' && new Date(release.releasesAt) <= now) {
                release.status = 'released';

                // Add to remaining inventory
                if (tier.inventory.remainingQuantity !== undefined) {
                    tier.inventory.remainingQuantity += release.quantity;
                } else if (tier.remaining !== undefined) {
                    tier.remaining += release.quantity;
                }

                released.push({
                    tierId: tier.id,
                    tierName: tier.name,
                    releaseId: release.id,
                    releaseName: release.name,
                    quantity: release.quantity
                });
            }
        }
    }

    return { released };
}

/**
 * Decrement inventory for confirmed order
 */
export function decrementInventory(event, items) {
    const updates = [];

    for (const item of items) {
        const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId) ||
            event.tickets?.find(t => t.id === item.tierId);

        if (!tier) {
            throw new Error(`Tier not found: ${item.tierId}`);
        }

        // Get current remaining
        let remaining;
        if (tier.inventory?.remainingQuantity !== undefined) {
            remaining = tier.inventory.remainingQuantity;
        } else if (tier.remaining !== undefined) {
            remaining = tier.remaining;
        } else {
            remaining = tier.quantity || 0;
        }

        // Check availability
        if (remaining < item.quantity && !tier.inventory?.allowOversell) {
            throw new Error(`Insufficient inventory for ${tier.name}. Requested: ${item.quantity}, Available: ${remaining}`);
        }

        // Decrement
        const newRemaining = Math.max(0, remaining - item.quantity);

        if (tier.inventory) {
            tier.inventory.remainingQuantity = newRemaining;
        } else {
            tier.remaining = newRemaining;
        }

        updates.push({
            tierId: tier.id,
            tierName: tier.name,
            before: remaining,
            after: newRemaining,
            decremented: item.quantity
        });
    }

    return { success: true, updates };
}

/**
 * Restore inventory for cancelled/refunded order
 */
export function restoreInventory(event, items) {
    const updates = [];

    for (const item of items) {
        const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId) ||
            event.tickets?.find(t => t.id === item.tierId);

        if (!tier) continue;

        // Get current and max
        let remaining;
        if (tier.inventory?.remainingQuantity !== undefined) {
            remaining = tier.inventory.remainingQuantity;
        } else if (tier.remaining !== undefined) {
            remaining = tier.remaining;
        } else {
            remaining = 0;
        }

        const max = tier.inventory?.totalQuantity || tier.quantity || Infinity;

        // Restore (don't exceed max)
        const newRemaining = Math.min(max, remaining + item.quantity);

        if (tier.inventory) {
            tier.inventory.remainingQuantity = newRemaining;
        } else {
            tier.remaining = newRemaining;
        }

        updates.push({
            tierId: tier.id,
            tierName: tier.name,
            before: remaining,
            after: newRemaining,
            restored: item.quantity
        });
    }

    return { success: true, updates };
}

/**
 * Get inventory summary for an event
 */
export function getInventorySummary(event) {
    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const summary = {
        totalCapacity: 0,
        totalSold: 0,
        totalRemaining: 0,
        totalHeld: 0,
        totalReserved: 0,
        tiers: []
    };

    for (const tier of tiers) {
        const total = tier.inventory?.totalQuantity || tier.quantity || 0;
        const remaining = tier.inventory?.remainingQuantity ?? tier.remaining ?? total;
        const sold = total - remaining;

        // Calculate held
        let held = 0;
        if (tier.inventory?.holdbacks) {
            const now = new Date();
            for (const holdback of tier.inventory.holdbacks) {
                if (!holdback.expiresAt || new Date(holdback.expiresAt) > now) {
                    held += holdback.quantity;
                }
            }
        }

        // Calculate reserved in carts
        const reserved = getActiveReservationsForTier(event.id, tier.id)
            .reduce((sum, r) => {
                const item = r.items.find(i => i.tierId === tier.id);
                return sum + (item?.quantity || 0);
            }, 0);

        summary.totalCapacity += total;
        summary.totalSold += sold;
        summary.totalRemaining += remaining;
        summary.totalHeld += held;
        summary.totalReserved += reserved;

        summary.tiers.push({
            id: tier.id,
            name: tier.name,
            entryType: tier.entryType || 'general',
            total,
            sold,
            remaining,
            held,
            reserved,
            available: Math.max(0, remaining - held - reserved),
            percentSold: total > 0 ? Math.round((sold / total) * 100) : 0
        });
    }

    return summary;
}

export default {
    checkAvailability,
    calculateEffectiveInventory,
    checkPurchaseLimits,
    createReservation,
    releaseReservation,
    convertReservation,
    getReservation,
    cleanupExpiredReservations,
    createHoldback,
    releaseHoldback,
    createInventoryRelease,
    processScheduledReleases,
    decrementInventory,
    restoreInventory,
    getInventorySummary,
    DEFAULT_RESERVATION_MINUTES
};

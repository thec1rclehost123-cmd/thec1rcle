/**
 * THE C1RCLE - Inventory Engine
 * Production-grade inventory management with cart reservations, holdbacks, and atomic operations
 */

import { randomUUID } from "node:crypto";

// Cart reservation timeout (default 10 minutes)
const DEFAULT_RESERVATION_MINUTES = 10;

// In-memory reservation store for development
const reservations = new Map();

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
 * Calculate effective inventory for a tier (accounting for holdbacks and reservations)
 */
export function calculateEffectiveInventory(tier, event, excludeReservationId = null) {
    const inventory = tier.inventory || {};

    // Unlimited inventory
    if (inventory.type === 'unlimited') {
        return Infinity;
    }

    // Get base remaining quantity
    let remaining = inventory.remainingQuantity ?? tier.remaining ?? tier.quantity ?? 0;

    // Subtract active holdbacks
    if (inventory.holdbacks && Array.isArray(inventory.holdbacks)) {
        const now = new Date();
        for (const holdback of inventory.holdbacks) {
            // Check if holdback is expired
            if (holdback.expiresAt && new Date(holdback.expiresAt) < now) {
                continue;
            }
            remaining -= holdback.quantity;
        }
    }

    // Subtract active cart reservations
    const activeReservations = getActiveReservationsForTier(
        event.id,
        tier.id,
        excludeReservationId
    );

    for (const reservation of activeReservations) {
        const reservedItem = reservation.items.find(i => i.tierId === tier.id);
        if (reservedItem) {
            remaining -= reservedItem.quantity;
        }
    }

    // Check scheduled releases
    if (inventory.releaseSchedule && Array.isArray(inventory.releaseSchedule)) {
        const now = new Date();
        for (const release of inventory.releaseSchedule) {
            if (release.status === 'pending' && new Date(release.releasesAt) <= now) {
                // This release should have happened - add to available
                remaining += release.quantity;
            }
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
 * Create a cart reservation
 */
export function createReservation(eventId, customerId, deviceId, items, options = {}) {
    const {
        reservationMinutes = DEFAULT_RESERVATION_MINUTES,
        accessCode = null
    } = options;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + reservationMinutes * 60 * 1000);

    const reservation = {
        id: randomUUID(),
        eventId,
        customerId,
        deviceId,
        items: items.map(i => ({
            tierId: i.tierId,
            quantity: i.quantity
        })),
        accessCode,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
    };

    reservations.set(reservation.id, reservation);

    return {
        success: true,
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt,
        expiresInSeconds: reservationMinutes * 60
    };
}

/**
 * Release a cart reservation
 */
export function releaseReservation(reservationId) {
    const reservation = reservations.get(reservationId);
    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    reservation.status = 'released';
    reservation.releasedAt = new Date().toISOString();

    return { success: true };
}

/**
 * Convert a reservation to an order
 */
export function convertReservation(reservationId, orderId) {
    const reservation = reservations.get(reservationId);
    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    // Check if expired
    if (new Date(reservation.expiresAt) < new Date()) {
        reservation.status = 'expired';
        return { success: false, error: 'Reservation has expired' };
    }

    reservation.status = 'converted';
    reservation.orderId = orderId;
    reservation.convertedAt = new Date().toISOString();

    return { success: true };
}

/**
 * Get reservation by ID
 */
export function getReservation(reservationId) {
    return reservations.get(reservationId) || null;
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
        pool: holdback.pool,          // 'club', 'host', 'promoter', 'admin'
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

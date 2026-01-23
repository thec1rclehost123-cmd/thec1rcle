/**
 * THE C1RCLE - Inventory Service (Phase 1)
 * Service module for cart reservations and inventory management
 * Location: apps/partner-dashboard/lib/server/inventoryService.js
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

// Default reservation timeout (10 minutes)
const DEFAULT_RESERVATION_MINUTES = 10;

// Collection names
const RESERVATIONS_COLLECTION = "cart_reservations";

// In-memory fallback for development
const fallbackReservations = new Map();

/**
 * Check availability for requested items
 * Returns detailed availability per tier
 */
export async function checkAvailability(event, items, options = {}) {
    const {
        excludeReservationId = null,
        timestamp = new Date(),
        userId = null,
        accessCode = null
    } = options;

    const results = [];
    let allAvailable = true;
    const errors = [];
    const warnings = [];

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];

    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);

        if (!tier) {
            results.push({
                tierId: item.tierId,
                requested: item.quantity,
                available: 0,
                canFulfill: false,
                error: 'Ticket tier not found'
            });
            errors.push(`Tier not found: ${item.tierId}`);
            allAvailable = false;
            continue;
        }

        // Check sale window
        const now = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const salesStart = new Date(tier.salesStart || tier.saleWindow?.startsAt || event.startDate);
        const salesEnd = new Date(tier.salesEnd || tier.saleWindow?.endsAt || event.startDate);

        if (now < salesStart) {
            results.push({
                tierId: item.tierId,
                tierName: tier.name,
                requested: item.quantity,
                available: 0,
                canFulfill: false,
                error: `Sales start ${salesStart.toLocaleDateString()}`
            });
            allAvailable = false;
            continue;
        }

        if (now > salesEnd) {
            results.push({
                tierId: item.tierId,
                tierName: tier.name,
                requested: item.quantity,
                available: 0,
                canFulfill: false,
                error: 'Sales have ended'
            });
            allAvailable = false;
            continue;
        }

        // Check visibility restrictions
        if (tier.hidden || tier.visibility?.isHidden) {
            if (!accessCode) {
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
        }

        if (tier.requiresCode || tier.visibility?.requiresCode) {
            const validCodes = tier.accessCode ? [tier.accessCode] : (tier.visibility?.accessCodes || []);
            if (!accessCode || !validCodes.includes(accessCode)) {
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

        // Check purchase limits
        const minPerOrder = tier.minPerOrder || tier.limits?.minPerOrder || 1;
        const maxPerOrder = tier.maxPerOrder || tier.limits?.maxPerOrder || 10;

        if (item.quantity < minPerOrder) {
            results.push({
                tierId: item.tierId,
                tierName: tier.name,
                requested: item.quantity,
                available: tier.remaining ?? tier.quantity,
                canFulfill: false,
                error: `Minimum ${minPerOrder} tickets per order`
            });
            allAvailable = false;
            continue;
        }

        if (item.quantity > maxPerOrder) {
            results.push({
                tierId: item.tierId,
                tierName: tier.name,
                requested: item.quantity,
                available: tier.remaining ?? tier.quantity,
                canFulfill: false,
                error: `Maximum ${maxPerOrder} tickets per order`
            });
            allAvailable = false;
            continue;
        }

        // Calculate available inventory (minus active reservations)
        const baseRemaining = tier.remaining ?? tier.inventory?.remainingQuantity ?? tier.quantity ?? 0;
        const reservedCount = await getReservedCountForTier(event.id, tier.id, excludeReservationId);
        const effectiveAvailable = Math.max(0, baseRemaining - reservedCount);

        const canFulfill = item.quantity <= effectiveAvailable;

        if (!canFulfill) {
            allAvailable = false;
            if (effectiveAvailable === 0) {
                errors.push(`${tier.name} is sold out`);
            } else {
                errors.push(`Only ${effectiveAvailable} ${tier.name} tickets available`);
            }
        }

        results.push({
            tierId: item.tierId,
            tierName: tier.name,
            requested: item.quantity,
            available: effectiveAvailable,
            baseRemaining,
            reserved: reservedCount,
            canFulfill,
            error: canFulfill ? null : (effectiveAvailable === 0 ? 'Sold out' : `Only ${effectiveAvailable} available`)
        });
    }

    return {
        available: allAvailable,
        items: results,
        errors,
        warnings
    };
}

/**
 * Get count of tickets reserved in active carts for a tier
 */
async function getReservedCountForTier(eventId, tierId, excludeId = null) {
    const now = new Date();
    let count = 0;

    if (!isFirebaseConfigured()) {
        // Use in-memory fallback
        for (const [id, reservation] of fallbackReservations) {
            if (id === excludeId) continue;
            if (reservation.eventId !== eventId) continue;
            if (reservation.status !== 'active') continue;
            if (new Date(reservation.expiresAt) < now) continue;

            const item = reservation.items.find(i => i.tierId === tierId);
            if (item) {
                count += item.quantity;
            }
        }
        return count;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(RESERVATIONS_COLLECTION)
        .where('eventId', '==', eventId)
        .where('status', '==', 'active')
        .get();

    for (const doc of snapshot.docs) {
        if (doc.id === excludeId) continue;

        const reservation = doc.data();
        if (new Date(reservation.expiresAt) < now) continue;

        const item = reservation.items?.find(i => i.tierId === tierId);
        if (item) {
            count += item.quantity;
        }
    }

    return count;
}

/**
 * Create a cart reservation (holds inventory temporarily)
 * ATOMIC TRANSACTION: Ensures no overselling even under high concurrency.
 */
export async function createReservation(eventId, customerId, deviceId, items, options = {}) {
    const {
        reservationMinutes = DEFAULT_RESERVATION_MINUTES
    } = options;

    if (!isFirebaseConfigured()) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + reservationMinutes * 60 * 1000);
        const reservation = {
            id: randomUUID(),
            eventId,
            customerId,
            deviceId: deviceId || null,
            items: items.map(i => ({
                tierId: i.tierId,
                quantity: Number(i.quantity) || 1
            })),
            status: 'active',
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString()
        };
        fallbackReservations.set(reservation.id, reservation);
        return {
            success: true,
            reservationId: reservation.id,
            expiresAt: reservation.expiresAt,
            expiresInSeconds: reservationMinutes * 60
        };
    }

    const db = getAdminDb();
    const reservationId = randomUUID();

    try {
        const result = await db.runTransaction(async (transaction) => {
            const eventRef = db.collection('events').doc(eventId);
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists) {
                throw new Error('Event not found');
            }

            const event = eventDoc.data();
            const tiers = event.ticketCatalog?.tiers || event.tickets || [];
            const updatedTiers = [...tiers];
            const reservedItems = [];

            // 1. Validate all requested items against atomic current state
            for (const item of items) {
                const tierIndex = updatedTiers.findIndex(t => t.id === item.tierId);
                if (tierIndex === -1) throw new Error(`Tier ${item.tierId} not found`);

                const tier = updatedTiers[tierIndex];
                const inventory = tier.inventory || {};

                // Effective inventory = Remaining - Locked (Active Reservations)
                const baseRemaining = tier.remaining ?? inventory.remainingQuantity ?? tier.quantity ?? 0;
                const currentLocked = tier.lockedQuantity || 0;
                const effectiveAvailable = Math.max(0, baseRemaining - currentLocked);

                if (item.quantity > effectiveAvailable) {
                    throw new Error(`${tier.name} is sold out or unavailable`);
                }

                // Update locked count in the tier for this transaction
                updatedTiers[tierIndex] = {
                    ...tier,
                    lockedQuantity: (tier.lockedQuantity || 0) + item.quantity
                };

                reservedItems.push({
                    tierId: tier.id,
                    tierName: tier.name,
                    quantity: item.quantity,
                    unitPrice: tier.price || 0
                });
            }

            // 2. Prepare reservation doc
            const now = new Date();
            const expiresAt = new Date(now.getTime() + reservationMinutes * 60 * 1000);
            const reservationRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);

            const reservationData = {
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: reservedItems,
                status: 'active',
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };

            // 3. Commit both: create reservation and update event hot-counts
            transaction.set(reservationRef, reservationData);

            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            } else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }

            return {
                reservationId,
                expiresAt: reservationData.expiresAt,
                expiresInSeconds: reservationMinutes * 60
            };
        });

        return { success: true, ...result };
    } catch (error) {
        console.error('[InventoryService] Atomic reservation failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a reservation by ID
 */
export async function getReservation(reservationId) {
    if (!isFirebaseConfigured()) {
        return fallbackReservations.get(reservationId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() };
}

/**
 * Release a cart reservation (user abandons cart)
 * ATOMIC: Restores 'lockedQuantity' to the pool.
 */
export async function releaseReservation(reservationId) {
    if (!isFirebaseConfigured()) {
        const reservation = fallbackReservations.get(reservationId);
        if (!reservation) return { success: false, error: 'Reservation not found' };
        if (reservation.status !== 'active') return { success: false, error: `Reservation is ${reservation.status}` };
        reservation.status = 'released';
        reservation.releasedAt = new Date().toISOString();
        return { success: true };
    }

    const db = getAdminDb();
    const docRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw new Error('Reservation not found');

            const reservation = doc.data();
            if (reservation.status !== 'active') throw new Error(`Reservation is already ${reservation.status}`);

            // 1. Mark reservation as released
            transaction.update(docRef, {
                status: 'released',
                releasedAt: new Date().toISOString()
            });

            // 2. Decrement lockedQuantity on event tiers
            const eventRef = db.collection('events').doc(reservation.eventId);
            const eventDoc = await transaction.get(eventRef);

            if (eventDoc.exists) {
                const event = eventDoc.data();
                const tiers = event.ticketCatalog?.tiers || event.tickets || [];
                const updatedTiers = [...tiers];

                for (const item of reservation.items) {
                    const idx = updatedTiers.findIndex(t => t.id === item.tierId);
                    if (idx !== -1) {
                        const tier = updatedTiers[idx];
                        updatedTiers[idx] = {
                            ...tier,
                            lockedQuantity: Math.max(0, (tier.lockedQuantity || 0) - item.quantity)
                        };
                    }
                }

                if (event.ticketCatalog) {
                    transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
                } else {
                    transaction.update(eventRef, { tickets: updatedTiers });
                }
            }
        });

        return { success: true };
    } catch (error) {
        console.error('[InventoryService] Release reservation failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Convert a reservation to an order (when payment is initiated)
 */
export async function convertReservation(reservationId, orderId) {
    if (!isFirebaseConfigured()) {
        const reservation = fallbackReservations.get(reservationId);
        if (!reservation) {
            return { success: false, error: 'Reservation not found' };
        }

        if (reservation.status !== 'active') {
            return { success: false, error: `Reservation is ${reservation.status}` };
        }

        if (new Date(reservation.expiresAt) < new Date()) {
            reservation.status = 'expired';
            return { success: false, error: 'Reservation has expired' };
        }

        reservation.status = 'converted';
        reservation.orderId = orderId;
        reservation.convertedAt = new Date().toISOString();
        return { success: true };
    }

    const db = getAdminDb();
    const docRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, error: 'Reservation not found' };
    }

    const reservation = doc.data();

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    if (new Date(reservation.expiresAt) < new Date()) {
        await docRef.update({ status: 'expired' });
        return { success: false, error: 'Reservation has expired' };
    }

    await docRef.update({
        status: 'converted',
        orderId,
        convertedAt: new Date().toISOString()
    });

    return { success: true };
}

/**
 * Clean up expired reservations (run periodically)
 * ATOMIC: Correctly restores 'lockedQuantity' for every expired cart.
 */
export async function cleanupExpiredReservations() {
    const now = new Date();
    let cleaned = 0;

    if (!isFirebaseConfigured()) {
        for (const [id, reservation] of fallbackReservations) {
            if (reservation.status === 'active' && new Date(reservation.expiresAt) < now) {
                reservation.status = 'expired';
                cleaned++;
            }
        }
        return { cleaned };
    }

    const db = getAdminDb();

    // 1. Find active but expired reservations
    const snapshot = await db.collection(RESERVATIONS_COLLECTION)
        .where('status', '==', 'active')
        .where('expiresAt', '<', now.toISOString())
        .limit(50) // Process in chunks to avoid timeout
        .get();

    if (snapshot.empty) return { cleaned: 0 };

    // Grouping by event to minimize transactions on the same event doc
    const eventGroups = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!eventGroups[data.eventId]) eventGroups[data.eventId] = [];
        eventGroups[data.eventId].push({ id: doc.id, ...data });
    });

    // 2. Process each event group atomically
    for (const eventId of Object.keys(eventGroups)) {
        const group = eventGroups[eventId];

        try {
            await db.runTransaction(async (transaction) => {
                const eventRef = db.collection('events').doc(eventId);
                const eventDoc = await transaction.get(eventRef);

                if (!eventDoc.exists) {
                    // If event missing, just mark reservations as expired and move on
                    group.forEach(r => transaction.update(db.collection(RESERVATIONS_COLLECTION).doc(r.id), { status: 'expired' }));
                    return;
                }

                const event = eventDoc.data();
                const tiers = event.ticketCatalog?.tiers || event.tickets || [];
                const updatedTiers = [...tiers];

                for (const reservation of group) {
                    // Mark res as expired
                    transaction.update(db.collection(RESERVATIONS_COLLECTION).doc(reservation.id), {
                        status: 'expired',
                        expiredAt: new Date().toISOString()
                    });

                    // Restore lockedQuantity
                    for (const item of reservation.items) {
                        const idx = updatedTiers.findIndex(t => t.id === item.tierId);
                        if (idx !== -1) {
                            updatedTiers[idx] = {
                                ...updatedTiers[idx],
                                lockedQuantity: Math.max(0, (updatedTiers[idx].lockedQuantity || 0) - item.quantity)
                            };
                        }
                    }
                }

                // Apply restored counts
                if (event.ticketCatalog) {
                    transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
                } else {
                    transaction.update(eventRef, { tickets: updatedTiers });
                }
            });
            cleaned += group.length;
        } catch (e) {
            console.error(`[InventoryService] Cleanup failed for event ${eventId}:`, e);
        }
    }

    return { cleaned };
}

/**
 * Decrement inventory when order is confirmed (atomic transaction)
 * Also releases the 'lockedQuantity' from the reservation if applicable.
 */
export async function decrementInventory(eventId, items, options = {}) {
    const { reservationId = null } = options;

    if (!isFirebaseConfigured()) {
        console.warn('[InventoryService] Using fallback inventory decrement - not atomic');
        return { success: true, updates: items };
    }

    const db = getAdminDb();

    try {
        const result = await db.runTransaction(async (transaction) => {
            const eventRef = db.collection('events').doc(eventId);
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists) throw new Error(`Event not found: ${eventId}`);

            const event = eventDoc.data();
            const tiers = event.ticketCatalog?.tiers || event.tickets || [];
            const updatedTiers = [...tiers];
            const results = [];

            // If we have a reservation, we'll mark it as converted
            if (reservationId) {
                const resRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
                const resDoc = await transaction.get(resRef);
                if (resDoc.exists && resDoc.data().status === 'active') {
                    transaction.update(resRef, {
                        status: 'converted',
                        convertedAt: new Date().toISOString()
                    });
                }
            }

            for (const item of items) {
                const tierIndex = updatedTiers.findIndex(t => t.id === item.tierId);
                if (tierIndex === -1) throw new Error(`Tier not found: ${item.tierId}`);

                const tier = updatedTiers[tierIndex];
                const currentRemaining = tier.remaining ?? tier.inventory?.remainingQuantity ?? tier.quantity ?? 0;

                // Deduct from physical stock
                const newRemaining = Math.max(0, currentRemaining - item.quantity);

                // IMPORTANT: Deduct from locked pool since it's now a confirmed sale
                const newLocked = Math.max(0, (tier.lockedQuantity || 0) - item.quantity);

                if (tier.inventory) {
                    updatedTiers[tierIndex] = {
                        ...tier,
                        lockedQuantity: newLocked,
                        inventory: { ...tier.inventory, remainingQuantity: newRemaining }
                    };
                } else {
                    updatedTiers[tierIndex] = {
                        ...tier,
                        remaining: newRemaining,
                        lockedQuantity: newLocked
                    };
                }

                results.push({
                    tierId: item.tierId,
                    tierName: tier.name,
                    before: currentRemaining,
                    after: newRemaining,
                    decremented: item.quantity
                });
            }

            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            } else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }

            return results;
        });

        return { success: true, updates: result };
    } catch (error) {
        console.error('[InventoryService] Atomic decrement failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Restore inventory when order is cancelled/refunded
 */
export async function restoreInventory(eventId, items) {
    if (!isFirebaseConfigured()) {
        console.warn('[InventoryService] Using fallback inventory restore - not atomic');
        return { success: true, updates: items };
    }

    const db = getAdminDb();

    try {
        const updates = await db.runTransaction(async (transaction) => {
            const eventRef = db.collection('events').doc(eventId);
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists) {
                throw new Error(`Event not found: ${eventId}`);
            }

            const event = eventDoc.data();
            const tiers = event.ticketCatalog?.tiers || event.tickets || [];
            const updatedTiers = [...tiers];
            const results = [];

            for (const item of items) {
                const tierIndex = updatedTiers.findIndex(t => t.id === item.tierId);
                if (tierIndex === -1) continue;

                const tier = updatedTiers[tierIndex];
                const currentRemaining = tier.remaining ?? tier.inventory?.remainingQuantity ?? 0;
                const maxQuantity = tier.quantity ?? tier.inventory?.totalQuantity ?? Infinity;

                const newRemaining = Math.min(maxQuantity, currentRemaining + item.quantity);

                // Update the tier
                if (tier.inventory) {
                    updatedTiers[tierIndex] = {
                        ...tier,
                        inventory: { ...tier.inventory, remainingQuantity: newRemaining }
                    };
                } else {
                    updatedTiers[tierIndex] = { ...tier, remaining: newRemaining };
                }

                results.push({
                    tierId: item.tierId,
                    tierName: tier.name,
                    before: currentRemaining,
                    after: newRemaining,
                    restored: item.quantity
                });
            }

            // Determine which field to update
            if (event.ticketCatalog) {
                transaction.update(eventRef, {
                    'ticketCatalog.tiers': updatedTiers,
                    updatedAt: new Date().toISOString()
                });
            } else {
                transaction.update(eventRef, {
                    tickets: updatedTiers,
                    updatedAt: new Date().toISOString()
                });
            }

            return results;
        });

        return { success: true, updates };
    } catch (error) {
        console.error('[InventoryService] Restore failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get inventory summary for an event
 */
export async function getInventorySummary(event) {
    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const summary = {
        totalCapacity: 0,
        totalSold: 0,
        totalRemaining: 0,
        totalReserved: 0,
        percentSold: 0,
        tiers: []
    };

    for (const tier of tiers) {
        const total = tier.quantity ?? tier.inventory?.totalQuantity ?? 0;
        const remaining = tier.remaining ?? tier.inventory?.remainingQuantity ?? total;
        const sold = Math.max(0, total - remaining);
        const reserved = await getReservedCountForTier(event.id, tier.id);

        summary.totalCapacity += total;
        summary.totalSold += sold;
        summary.totalRemaining += remaining;
        summary.totalReserved += reserved;

        summary.tiers.push({
            id: tier.id,
            name: tier.name,
            entryType: tier.entryType || 'general',
            total,
            sold,
            remaining,
            reserved,
            available: Math.max(0, remaining - reserved),
            percentSold: total > 0 ? Math.round((sold / total) * 100) : 0
        });
    }

    summary.percentSold = summary.totalCapacity > 0
        ? Math.round((summary.totalSold / summary.totalCapacity) * 100)
        : 0;

    return summary;
}

export default {
    checkAvailability,
    createReservation,
    getReservation,
    releaseReservation,
    convertReservation,
    cleanupExpiredReservations,
    decrementInventory,
    restoreInventory,
    getInventorySummary,
    DEFAULT_RESERVATION_MINUTES
};

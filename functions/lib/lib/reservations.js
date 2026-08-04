"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReservation = exports.cleanupExpiredReservations = exports.releaseInventory = exports.createCartReservation = exports.getTierInventoryStats = void 0;
const firebase_1 = require("./firebase");
// @ts-ignore
const inventory_engine_1 = require("@c1rcle/core/inventory-engine");
const RESERVATIONS_COLLECTION = 'cart_reservations';
/**
 * Gets the aggregated inventory stats (locked + sold) for a tier across all shards
 */
async function getTierInventoryStats(eventId, tierId) {
    const shardsRef = firebase_1.db
        .collection('events')
        .doc(eventId)
        .collection('ticket_shards')
        .where('tierId', '==', tierId);
    const snapshot = await shardsRef.get();
    let locked = 0;
    let sold = 0;
    snapshot.forEach((doc) => {
        const data = doc.data();
        locked += data.lockedQuantity || 0;
        sold += data.soldQuantity || 0;
    });
    return { locked, sold };
}
exports.getTierInventoryStats = getTierInventoryStats;
/**
 * Create a cart reservation (holds inventory temporarily)
 * Delegated to Master Inventory Engine.
 */
async function createCartReservation(eventId, customerId, deviceId, items, options = {}) {
    const eventRef = firebase_1.db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists)
        return { success: false, error: 'Event not found' };
    const event = Object.assign({ id: eventDoc.id }, eventDoc.data());
    try {
        // Use Master Engine with Firestore DB for shard-aware availability check
        const result = await (0, inventory_engine_1.createReservation)(event, customerId, deviceId, items, Object.assign(Object.assign({}, options), { db: firebase_1.db }));
        if (result.success) {
            // Shadow copy to Firestore for legacy audit
            await firebase_1.db
                .collection(RESERVATIONS_COLLECTION)
                .doc(result.reservationId)
                .set({
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: items,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt,
            });
        }
        return result;
    }
    catch (error) {
        console.error('[Reservations] Core reservation failed:', error);
        return { success: false, error: error.message || 'Inventory lock failed' };
    }
}
exports.createCartReservation = createCartReservation;
/**
 * Release inventory back to the pool (on expiry or manual cancellation).
 * Reads reservation items from Firestore so lockedQuantity is always restored
 * even when the Redis key has already expired naturally.
 */
async function releaseInventory(reservationId) {
    // 1. Read Firestore doc before touching Redis (TTL may already be expired)
    const resDoc = await firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();
    const resData = resDoc.exists ? resDoc.data() : null;
    // 2. Release from Redis (best-effort; may return success:false if TTL expired)
    await (0, inventory_engine_1.releaseReservation)(reservationId);
    // 3. Mark Firestore reservation as expired regardless of Redis state
    await firebase_1.db
        .collection(RESERVATIONS_COLLECTION)
        .doc(reservationId)
        .update({
        status: 'expired',
        updatedAt: new Date().toISOString(),
    })
        .catch(() => { });
    // 4. Restore lockedQuantity in the event doc (handles both ticketCatalog and tickets structures)
    if ((resData === null || resData === void 0 ? void 0 : resData.eventId) && Array.isArray(resData.items) && resData.items.length > 0) {
        const eventRef = firebase_1.db.collection('events').doc(resData.eventId);
        await firebase_1.db
            .runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists)
                return;
            const event = eventDoc.data();
            const usesTicketCatalog = !!event.ticketCatalog;
            const sourceTiers = usesTicketCatalog
                ? event.ticketCatalog.tiers || []
                : event.tickets || [];
            const updatedTiers = [...sourceTiers];
            for (const item of resData.items) {
                const idx = updatedTiers.findIndex((t) => t.id === item.tierId);
                if (idx !== -1) {
                    updatedTiers[idx] = Object.assign(Object.assign({}, updatedTiers[idx]), { lockedQuantity: Math.max(0, (updatedTiers[idx].lockedQuantity || 0) - item.quantity) });
                }
            }
            if (usesTicketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            }
            else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }
        })
            .catch((e) => console.warn('[Reservations] lockedQuantity restore failed:', e.message));
    }
    return { success: true };
}
exports.releaseInventory = releaseInventory;
/**
 * Background cleanup for stale reservations
 */
async function cleanupExpiredReservations() {
    const now = new Date();
    const snapshot = await firebase_1.db
        .collection(RESERVATIONS_COLLECTION)
        .where('status', '==', 'active')
        .where('expiresAt', '<', now.toISOString())
        .limit(100)
        .get();
    console.log(`[Cleanup] Found ${snapshot.size} expired reservations in Firestore`);
    const results = [];
    for (const doc of snapshot.docs) {
        results.push(await releaseInventory(doc.id));
    }
    return results;
}
exports.cleanupExpiredReservations = cleanupExpiredReservations;
async function getReservation(reservationId) {
    const doc = await firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
}
exports.getReservation = getReservation;
//# sourceMappingURL=reservations.js.map
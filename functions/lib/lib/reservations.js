"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReservation = exports.cleanupExpiredReservations = exports.releaseInventory = exports.createCartReservation = exports.getTierInventoryStats = void 0;
const firebase_1 = require("./firebase");
// @ts-ignore
const inventory_engine_1 = require("@c1rcle/core/inventory-engine");
const RESERVATIONS_COLLECTION = "cart_reservations";
/**
 * Gets the aggregated inventory stats (locked + sold) for a tier across all shards
 */
async function getTierInventoryStats(eventId, tierId) {
    const shardsRef = firebase_1.db.collection('events').doc(eventId).collection('ticket_shards')
        .where('tierId', '==', tierId);
    const snapshot = await shardsRef.get();
    let locked = 0;
    let sold = 0;
    snapshot.forEach(doc => {
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
        const result = await (0, inventory_engine_1.createReservation)(event, customerId, deviceId, items, Object.assign(Object.assign({}, options), { db: firebase_1.db // Pass firestore instance for sharded counter support
         }));
        if (result.success) {
            // Shadow copy to Firestore for legacy audit
            await firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(result.reservationId).set({
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: items,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt
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
 * Release inventory back to the pool (on expiry or manual cancellation)
 */
async function releaseInventory(reservationId) {
    const result = await (0, inventory_engine_1.releaseReservation)(reservationId);
    if (result.success) {
        await firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
            status: 'expired',
            updatedAt: new Date().toISOString()
        }).catch(() => { });
    }
    return result;
}
exports.releaseInventory = releaseInventory;
/**
 * Background cleanup for stale reservations
 */
async function cleanupExpiredReservations() {
    const now = new Date();
    const snapshot = await firebase_1.db.collection(RESERVATIONS_COLLECTION)
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
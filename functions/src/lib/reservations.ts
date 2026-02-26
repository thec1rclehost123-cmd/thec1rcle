import { db } from './firebase';
// @ts-ignore
import { createReservation as coreCreateReservation, releaseReservation as coreReleaseReservation, validatePurchase as coreValidatePurchase } from '@c1rcle/core/inventory-engine';

const RESERVATIONS_COLLECTION = "cart_reservations";

/**
 * Gets the aggregated inventory stats (locked + sold) for a tier across all shards
 */
export async function getTierInventoryStats(eventId: string, tierId: string): Promise<{ locked: number, sold: number }> {
    const shardsRef = db.collection('events').doc(eventId).collection('ticket_shards')
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

/**
 * Create a cart reservation (holds inventory temporarily)
 * Delegated to Master Inventory Engine.
 */
export async function createCartReservation(eventId: string, customerId: string, deviceId: string | null, items: any[], options: any = {}) {
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) return { success: false, error: 'Event not found' };
    const event = { id: eventDoc.id, ...eventDoc.data() };

    try {
        // Use Master Engine with Firestore DB for shard-aware availability check
        const result = await coreCreateReservation(event, customerId, deviceId, items, {
            ...options,
            db // Pass firestore instance for sharded counter support
        });

        if (result.success) {
            // Shadow copy to Firestore for legacy audit
            await db.collection(RESERVATIONS_COLLECTION).doc(result.reservationId).set({
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
    } catch (error: any) {
        console.error('[Reservations] Core reservation failed:', error);
        return { success: false, error: error.message || 'Inventory lock failed' };
    }
}


/**
 * Release inventory back to the pool (on expiry or manual cancellation)
 */
export async function releaseInventory(reservationId: string) {
    const result = await coreReleaseReservation(reservationId);

    if (result.success) {
        await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
            status: 'expired',
            updatedAt: new Date().toISOString()
        }).catch(() => { });
    }

    return result;
}

/**
 * Background cleanup for stale reservations
 */
export async function cleanupExpiredReservations() {
    const now = new Date();
    const snapshot = await db.collection(RESERVATIONS_COLLECTION)
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

export async function getReservation(reservationId: string) {
    const doc = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

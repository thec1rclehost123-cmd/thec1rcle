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
 * Release inventory back to the pool (on expiry or manual cancellation).
 * Reads reservation items from Firestore so lockedQuantity is always restored
 * even when the Redis key has already expired naturally.
 */
export async function releaseInventory(reservationId: string) {
    // 1. Read Firestore doc before touching Redis (TTL may already be expired)
    const resDoc = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();
    const resData = resDoc.exists ? resDoc.data() : null;

    // 2. Release from Redis (best-effort; may return success:false if TTL expired)
    await coreReleaseReservation(reservationId);

    // 3. Mark Firestore reservation as expired regardless of Redis state
    await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
        status: 'expired',
        updatedAt: new Date().toISOString()
    }).catch(() => { });

    // 4. Restore lockedQuantity in the event doc (handles both ticketCatalog and tickets structures)
    if (resData?.eventId && Array.isArray(resData.items) && resData.items.length > 0) {
        const eventRef = db.collection('events').doc(resData.eventId);
        await db.runTransaction(async (transaction: any) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists) return;
            const event = eventDoc.data()!;
            const usesTicketCatalog = !!event.ticketCatalog;
            const sourceTiers: any[] = usesTicketCatalog
                ? (event.ticketCatalog.tiers || [])
                : (event.tickets || []);
            const updatedTiers = [...sourceTiers];

            for (const item of resData.items) {
                const idx = updatedTiers.findIndex((t: any) => t.id === item.tierId);
                if (idx !== -1) {
                    updatedTiers[idx] = {
                        ...updatedTiers[idx],
                        lockedQuantity: Math.max(0, (updatedTiers[idx].lockedQuantity || 0) - item.quantity)
                    };
                }
            }

            if (usesTicketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            } else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }
        }).catch((e: any) => console.warn('[Reservations] lockedQuantity restore failed:', e.message));
    }

    return { success: true };
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

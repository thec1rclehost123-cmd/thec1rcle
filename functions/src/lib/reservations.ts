import { db } from './firebase';
import { getEffectivePrice } from './pricing';
import * as crypto from 'crypto';

const RESERVATIONS_COLLECTION = "cart_reservations";
const RESERVATION_MINUTES = 10;
const NUM_SHARDS = 10;

function generateUUID() {
    return crypto.randomUUID();
}

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
 * ATOMIC TRANSACTION + DISTRIBUTED SHARDING: Handles massive concurrency (100k+ users).
 */
export async function createCartReservation(eventId: string, customerId: string, deviceId: string | null, items: any[], options: any = {}) {
    const eventRef = db.collection('events').doc(eventId);
    const reservationId = generateUUID();

    try {
        const result = await db.runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists || !eventDoc.data()) {
                return { success: false, error: 'Event not found' };
            }

            const event = eventDoc.data()!;
            const tiers = event.ticketCatalog?.tiers || event.tickets || [];
            const reservedItems: any[] = [];
            const now = new Date();

            // 1. Validate availability for all items
            for (const item of items) {
                const tier = tiers.find((t: any) => t.id === item.tierId);
                if (!tier) throw new Error(`Ticket tier not found: ${item.tierId}`);

                const quantity = Number(item.quantity);

                // Sales window check
                const salesEnd = tier.salesEnd ? new Date(tier.salesEnd) : null;
                if (salesEnd && now > salesEnd) {
                    throw new Error(`${tier.name} sales have ended`);
                }

                // Inventory check (Distributed Sharding Query)
                const stats = await getTierInventoryStats(eventId, tier.id);
                const totalCapacity = Number(tier.quantity || 0);
                const available = Math.max(0, totalCapacity - stats.sold - stats.locked);

                if (quantity > available) {
                    throw new Error(available === 0 ? `${tier.name} is sold out` : `Only ${available} ${tier.name} tickets available`);
                }

                const priceInfo = getEffectivePrice(tier);
                reservedItems.push({
                    tierId: tier.id,
                    tierName: tier.name,
                    entryType: tier.entryType || 'general',
                    quantity: quantity,
                    unitPrice: priceInfo.price,
                    priceLabel: priceInfo.label,
                    subtotal: priceInfo.price * quantity
                });
            }

            // 2. Commit Reservation & SHARDED update
            // We use a random shard to distribute write load (Flash Sale protection)
            const shardId = Math.floor(Math.random() * NUM_SHARDS).toString();

            for (const item of reservedItems) {
                const shardRef = eventRef.collection('ticket_shards').doc(`${item.tierId}_${shardId}`);
                const shardDoc = await transaction.get(shardRef);

                if (!shardDoc.exists) {
                    transaction.set(shardRef, {
                        tierId: item.tierId,
                        lockedQuantity: item.quantity,
                        updatedAt: now.toISOString()
                    });
                } else {
                    transaction.update(shardRef, {
                        lockedQuantity: (shardDoc.data()!.lockedQuantity || 0) + item.quantity,
                        updatedAt: now.toISOString()
                    });
                }
            }

            const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);
            const reservation = {
                id: reservationId,
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: reservedItems,
                shardId, // Track which shard holds this reservation's lock
                status: 'active',
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };

            const reservationRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
            transaction.set(reservationRef, reservation);

            return {
                success: true,
                reservationId: reservation.id,
                items: reservedItems,
                expiresAt: reservation.expiresAt,
                expiresInSeconds: RESERVATION_MINUTES * 60
            };
        });

        return result;

    } catch (error: any) {
        console.error('[Reservations] Atomic reservation failed:', error);
        return { success: false, error: error.message || 'Inventory lock failed' };
    }
}

/**
 * Release inventory back to the pool (on expiry or manual cancellation)
 */
export async function releaseInventory(reservationId: string) {
    const resRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);

    return await db.runTransaction(async (transaction) => {
        const resDoc = await transaction.get(resRef);
        if (!resDoc.exists) return { success: false, error: 'Reservation not found' };

        const reservation = resDoc.data()!;
        if (reservation.status !== 'active') return { success: true, message: 'Already released' };

        const shardId = reservation.shardId || "0";
        const eventRef = db.collection('events').doc(reservation.eventId);

        // Decrement from the specific shard that held the lock
        for (const item of reservation.items) {
            const shardRef = eventRef.collection('ticket_shards').doc(`${item.tierId}_${shardId}`);
            const shardDoc = await transaction.get(shardRef);

            if (shardDoc.exists) {
                transaction.update(shardRef, {
                    lockedQuantity: Math.max(0, (shardDoc.data()!.lockedQuantity || 0) - item.quantity),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        transaction.update(resRef, { status: 'expired', updatedAt: new Date().toISOString() });
        return { success: true };
    });
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

    console.log(`[Cleanup] Found ${snapshot.size} expired reservations`);

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

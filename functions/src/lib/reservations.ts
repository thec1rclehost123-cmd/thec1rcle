import { db } from './firebase';
import { getEffectivePrice } from './pricing';
import * as crypto from 'crypto';

const RESERVATIONS_COLLECTION = "cart_reservations";
const RESERVATION_MINUTES = 10;

function generateUUID() {
    return crypto.randomUUID();
}


/**
 * Create a cart reservation (holds inventory temporarily)
 * ATOMIC TRANSACTION: Ensures no overselling even under high concurrency (100k users).
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
            const updatedTiers = [...tiers];
            const reservedItems: any[] = [];
            const now = new Date();

            // 1. Validate availability atomically
            for (const item of items) {
                const tierIndex = updatedTiers.findIndex((t: any) => t.id === item.tierId);
                if (tierIndex === -1) {
                    throw new Error(`Ticket tier not found: ${item.tierId}`);
                }

                const tier = updatedTiers[tierIndex];
                const quantity = Number(item.quantity);

                // Sales window check
                const salesEnd = tier.salesEnd ? new Date(tier.salesEnd) : null;
                if (salesEnd && now > salesEnd) {
                    throw new Error(`${tier.name} sales have ended`);
                }

                // Purchase limits
                const minPerOrder = tier.minPerOrder || 1;
                const maxPerOrder = tier.maxPerOrder || 10;
                if (quantity < minPerOrder || quantity > maxPerOrder) {
                    throw new Error(`Invalid quantity for ${tier.name}. Limits: ${minPerOrder}-${maxPerOrder}`);
                }

                // Inventory check (Atomic: Remaining - Locked)
                const remaining = Number(tier.remaining ?? tier.quantity ?? 0);
                const currentLocked = Number(tier.lockedQuantity || 0);
                const available = Math.max(0, remaining - currentLocked);

                if (quantity > available) {
                    throw new Error(available === 0 ? `${tier.name} is sold out` : `Only ${available} ${tier.name} tickets available`);
                }

                // 2. Optimistic lock increment
                updatedTiers[tierIndex] = {
                    ...tier,
                    lockedQuantity: currentLocked + quantity
                };

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

            // 3. Commit Reservation & Event Update
            const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);
            const reservation = {
                id: reservationId,
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: reservedItems,
                status: 'active',
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };

            const reservationRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
            transaction.set(reservationRef, reservation);

            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            } else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }

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

        const eventRef = db.collection('events').doc(reservation.eventId);
        const eventDoc = await transaction.get(eventRef);

        if (eventDoc.exists) {
            const event = eventDoc.data()!;
            const tiers = event.ticketCatalog?.tiers || event.tickets || [];
            const updatedTiers = [...tiers];

            for (const item of reservation.items) {
                const tierIndex = updatedTiers.findIndex((t: any) => t.id === item.tierId);
                if (tierIndex !== -1) {
                    const t = updatedTiers[tierIndex];
                    updatedTiers[tierIndex] = {
                        ...t,
                        lockedQuantity: Math.max(0, (t.lockedQuantity || 0) - item.quantity)
                    };
                }
            }

            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            } else {
                transaction.update(eventRef, { tickets: updatedTiers });
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
        .limit(50)
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


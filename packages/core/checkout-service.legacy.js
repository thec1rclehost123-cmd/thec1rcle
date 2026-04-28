import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "@c1rcle/core/admin";
import { getEvent } from "@c1rcle/core/event-engine";
import { createOrder, confirmOrder } from "./guest-order-engine.js";
import { invalidateTicketsCache } from "@c1rcle/core/guest-profile-engine";
import { generateOrderQRCodes } from "./guest-qr-engine.js";
import { getPromoterLinkByCode, recordConversion } from "@c1rcle/core/promoter-engine";
import { validatePromoCode } from "@c1rcle/core/promo-service";
import { calculatePricing as coreCalculatePricing, getEffectivePrice } from "@c1rcle/core/pricing-engine";
import { createReservation as coreCreateReservation, releaseReservation as coreReleaseReservation } from "@c1rcle/core/inventory-engine";
import { PUBLIC_LIFECYCLE_STATES } from "@c1rcle/core/events";


// Constants
const RESERVATION_MINUTES = 10;
const RESERVATIONS_COLLECTION = "cart_reservations";

// In-memory fallback
const fallbackReservations = new Map();

function normalizeReservationItems(items = []) {
    return items
        .map((item) => ({
            tierId: item?.tierId || item?.id || null,
            quantity: Number(item?.quantity || 0),
        }))
        .filter((item) => item.tierId && item.quantity > 0)
        .sort((a, b) => String(a.tierId).localeCompare(String(b.tierId)));
}

function reservationItemsMatch(left = [], right = []) {
    return JSON.stringify(normalizeReservationItems(left)) === JSON.stringify(normalizeReservationItems(right));
}

export const __seedReservationForTests = (reservation) => {
    if (!reservation?.id) {
        throw new Error("Reservation id is required");
    }
    fallbackReservations.set(reservation.id, structuredClone(reservation));
};

export const __resetCheckoutStateForTests = () => {
    fallbackReservations.clear();
};

const buildExistingOrderResponse = (order, reservationId, pricing = null, promoterCode = null) => {
    const requiresPayment = !order.isRSVP
        && order.paymentMethod !== 'free'
        && !['confirmed', 'cancelled', 'refunded'].includes(order.status);

    return {
        success: true,
        requiresPayment,
        order,
        reservationId,
        pricing,
        promoterCode,
        message: order.isRSVP
            ? 'RSVP already confirmed!'
            : requiresPayment
                ? 'Checkout already initiated.'
                : 'Order confirmed! Your tickets are ready.'
    };
};

async function resolveEligiblePromoterCode(promoterCode) {
    if (!promoterCode) return null;
    const promoterLink = await getPromoterLinkByCode(promoterCode);
    return promoterLink ? promoterCode : null;
}

// getEffectivePrice is now imported from @c1rcle/core/pricing-engine


/**
 * Check availability and create a cart reservation
 */
export async function createCartReservation(eventId, customerId, deviceId, items, options = {}) {
    const { queueId = null } = options;
    const db = getAdminDb();

    // 1. Idempotency Check: Return existing active reservation for this queueId
    if (queueId && isFirebaseConfigured()) {
        const snapshot = await db.collection(RESERVATIONS_COLLECTION)
            .where('queueId', '==', queueId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            if (new Date(data.expiresAt) > new Date() && reservationItemsMatch(data.items, items)) {
                console.log(`[CheckoutService] Reusing existing reservation ${doc.id} for queueId ${queueId}`);
                return {
                    success: true,
                    reservationId: doc.id,
                    items: data.items,
                    expiresAt: data.expiresAt,
                    expiresInSeconds: Math.floor((new Date(data.expiresAt) - new Date()) / 1000)
                };
            }

            await releaseReservation(doc.id).catch((error) => {
                console.warn(`[CheckoutService] Failed to release stale queue reservation ${doc.id}:`, error?.message || error);
            });
        }
    }

    const event = await getEvent(eventId);
    if (!event) return { success: false, error: 'Event not found' };

    // ── LIFECYCLE GATE ─────────────────────────────────────────────────────
    // Only allow ticket reservations for events that are publicly purchasable.
    // This prevents buying tickets for paused, cancelled, draft, or denied events.
    // Canonical PUBLIC states: scheduled | live — mirrors PUBLIC_LIFECYCLE_STATES.
    if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        const msg = event.lifecycle === 'paused'
            ? 'Ticket sales for this event are temporarily paused.'
            : event.lifecycle === 'cancelled'
                ? 'This event has been cancelled.'
                : event.lifecycle === 'completed'
                    ? 'This event has already ended.'
                    : 'Tickets are not available for this event right now.';
        return { success: false, error: msg };
    }


    try {
        const result = await coreCreateReservation(event, customerId, deviceId, items, options);

        if (result.success && isFirebaseConfigured()) {
            // Also store in Firestore for legacy visibility/audit
            await db.collection(RESERVATIONS_COLLECTION).doc(result.reservationId).set({
                eventId,
                customerId: customerId || null,
                deviceId: deviceId || null,
                queueId: queueId || null,
                items: items, // Simplified for legacy
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt
            });
        }

        return result;
    } catch (error) {
        console.error('[CheckoutService] Reservation failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Release a reservation (user abandons cart)
 */
export async function releaseReservation(reservationId) {
    // 1. Core Release (Redis)
    const result = await coreReleaseReservation(reservationId);

    // 2. Legacy Cleanup (Firestore)
    if (isFirebaseConfigured()) {
        const db = getAdminDb();
        await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
            status: 'released',
            releasedAt: new Date().toISOString()
        }).catch(() => { }); // Ignore if already deleted/replaced
    }

    return result;
}

/**
 * Calculate pricing for a cart (with optional promo/promoter codes)
 */
export async function calculatePricing(eventId, items, options = {}) {
    const { promoCode = null, promoterCode = null, userId = null } = options;

    const event = await getEvent(eventId);
    if (!event) return { success: false, error: 'Event not found' };

    const eligiblePromoterCode = await resolveEligiblePromoterCode(promoterCode);

    // Use unified core engine
    return await coreCalculatePricing({
        event,
        items,
        promoCode,
        promoterCode: eligiblePromoterCode,
        userId,
        promoValidator: validateAndCalculatePromoDiscount // Inject local validator wrapper
    });
}

// calculatePromoterDiscount is now handled by the core engine

/**
 * Validate promo code and calculate discount
 */
export async function validateAndCalculatePromoDiscount(eventId, code, items, userId = null) {
    // 1. Primary: Use the core promo service for validation and calculation (promo_codes collection)
    const result = await validatePromoCode(eventId, code, userId, items);

    if (result.valid) {
        return {
            valid: true,
            amount: result.discountAmount,
            label: result.message,
            promoCode: result.promoCode
        };
    }

    // Only fall back to embedded codes when the promo_codes collection has no record of this
    // code at all. If the code was found but rejected for a business reason (expired, usage
    // limit, tier mismatch) we must NOT fall back — doing so would bypass Redis rate-limiting
    // and allow over-redemption during concurrent checkouts.
    const foundButRejected = result.error && (
        result.error.includes('expired') ||
        result.error.includes('limit') ||
        result.error.includes('not active') ||
        result.error.includes('not yet') ||
        result.error.includes('not apply') ||
        result.error.includes('not valid')
    );
    if (foundButRejected) {
        return { valid: false, error: result.error };
    }

    // 2. Fallback: Check event document for embedded codes (only when code is truly absent from primary store)
    const event = await getEvent(eventId);
    const promoCodes = event?.ticketCatalog?.promoCodes || event?.promoCodes || [];
    const promoCode = promoCodes.find(
        pc => pc.code.toUpperCase() === code.toUpperCase() && pc.isActive !== false
    );

    if (promoCode) {
        const now = new Date();
        if (promoCode.startsAt && now < new Date(promoCode.startsAt)) {
            return { valid: false, error: 'Promo code not yet active' };
        }
        if (promoCode.endsAt && now > new Date(promoCode.endsAt)) {
            return { valid: false, error: 'Promo code has expired' };
        }
        if (promoCode.maxRedemptions && (promoCode.redemptionCount || 0) >= promoCode.maxRedemptions) {
            return { valid: false, error: 'Promo code limit reached' };
        }

        const applicableItems = items.filter(item => {
            if (!promoCode.tierIds || promoCode.tierIds.length === 0) return true;
            return promoCode.tierIds.includes(item.tierId);
        });

        if (applicableItems.length === 0) {
            return { valid: false, error: 'Promo code does not apply to selected tickets' };
        }

        const applicableSubtotal = applicableItems.reduce((sum, i) => sum + i.subtotal, 0);
        let amount;
        if (promoCode.discountType === 'percent') {
            amount = Math.round((applicableSubtotal * promoCode.discountValue / 100) * 100) / 100;
        } else {
            amount = Math.min(promoCode.discountValue, applicableSubtotal);
        }

        return {
            valid: true,
            amount,
            label: promoCode.discountType === 'percent'
                ? `${promoCode.discountValue}% off`
                : `₹${amount} off`
        };
    }

    // Return the original result error if fallback also failed
    return { valid: false, error: result.error || 'Invalid promo code' };
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
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Release a reservation (user abandons cart)
 */
// Handled above in the redone releaseReservation

/**
 * Convert reservation to order and initiate payment
 */
export async function initiateCheckout(reservationId, userId, userDetails, options = {}) {
    const { promoCode = null, promoterCode = null } = options;
    const eligiblePromoterCode = await resolveEligiblePromoterCode(promoterCode);

    // ── RACE CONDITION GUARD ──────────────────────────────────────────────────
    // Acquire a Redis distributed lock for this reservation so only one checkout
    // request can run at a time. Without this, two concurrent browser tabs or
    // network retries can both pass the expiry check and double-book the same slot.
    let redisClient = null;
    const lockKey = `checkout:lock:${reservationId}`;
    const lockTtlSeconds = 30; // must complete checkout within 30s or lock auto-releases

    try {
        redisClient = (await import("@c1rcle/core/redis")).getRedisClient();
        const acquired = await redisClient.set(lockKey, userId, "NX", "EX", lockTtlSeconds);
        if (!acquired) {
            return { success: false, error: 'Checkout is already in progress for this reservation. Please wait a moment and try again.' };
        }
    } catch (redisErr) {
        // Redis unavailable — fall through without lock (best effort)
        console.warn('[CheckoutService] Redis lock unavailable, proceeding without lock:', redisErr.message);
        redisClient = null;
    }

    try {
        return await _initiateCheckoutInner(reservationId, userId, userDetails, options, redisClient);
    } finally {
        // Always release the lock
        if (redisClient) {
            try { await redisClient.del(lockKey); } catch (_) { /* no-op */ }
        }
    }
}

async function _initiateCheckoutInner(reservationId, userId, userDetails, options, redisClient) {
    const { promoCode = null, promoterCode = null } = options;

    // Resolve promoter code and fetch reservation in parallel — independent operations
    const [eligiblePromoterCode, reservation] = await Promise.all([
        resolveEligiblePromoterCode(promoterCode),
        getReservation(reservationId),
    ]);

    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }

    const { getOrderByReservationId, checkExistingRSVP } = await import("./guest-order-engine.js");
    const existingOrder = await getOrderByReservationId(reservationId);

    if (existingOrder && reservation.status !== 'active') {
        return buildExistingOrderResponse(existingOrder, reservationId);
    }

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    // Check if expired — with lock held, this check is now race-condition-safe
    if (new Date(reservation.expiresAt) < new Date()) {
        await updateReservationStatus(reservationId, 'expired');
        return { success: false, error: 'Reservation has expired. Please select tickets again.' };
    }

    const event = await getEvent(reservation.eventId);
    if (!event) {
        return { success: false, error: 'Event not found' };
    }

    // ── LIFECYCLE RE-VALIDATION ────────────────────────────────────────────
    // Re-check lifecycle at checkout time in case the event was paused or
    // cancelled between reservation and payment initiation (race condition guard).
    if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
        const msg = event.lifecycle === 'paused'
            ? 'Ticket sales for this event have been paused. Please contact the organizer.'
            : event.lifecycle === 'cancelled'
                ? 'This event has been cancelled. Your reservation will be released.'
                : 'This event is no longer available for purchase.';
        return { success: false, error: msg };
    }


    const pricingResult = await calculatePricing(
        reservation.eventId,
        reservation.items,
        { promoCode, promoterCode: eligiblePromoterCode, userId }
    );

    if (!pricingResult.success) {
        return { success: false, error: pricingResult.error };
    }

    const pricing = pricingResult.pricing;

    if (existingOrder) {
        return buildExistingOrderResponse(existingOrder, reservationId, pricing, eligiblePromoterCode);
    }

    // RULE: Event type determines backend flow.
    if (event.isRSVP) {
        // Enforce 1 ticket per user across the entire event for RSVP
        const hasRSVP = await checkExistingRSVP(reservation.eventId, {
            userId,
            email: userDetails.email
        });

        if (hasRSVP) {
            // Check if there is already an order for THIS reservation to return it (idempotency)
            if (existingOrder) {
                return buildExistingOrderResponse(existingOrder, reservationId, pricing, eligiblePromoterCode);
            }

            return {
                success: false,
                error: 'Already registered. You can only hold one RSVP ticket for this event.'
            };
        }

        // Enforce total quantity limit (1 per user)
        const totalRequested = reservation.items.reduce((sum, i) => sum + i.quantity, 0);
        if (totalRequested > 1) {
            return {
                success: false,
                error: 'RSVP events are limited to 1 ticket per person.'
            };
        }

        // RSVP Event Logic: Skip gateway, instant confirmation, stored in RSVP bucket
        return await processRSVPOrder(reservation, userId, userDetails, pricing, eligiblePromoterCode);
    } else {
        // Paid Event Logic: Always follows paid flow pipeline.
        if (pricing.isFree) {
            // Case: Zero-priced checkout in a PAID event (e.g. Female Free entry)
            // Stays in PAID bucket, but skips gateway
            return await processFreePaidOrder(reservation, userId, userDetails, pricing, eligiblePromoterCode);
        }

        // Standard Paid Checkout (total > 0)
        // Create the pending order draft immediately as part of orchestration (Step 3)
        const orderPayload = {
            eventId: reservation.eventId,
            eventName: event.title || 'Event',
            userId,
            userName: userDetails.name,
            userEmail: userDetails.email,
            userPhone: userDetails.phone,
            tickets: pricing.items.map(item => ({
                ticketId: item.tierId,
                name: item.tierName,
                entryType: item.entryType || 'general',
                quantity: item.quantity,
                price: item.unitPrice,
                total: item.subtotal
            })),
            subtotal: pricing.subtotal,
            discounts: pricing.discounts,
            discountTotal: pricing.discountTotal,
            fees: pricing.fees,
            totalAmount: pricing.grandTotal,
            status: 'payment_pending',
            reservationId: reservation.id,
            promoterCode: promoterCode || null,
            promoCodeId: pricing.discounts.find(d => d.type === 'promo')?.id || null,
            // SECURITY: Snapshot the cancellation policy at purchase time so organizers
            // cannot retroactively change it to deny legitimate refund requests.
            cancellationPolicySnapshot: {
                policy: event.cancellationPolicy || 'standard',
                refundPercent: event.cancellationRefundPercent ?? null,
                snapshotAt: new Date().toISOString()
            }
        };

        const order = await createOrder(orderPayload);

        return {
            success: true,
            requiresPayment: true,
            order,
            reservationId,
            pricing,
            promoterCode
        };
    }
}

/**
 * Process an RSVP order (Strictly for RSVP-type events)
 */
async function processRSVPOrder(reservation, userId, userDetails, pricing, promoterCode) {
    const { createRSVPOrder } = await import("./guest-order-engine.js");

    // Create RSVP payload
    const rsvpPayload = {
        reservationId: reservation.id,
        eventId: reservation.eventId,
        userId,
        userName: userDetails.name,
        userEmail: userDetails.email,
        userPhone: userDetails.phone,
        tickets: reservation.items.map(item => ({
            ticketId: item.tierId,
            name: item.tierName,
            entryType: item.entryType,
            quantity: item.quantity
        })),
        promoterCode
    };

    // Create RSVP record (separated bucket)
    const order = await createRSVPOrder(rsvpPayload);

    // Bust tickets cache so the tab reflects the new RSVP immediately
    invalidateTicketsCache(userId).catch(() => {});

    // Mark reservation as converted
    await updateReservationStatus(reservation.id, 'converted', { orderId: order.id });

    return {
        success: true,
        requiresPayment: false,
        order,
        message: 'RSVP confirmed! Your tickets are ready.'
    };
}

/**
 * Process a zero-total order within a PAID event pipeline
 */
async function processFreePaidOrder(reservation, userId, userDetails, pricing, promoterCode) {
    const event = await getEvent(reservation.eventId);

    // Extract promo code ID if any
    const promoDiscount = pricing.discounts?.find(d => d.type === 'promo');

    // Create standard order payload but with confirmed status
    const orderPayload = {
        reservationId: reservation.id,
        eventId: reservation.eventId,
        eventName: event?.title || 'Event',
        userId,
        userName: userDetails.name,
        userEmail: userDetails.email,
        userPhone: userDetails.phone,
        tickets: reservation.items.map(item => ({
            ticketId: item.tierId,
            name: item.tierName,
            entryType: item.entryType,
            quantity: item.quantity,
            price: pricing.items.find(i => i.tierId === item.tierId)?.unitPrice || 0,
            total: pricing.items.find(i => i.tierId === item.tierId)?.subtotal || 0
        })),
        totalAmount: 0,
        status: 'confirmed', // Zero-total checkouts are auto-confirmed
        promoterCode,
        promoCodeId: promoDiscount?.id || null,
        paymentMethod: 'free'
    };

    // Create order in PAID bucket (ORDERS_COLLECTION)
    const order = await createOrder(orderPayload);

    // Bust tickets cache so the tab reflects the new order immediately
    invalidateTicketsCache(userId).catch(() => {});

    // Mark reservation as converted
    await updateReservationStatus(reservation.id, 'converted', { orderId: order.id });

    // Generate QR codes with PAID event metadata context
    const qrCodes = await generateOrderQRCodes(order, event);

    return {
        success: true,
        requiresPayment: false,
        order: { ...order, qrCodes },
        message: 'Order confirmed! Your tickets are ready.'
    };
}

/**
 * Complete checkout after payment
 */
export async function completeCheckout(orderId, paymentDetails) {
    // This is called after webhook confirms payment
    // The confirmOrder function handles QR generation and promoter tracking
    return await confirmOrder(orderId, paymentDetails);
}

/**
 * Update reservation status
 */
async function updateReservationStatus(reservationId, status, metadata = {}) {
    if (!isFirebaseConfigured()) {
        const reservation = fallbackReservations.get(reservationId);
        if (reservation) {
            reservation.status = status;
            Object.assign(reservation, metadata);
        }
        return;
    }

    const db = getAdminDb();
    await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
        status,
        ...metadata,
        updatedAt: new Date().toISOString()
    });
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
        .limit(50)
        .get();

    if (snapshot.empty) return { cleaned: 0 };

    // Grouping by event to minimize transactions
    const eventGroups = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!eventGroups[data.eventId]) eventGroups[data.eventId] = [];
        eventGroups[data.eventId].push({ id: doc.id, ...data });
    });

    for (const eventId of Object.keys(eventGroups)) {
        const group = eventGroups[eventId];
        try {
            await db.runTransaction(async (transaction) => {
                const eventRef = db.collection('events').doc(eventId);
                const eventDoc = await transaction.get(eventRef);

                if (!eventDoc.exists) {
                    group.forEach(r => transaction.update(db.collection(RESERVATIONS_COLLECTION).doc(r.id), { status: 'expired' }));
                    return;
                }

                const event = eventDoc.data();
                const tiers = event.ticketCatalog?.tiers || event.tickets || [];
                const updatedTiers = [...tiers];

                for (const reservation of group) {
                    transaction.update(db.collection(RESERVATIONS_COLLECTION).doc(reservation.id), {
                        status: 'expired',
                        expiredAt: new Date().toISOString()
                    });

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

                if (event.ticketCatalog) {
                    transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
                } else {
                    transaction.update(eventRef, { tickets: updatedTiers });
                }
            });
            cleaned += group.length;
        } catch (e) {
            console.error(`[CheckoutService] Cleanup failed for event ${eventId}:`, e);
        }
    }

    return { cleaned };
}

export default {
    createCartReservation,
    calculatePricing,
    getReservation,
    releaseReservation,
    initiateCheckout,
    completeCheckout,
    cleanupExpiredReservations,
    validateAndCalculatePromoDiscount,
    RESERVATION_MINUTES
};

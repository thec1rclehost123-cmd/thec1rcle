/**
 * THE C1RCLE - Checkout Service (Phase 1)
 * Orchestrates cart reservations, pricing, and order creation
 * Location: apps/guest-portal/lib/server/checkoutService.js
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getEvent } from "./eventStore";
import { createOrder, confirmOrder } from "./orderStore";
import { generateOrderQRCodes } from "./qrStore";
import { getPromoterLinkByCode, recordConversion } from "./promoterStore";
import { validatePromoCode } from "@c1rcle/core/promo-service";


// Constants
const RESERVATION_MINUTES = 10;
const RESERVATIONS_COLLECTION = "cart_reservations";

// In-memory fallback
const fallbackReservations = new Map();

/**
 * Get effective price for a tier at a given timestamp
 */
function getEffectivePrice(tier, timestamp = new Date()) {
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Check scheduled prices
    if (tier.scheduledPrices && Array.isArray(tier.scheduledPrices)) {
        for (const schedule of tier.scheduledPrices) {
            const startsAt = new Date(schedule.startsAt);
            const endsAt = new Date(schedule.endsAt);

            if (now >= startsAt && now <= endsAt) {
                return {
                    price: schedule.price,
                    label: schedule.name,
                    isScheduled: true
                };
            }
        }
    }

    // Fall back to base price
    return {
        price: tier.basePrice ?? tier.price ?? 0,
        label: null,
        isScheduled: false
    };
}

/**
 * Check availability and create a cart reservation
 */
export async function createCartReservation(eventId, customerId, deviceId, items, options = {}) {
    const { queueId = null } = options;
    const event = await getEvent(eventId);
    if (!event) {
        return { success: false, error: 'Event not found' };
    }

    const db = isFirebaseConfigured() ? getAdminDb() : null;

    // 1. Idempotency Check: Return existing active reservation for this queueId
    if (queueId) {
        let existingRes = null;
        if (!isFirebaseConfigured()) {
            for (const res of fallbackReservations.values()) {
                if (res.queueId === queueId && res.status === 'active' && new Date(res.expiresAt) > new Date()) {
                    existingRes = res;
                    break;
                }
            }
        } else {
            const snapshot = await db.collection(RESERVATIONS_COLLECTION)
                .where('queueId', '==', queueId)
                .where('status', '==', 'active')
                .limit(1)
                .get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                if (new Date(data.expiresAt) > new Date()) {
                    existingRes = { id: doc.id, ...data };
                }
            }
        }

        if (existingRes) {
            console.log(`[CheckoutService] Reusing existing reservation ${existingRes.id} for queueId ${queueId}`);
            return {
                success: true,
                reservationId: existingRes.id,
                items: existingRes.items,
                expiresAt: existingRes.expiresAt,
                expiresInSeconds: Math.floor((new Date(existingRes.expiresAt) - new Date()) / 1000)
            };
        }
    }

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const errors = [];
    const reservedItems = [];
    const now = new Date();

    // Check availability for each item
    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);

        if (!tier) {
            errors.push(`Ticket tier not found: ${item.tierId}`);
            continue;
        }

        const salesStart = tier.salesStart ? new Date(tier.salesStart) : null;
        const salesEnd = tier.salesEnd ? new Date(tier.salesEnd) : null;

        const isInvalidStart = salesStart && isNaN(salesStart.getTime());
        const isInvalidEnd = salesEnd && isNaN(salesEnd.getTime());

        if (salesStart && !isInvalidStart && now < salesStart) {
            // Relax: If it's a default (matches event.startDate) or a free/RSVP ticket, allow it.
            const startTs = salesStart.getTime();
            const eventStartTs = event.startDate ? new Date(event.startDate).getTime() : 0;
            const isDefaultDate = startTs === eventStartTs;
            const isFree = tier.price === 0 || tier.isFree;

            if (!isDefaultDate && !isFree && !event.isRSVP) {
                errors.push(`${tier.name} sales haven't started yet`);
                continue;
            }
        }

        if (salesEnd && !isInvalidEnd && now > salesEnd) {
            errors.push(`${tier.name} sales have ended`);
            continue;
        }

        // Check purchase limits
        const minPerOrder = tier.minPerOrder || 1;
        const maxPerOrder = tier.maxPerOrder || 10;

        if (item.quantity < minPerOrder) {
            errors.push(`Minimum ${minPerOrder} tickets for ${tier.name}`);
            continue;
        }

        if (item.quantity > maxPerOrder) {
            errors.push(`Maximum ${maxPerOrder} tickets for ${tier.name}`);
            continue;
        }

        // Check inventory (accounting for current reservations)
        const remaining = tier.remaining ?? tier.quantity ?? 0;
        const reservedCount = await getReservedCountForTier(eventId, tier.id);
        const available = Math.max(0, remaining - reservedCount);

        if (item.quantity > available) {
            if (available === 0) {
                errors.push(`${tier.name} is sold out`);
            } else {
                errors.push(`Only ${available} ${tier.name} tickets available`);
            }
            continue;
        }

        // Get effective price
        const priceInfo = getEffectivePrice(tier);

        reservedItems.push({
            tierId: tier.id,
            tierName: tier.name,
            entryType: tier.entryType || 'general',
            quantity: item.quantity,
            unitPrice: priceInfo.price,
            priceLabel: priceInfo.label,
            subtotal: priceInfo.price * item.quantity
        });
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // Create reservation
    const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);

    const reservation = {
        id: randomUUID(),
        eventId,
        customerId,
        deviceId: deviceId || null,
        queueId: queueId || null,
        items: reservedItems,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
    };

    if (!isFirebaseConfigured()) {
        fallbackReservations.set(reservation.id, reservation);
    } else {
        const db = getAdminDb();
        await db.collection(RESERVATIONS_COLLECTION).doc(reservation.id).set(reservation);
    }

    return {
        success: true,
        reservationId: reservation.id,
        items: reservedItems,
        expiresAt: reservation.expiresAt,
        expiresInSeconds: RESERVATION_MINUTES * 60
    };
}

/**
 * Get reserved count for a tier
 */
async function getReservedCountForTier(eventId, tierId, excludeId = null) {
    const now = new Date();
    let count = 0;

    if (!isFirebaseConfigured()) {
        for (const [id, reservation] of fallbackReservations) {
            if (id === excludeId) continue;
            if (reservation.eventId !== eventId) continue;
            if (reservation.status !== 'active') continue;
            if (new Date(reservation.expiresAt) < now) continue;

            const item = reservation.items.find(i => i.tierId === tierId);
            if (item) count += item.quantity;
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
        if (item) count += item.quantity;
    }

    return count;
}

/**
 * Calculate pricing for a cart (with optional promo/promoter codes)
 */
export async function calculatePricing(eventId, items, options = {}) {
    const { promoCode = null, promoterCode = null, userId = null } = options;

    const event = await getEvent(eventId);
    if (!event) {
        return { success: false, error: 'Event not found' };
    }

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const result = {
        items: [],
        subtotal: 0,
        discounts: [],
        discountTotal: 0,
        fees: { platform: 0, payment: 0, gst: 0, total: 0 },
        grandTotal: 0,
        isFree: false
    };

    // Calculate item prices
    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);
        if (!tier) continue;

        const priceInfo = getEffectivePrice(tier);
        const quantity = Number(item.quantity) || 1;
        const subtotal = priceInfo.price * quantity;

        result.items.push({
            tierId: tier.id,
            tierName: tier.name,
            quantity,
            unitPrice: priceInfo.price,
            priceLabel: priceInfo.label,
            subtotal
        });

        result.subtotal += subtotal;
    }

    // Apply promoter discount if applicable
    if (promoterCode && event.promoterSettings?.enabled && event.promoterSettings?.buyerDiscountsEnabled) {
        const promoterLink = await getPromoterLinkByCode(promoterCode);

        if (promoterLink && promoterLink.eventId === eventId) {
            const discountAmount = calculatePromoterDiscount(result.items, event);

            if (discountAmount > 0) {
                result.discounts.push({
                    type: 'promoter',
                    code: promoterCode,
                    amount: discountAmount,
                    label: 'Promoter Discount'
                });
                result.discountTotal += discountAmount;
            }
        }
    }

    // Apply promo code if provided
    if (promoCode) {
        const promoDiscount = await validateAndCalculatePromoDiscount(eventId, promoCode, result.items, userId);

        if (promoDiscount.valid) {
            result.discounts.push({
                type: 'promo',
                code: promoCode,
                id: promoDiscount.promoCode.id,
                amount: promoDiscount.amount,
                label: promoDiscount.label
            });
            result.discountTotal += promoDiscount.amount;
        } else {
            result.promoCodeError = promoDiscount.error;
        }
    }

    // Calculate final subtotal after discounts
    const discountedSubtotal = Math.max(0, result.subtotal - result.discountTotal);

    // Calculate fees (only for paid orders)
    if (discountedSubtotal > 0) {
        result.fees.platform = Math.round((discountedSubtotal * 0.05) * 100) / 100; // 5%
        result.fees.payment = Math.round((discountedSubtotal * 0.025) * 100) / 100; // 2.5%
        result.fees.gst = Math.round(((result.fees.platform + result.fees.payment) * 0.18) * 100) / 100; // 18% GST
        result.fees.total = result.fees.platform + result.fees.payment + result.fees.gst;
    }

    result.grandTotal = Math.round((discountedSubtotal + result.fees.total) * 100) / 100;
    result.isFree = result.grandTotal === 0;

    return { success: true, pricing: result };
}

/**
 * Calculate promoter buyer discount
 */
function calculatePromoterDiscount(items, event) {
    const settings = event.promoterSettings;
    if (!settings?.enabled || !settings?.buyerDiscountsEnabled) return 0;

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    let totalDiscount = 0;

    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);
        if (!tier) continue;

        // Check if tier allows promoter sales
        if (tier.promoterEnabled === false) continue;

        // Get discount rate
        let discountRate = settings.discount || 10;
        let discountType = settings.discountType || 'percent';

        // Check for tier override
        if (!settings.useDefaultDiscount && tier.promoterDiscount !== undefined) {
            discountRate = tier.promoterDiscount;
            discountType = tier.promoterDiscountType || 'percent';
        }

        // Calculate discount
        if (discountType === 'percent') {
            totalDiscount += (item.subtotal * discountRate) / 100;
        } else {
            totalDiscount += discountRate * item.quantity;
        }
    }

    return Math.round(totalDiscount * 100) / 100;
}

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

    // 2. Fallback: Check event document for embedded codes
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
export async function releaseReservation(reservationId) {
    const reservation = await getReservation(reservationId);
    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    if (!isFirebaseConfigured()) {
        reservation.status = 'released';
        reservation.releasedAt = new Date().toISOString();
        return { success: true };
    }

    const db = getAdminDb();
    await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
        status: 'released',
        releasedAt: new Date().toISOString()
    });

    return { success: true };
}

/**
 * Convert reservation to order and initiate payment
 */
export async function initiateCheckout(reservationId, userId, userDetails, options = {}) {
    const { promoCode = null, promoterCode = null } = options;

    const reservation = await getReservation(reservationId);
    if (!reservation) {
        return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'active') {
        return { success: false, error: `Reservation is ${reservation.status}` };
    }

    // Check if expired
    if (new Date(reservation.expiresAt) < new Date()) {
        await updateReservationStatus(reservationId, 'expired');
        return { success: false, error: 'Reservation has expired. Please select tickets again.' };
    }

    const event = await getEvent(reservation.eventId);
    if (!event) {
        return { success: false, error: 'Event not found' };
    }

    // Calculate final pricing
    const pricingResult = await calculatePricing(
        reservation.eventId,
        reservation.items,
        { promoCode, promoterCode, userId }
    );

    if (!pricingResult.success) {
        return { success: false, error: pricingResult.error };
    }

    const pricing = pricingResult.pricing;

    // RULE: Event type determines backend flow.
    if (event.isRSVP) {
        // Enforce 1 ticket per user across the entire event for RSVP
        const { checkExistingRSVP } = await import("./orderStore");
        const hasRSVP = await checkExistingRSVP(reservation.eventId, {
            userId,
            email: userDetails.email
        });

        if (hasRSVP) {
            // Check if there is already an order for THIS reservation to return it (idempotency)
            const { getOrderByReservationId } = await import("./orderStore");
            const existingOrder = await getOrderByReservationId(reservationId);
            if (existingOrder) {
                return {
                    success: true,
                    requiresPayment: false,
                    order: existingOrder,
                    message: 'RSVP already confirmed!'
                };
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
        return await processRSVPOrder(reservation, userId, userDetails, pricing, promoterCode);
    } else {
        // Paid Event Logic: Always follows paid flow pipeline.
        if (pricing.isFree) {
            // Case: Zero-priced checkout in a PAID event (e.g. Female Free entry)
            // Stays in PAID bucket, but skips gateway
            return await processFreePaidOrder(reservation, userId, userDetails, pricing, promoterCode);
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
            promoCodeId: pricing.discounts.find(d => d.type === 'promo')?.id || null
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
    const { createRSVPOrder } = await import("./orderStore");

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
    const snapshot = await db.collection(RESERVATIONS_COLLECTION)
        .where('status', '==', 'active')
        .get();

    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const reservation = doc.data();
        if (new Date(reservation.expiresAt) < now) {
            batch.update(doc.ref, { status: 'expired' });
            cleaned++;
        }
    }

    if (cleaned > 0) {
        await batch.commit();
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

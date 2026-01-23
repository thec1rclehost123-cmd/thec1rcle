
import * as admin from 'firebase-admin';

// Collection names
const PROMO_CODES_COLLECTION = "promo_codes";
const PROMO_REDEMPTIONS_COLLECTION = "promo_redemptions";

/**
 * Get promo code by code string
 */
export async function getPromoCodeByCode(eventId: string, code: string) {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const snapshot = await admin.firestore().collection(PROMO_CODES_COLLECTION)
        .where('eventId', '==', eventId)
        .where('code', '==', normalizedCode)
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() as any };
}

/**
 * Validate a promo code for checkout
 */
export async function validatePromoCode(eventId: string, code: string, userId: string | null, items: any[]) {
    const promoCode = await getPromoCodeByCode(eventId, code);

    if (!promoCode) {
        return { valid: false, error: 'Invalid promo code' };
    }

    if (!promoCode.isActive) {
        return { valid: false, error: 'This promo code is no longer active' };
    }

    // Check validity period
    const now = new Date();
    if (promoCode.startsAt && now < new Date(promoCode.startsAt)) {
        return { valid: false, error: 'This promo code is not yet active' };
    }

    if (promoCode.endsAt && now > new Date(promoCode.endsAt)) {
        return { valid: false, error: 'This promo code has expired' };
    }

    // Check total redemption limit
    if (promoCode.maxRedemptions && promoCode.redemptionCount >= promoCode.maxRedemptions) {
        return { valid: false, error: 'This promo code has reached its maximum uses' };
    }

    // Check per-user limit
    if (promoCode.maxPerUser && userId) {
        const userRedemptions = await getUserRedemptionCount(promoCode.id, userId);
        if (userRedemptions >= promoCode.maxPerUser) {
            return { valid: false, error: 'You have already used this promo code' };
        }
    }

    // Calculate discount for applicable items
    const applicableItems = items.filter(item => {
        if (!promoCode.tierIds || promoCode.tierIds.length === 0) {
            return true; // Applies to all tiers
        }
        return promoCode.tierIds.includes(item.tierId);
    });

    if (applicableItems.length === 0) {
        return { valid: false, error: 'This promo code does not apply to your selected tickets' };
    }

    // Calculate subtotal of applicable items
    const applicableSubtotal = applicableItems.reduce((sum, item) => {
        return sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity));
    }, 0);

    // Calculate discount
    let discountAmount;
    if (promoCode.discountType === 'percent') {
        discountAmount = Math.round((applicableSubtotal * promoCode.discountValue / 100) * 100) / 100;
    } else {
        discountAmount = Math.min(promoCode.discountValue, applicableSubtotal);
    }

    return {
        valid: true,
        promoCode: {
            id: promoCode.id,
            code: promoCode.code,
            name: promoCode.name,
            discountType: promoCode.discountType,
            discountValue: promoCode.discountValue
        },
        discountAmount,
        applicableTierIds: applicableItems.map(i => i.tierId),
        message: promoCode.discountType === 'percent'
            ? `${promoCode.discountValue}% off applied!`
            : `₹${discountAmount} off applied!`
    };
}

/**
 * Get user's redemption count for a promo code
 */
async function getUserRedemptionCount(promoCodeId: string, userId: string) {
    const snapshot = await admin.firestore().collection(PROMO_REDEMPTIONS_COLLECTION)
        .where('promoCodeId', '==', promoCodeId)
        .where('userId', '==', userId)
        .get();

    return snapshot.size;
}

/**
 * Record a promo code redemption
 */
export async function recordRedemption(promoCodeId: string, orderId: string, userId: string, details: any = {}) {
    const db = admin.firestore();
    const batch = db.batch();

    // 1. Create redemption record
    const redemptionRef = db.collection(PROMO_REDEMPTIONS_COLLECTION).doc();
    batch.set(redemptionRef, {
        promoCodeId,
        orderId,
        userId,
        ...details,
        timestamp: new Date().toISOString()
    });

    // 2. Increment redemption count on promo code
    const promoCodeRef = db.collection(PROMO_CODES_COLLECTION).doc(promoCodeId);
    batch.update(promoCodeRef, {
        redemptionCount: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString()
    });

    await batch.commit();
    return { success: true };
}

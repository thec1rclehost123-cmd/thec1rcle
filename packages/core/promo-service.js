/**
 * THE C1RCLE - Promo Code Service (Core)
 * Service module for promo code CRUD and validation
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "./admin.js";
import { FieldValue } from "firebase-admin/firestore";

// Collection names
const PROMO_CODES_COLLECTION = "promo_codes";
const PROMO_REDEMPTIONS_COLLECTION = "promo_redemptions";

// In-memory fallback for development
const fallbackPromoCodes = new Map();
const fallbackRedemptions = new Map();

/**
 * Create a new promo code
 */
export async function createPromoCode(eventId, codeData, createdBy) {
    // Sanitize and validate code
    const code = codeData.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (code.length < 3) {
        return { success: false, error: 'Promo code must be at least 3 characters' };
    }

    // Check if code already exists for this event
    const existing = await getPromoCodeByCode(eventId, code);
    if (existing) {
        return { success: false, error: 'Promo code already exists for this event' };
    }

    const now = new Date().toISOString();

    const promoCode = {
        id: randomUUID(),
        eventId,
        code,
        name: codeData.name || code,
        type: codeData.type || 'private', // 'public', 'private', 'single_use', 'multi_use'

        // Discount settings
        discountType: codeData.discountType || 'percent', // 'percent' or 'fixed'
        discountValue: Number(codeData.discountValue) || 0,

        // Optional: Apply only to specific tiers
        tierIds: codeData.tierIds || [], // Empty = all tiers

        // Limits
        maxRedemptions: codeData.maxRedemptions || null, // null = unlimited
        maxPerUser: codeData.maxPerUser || null, // null = unlimited per user

        // Validity period
        startsAt: codeData.startsAt || now,
        endsAt: codeData.endsAt || null, // null = never expires

        // Statistics
        redemptionCount: 0,

        // Status
        isActive: true,

        // Audit
        createdBy: createdBy ? {
            uid: createdBy.uid,
            name: createdBy.name,
            role: createdBy.role
        } : null,
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackPromoCodes.set(promoCode.id, promoCode);
        return { success: true, promoCode };
    }

    const db = getAdminDb();
    await db.collection(PROMO_CODES_COLLECTION).doc(promoCode.id).set(promoCode);

    return { success: true, promoCode };
}

/**
 * Get promo code by code string
 */
export async function getPromoCodeByCode(eventId, code) {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!isFirebaseConfigured()) {
        for (const pc of fallbackPromoCodes.values()) {
            if (pc.eventId === eventId && pc.code === normalizedCode) {
                return pc;
            }
        }
        return null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROMO_CODES_COLLECTION)
        .where('eventId', '==', eventId)
        .where('code', '==', normalizedCode)
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Upsert a promo code (create or update)
 */
export async function upsertPromoCode(eventId, codeData, actor) {
    const code = codeData.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (code.length < 3) {
        return { success: false, error: 'Promo code must be at least 3 characters' };
    }

    const existing = await getPromoCodeByCode(eventId, code);
    const now = new Date().toISOString();

    const promoData = {
        eventId,
        code,
        name: codeData.name || code,
        discountType: codeData.discountType || 'percent',
        discountValue: Number(codeData.discountValue) || 0,
        tierIds: codeData.tierIds || [],
        maxRedemptions: codeData.maxRedemptions !== undefined ? codeData.maxRedemptions : (existing?.maxRedemptions || null),
        maxPerUser: codeData.maxPerUser !== undefined ? codeData.maxPerUser : (existing?.maxPerUser || null),
        startsAt: codeData.startsAt || existing?.startsAt || now,
        endsAt: codeData.endsAt !== undefined ? codeData.endsAt : (existing?.endsAt || null),
        isActive: codeData.isActive ?? existing?.isActive ?? true,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        const id = existing?.id || randomUUID();
        const newDoc = { ...existing, ...promoData, id, createdAt: existing?.createdAt || now };
        fallbackPromoCodes.set(id, newDoc);
        return { success: true, promoCode: newDoc };
    }

    const db = getAdminDb();
    const id = existing?.id || randomUUID();
    const finalDoc = {
        ...promoData,
        id,
        createdAt: existing?.createdAt || now,
        createdBy: existing?.createdBy || (actor ? { uid: actor.uid, name: actor.name, role: actor.role } : null)
    };

    await db.collection(PROMO_CODES_COLLECTION).doc(id).set(finalDoc, { merge: true });
    return { success: true, promoCode: finalDoc };
}

/**
 * Get promo code by ID
 */
export async function getPromoCodeById(promoCodeId) {
    if (!isFirebaseConfigured()) {
        return fallbackPromoCodes.get(promoCodeId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(PROMO_CODES_COLLECTION).doc(promoCodeId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Get all promo codes for an event
 */
export async function getEventPromoCodes(eventId, options = {}) {
    const { includeInactive = false, limit = 50 } = options;

    if (!isFirebaseConfigured()) {
        let codes = Array.from(fallbackPromoCodes.values())
            .filter(pc => pc.eventId === eventId);

        if (!includeInactive) {
            codes = codes.filter(pc => pc.isActive);
        }

        return codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(PROMO_CODES_COLLECTION)
        .where('eventId', '==', eventId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

    const snapshot = await query.get();
    let codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!includeInactive) {
        codes = codes.filter(pc => pc.isActive);
    }

    return codes;
}

/**
 * Validate a promo code for checkout
 */
export async function validatePromoCode(eventId, code, userId, items) {
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
 * Record a promo code redemption
 */
export async function recordRedemption(promoCodeId, orderId, userId, details = {}) {
    if (!isFirebaseConfigured()) {
        const id = randomUUID();
        const redemption = {
            id,
            promoCodeId,
            orderId,
            userId,
            ...details,
            timestamp: new Date().toISOString()
        };
        fallbackRedemptions.set(id, redemption);

        // Update local count
        const pc = fallbackPromoCodes.get(promoCodeId);
        if (pc) {
            pc.redemptionCount = (pc.redemptionCount || 0) + 1;
        }

        return { success: true };
    }

    const db = getAdminDb();
    const batch = db.batch();

    // 1. Create redemption record
    const redemptionRef = db.collection(PROMO_REDEMPTIONS_COLLECTION).doc(randomUUID());
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
        redemptionCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString()
    });

    await batch.commit();
    return { success: true };
}

/**
 * Get user's redemption count for a promo code
 */
async function getUserRedemptionCount(promoCodeId, userId) {
    if (!isFirebaseConfigured()) {
        let count = 0;
        for (const redemption of fallbackRedemptions.values()) {
            if (redemption.promoCodeId === promoCodeId && redemption.userId === userId) {
                count++;
            }
        }
        return count;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROMO_REDEMPTIONS_COLLECTION)
        .where('promoCodeId', '==', promoCodeId)
        .where('userId', '==', userId)
        .get();

    return snapshot.size;
}

export default {
    createPromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    getEventPromoCodes,
    validatePromoCode,
    upsertPromoCode,
    recordRedemption
};

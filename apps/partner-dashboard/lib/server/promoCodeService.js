/**
 * THE C1RCLE - Promo Code Service (Phase 1)
 * Service module for promo code CRUD and validation
 * Location: apps/partner-dashboard/lib/server/promoCodeService.js
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

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
        createdBy: {
            uid: createdBy.uid,
            name: createdBy.name,
            role: createdBy.role
        },
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
 * Update a promo code
 */
export async function updatePromoCode(promoCodeId, updates, updatedBy) {
    const existing = await getPromoCodeById(promoCodeId);
    if (!existing) {
        return { success: false, error: 'Promo code not found' };
    }

    // Don't allow changing the code itself
    if (updates.code && updates.code !== existing.code) {
        return { success: false, error: 'Cannot change the promo code. Create a new one instead.' };
    }

    const allowedUpdates = ['name', 'discountType', 'discountValue', 'tierIds',
        'maxRedemptions', 'maxPerUser', 'startsAt', 'endsAt', 'isActive'];

    const sanitizedUpdates = {};
    for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
            sanitizedUpdates[key] = updates[key];
        }
    }

    sanitizedUpdates.updatedAt = new Date().toISOString();
    sanitizedUpdates.updatedBy = { uid: updatedBy.uid, name: updatedBy.name };

    if (!isFirebaseConfigured()) {
        const pc = fallbackPromoCodes.get(promoCodeId);
        if (pc) {
            Object.assign(pc, sanitizedUpdates);
        }
        return { success: true, promoCode: { ...existing, ...sanitizedUpdates } };
    }

    const db = getAdminDb();
    await db.collection(PROMO_CODES_COLLECTION).doc(promoCodeId).update(sanitizedUpdates);

    return { success: true, promoCode: { ...existing, ...sanitizedUpdates } };
}

/**
 * Deactivate a promo code
 */
export async function deactivatePromoCode(promoCodeId, deactivatedBy) {
    return await updatePromoCode(promoCodeId, { isActive: false }, deactivatedBy);
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
        return sum + (Number(item.price) * Number(item.quantity));
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

/**
 * Record a promo code redemption (called after successful checkout)
 */
export async function recordRedemption(promoCodeId, orderId, userId, discountAmount) {
    const now = new Date().toISOString();

    const redemption = {
        id: randomUUID(),
        promoCodeId,
        orderId,
        userId,
        discountAmount,
        redeemedAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackRedemptions.set(redemption.id, redemption);

        // Increment count
        const pc = fallbackPromoCodes.get(promoCodeId);
        if (pc) {
            pc.redemptionCount = (pc.redemptionCount || 0) + 1;
        }

        return { success: true, redemption };
    }

    const db = getAdminDb();

    // Use transaction to atomically increment count
    await db.runTransaction(async (transaction) => {
        const pcRef = db.collection(PROMO_CODES_COLLECTION).doc(promoCodeId);
        const pcDoc = await transaction.get(pcRef);

        if (!pcDoc.exists) {
            throw new Error('Promo code not found');
        }

        const currentCount = pcDoc.data().redemptionCount || 0;

        // Create redemption record
        const redemptionRef = db.collection(PROMO_REDEMPTIONS_COLLECTION).doc(redemption.id);
        transaction.set(redemptionRef, redemption);

        // Increment count
        transaction.update(pcRef, {
            redemptionCount: currentCount + 1,
            updatedAt: now
        });
    });

    return { success: true, redemption };
}

/**
 * Get redemption history for a promo code
 */
export async function getPromoCodeRedemptions(promoCodeId, options = {}) {
    const { limit = 50 } = options;

    if (!isFirebaseConfigured()) {
        return Array.from(fallbackRedemptions.values())
            .filter(r => r.promoCodeId === promoCodeId)
            .sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt))
            .slice(0, limit);
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROMO_REDEMPTIONS_COLLECTION)
        .where('promoCodeId', '==', promoCodeId)
        .orderBy('redeemedAt', 'desc')
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Generate a random promo code
 */
export function generatePromoCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export default {
    createPromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    getEventPromoCodes,
    updatePromoCode,
    deactivatePromoCode,
    validatePromoCode,
    recordRedemption,
    getPromoCodeRedemptions,
    generatePromoCode
};

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordRedemption = exports.validatePromoCode = exports.getPromoCodeByCode = void 0;
const admin = __importStar(require("firebase-admin"));
// Collection names
const PROMO_CODES_COLLECTION = "promo_codes";
const PROMO_REDEMPTIONS_COLLECTION = "promo_redemptions";
/**
 * Get promo code by code string
 */
async function getPromoCodeByCode(eventId, code) {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const snapshot = await admin.firestore().collection(PROMO_CODES_COLLECTION)
        .where('eventId', '==', eventId)
        .where('code', '==', normalizedCode)
        .limit(1)
        .get();
    return snapshot.empty ? null : Object.assign({ id: snapshot.docs[0].id }, snapshot.docs[0].data());
}
exports.getPromoCodeByCode = getPromoCodeByCode;
/**
 * Validate a promo code for checkout
 */
async function validatePromoCode(eventId, code, userId, items) {
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
    }
    else {
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
exports.validatePromoCode = validatePromoCode;
/**
 * Get user's redemption count for a promo code
 */
async function getUserRedemptionCount(promoCodeId, userId) {
    const snapshot = await admin.firestore().collection(PROMO_REDEMPTIONS_COLLECTION)
        .where('promoCodeId', '==', promoCodeId)
        .where('userId', '==', userId)
        .get();
    return snapshot.size;
}
/**
 * Record a promo code redemption
 */
async function recordRedemption(promoCodeId, orderId, userId, details = {}) {
    const db = admin.firestore();
    const batch = db.batch();
    // 1. Create redemption record
    const redemptionRef = db.collection(PROMO_REDEMPTIONS_COLLECTION).doc();
    batch.set(redemptionRef, Object.assign(Object.assign({ promoCodeId,
        orderId,
        userId }, details), { timestamp: new Date().toISOString() }));
    // 2. Increment redemption count on promo code
    const promoCodeRef = db.collection(PROMO_CODES_COLLECTION).doc(promoCodeId);
    batch.update(promoCodeRef, {
        redemptionCount: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString()
    });
    await batch.commit();
    return { success: true };
}
exports.recordRedemption = recordRedemption;
//# sourceMappingURL=promos.js.map
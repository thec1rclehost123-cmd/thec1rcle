/**
 * THE C1RCLE - Ticketing Service (Phase 1)
 * Service module for ticket pricing, promo codes, and promoter discounts
 * Location: apps/partner-dashboard/lib/server/ticketingService.js
 */

import { randomUUID } from "node:crypto";

// Platform fee defaults
const PLATFORM_FEES = {
    platformFeePercent: 5,      // 5% platform fee
    paymentFeePercent: 2.5,     // 2.5% Razorpay fee
    gstPercent: 18              // 18% GST on fees
};

// Minimum payout floor (host must receive at least this much)
const MINIMUM_PAYOUT_FLOOR = 10; // ₹10

/**
 * Get the effective price for a tier at a given timestamp
 * Handles scheduled pricing (Early Bird, Regular, Last Call)
 */
export function getEffectivePrice(tier, timestamp = new Date()) {
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Check scheduled prices in order of specificity
    if (tier.scheduledPrices && Array.isArray(tier.scheduledPrices)) {
        for (const schedule of tier.scheduledPrices) {
            const startsAt = new Date(schedule.startsAt);
            const endsAt = new Date(schedule.endsAt);

            if (now >= startsAt && now <= endsAt) {
                return {
                    price: schedule.price,
                    label: schedule.name,
                    isScheduled: true,
                    endsAt: schedule.endsAt
                };
            }
        }
    }

    // Fall back to base price
    return {
        price: tier.basePrice ?? tier.price ?? 0,
        label: null,
        isScheduled: false,
        endsAt: null
    };
}

/**
 * Calculate order pricing for selected items
 */
export function calculateOrderPricing(items, event, options = {}) {
    const { promoCode = null, promoterCode = null, timestamp = new Date() } = options;

    const result = {
        items: [],
        subtotal: 0,
        discounts: [],
        discountTotal: 0,
        fees: {
            platformFee: 0,
            paymentFee: 0,
            gst: 0,
            total: 0
        },
        grandTotal: 0,
        isFree: false,
        warnings: []
    };

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];

    // Calculate each item's pricing
    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);

        if (!tier) {
            result.warnings.push(`Tier not found: ${item.tierId}`);
            continue;
        }

        const effectivePrice = getEffectivePrice(tier, timestamp);
        const quantity = Number(item.quantity) || 1;
        const subtotal = effectivePrice.price * quantity;

        result.items.push({
            tierId: tier.id,
            tierName: tier.name,
            entryType: tier.entryType || 'general',
            quantity,
            unitPrice: effectivePrice.price,
            priceLabel: effectivePrice.label,
            subtotal,
            discounts: [],
            finalPrice: subtotal
        });

        result.subtotal += subtotal;
    }

    // Apply promo code if provided
    if (promoCode && event) {
        const promoResult = applyPromoCodeDiscount(promoCode, result.items, event);

        if (promoResult.valid) {
            result.discounts.push({
                type: 'promo',
                code: promoCode,
                amount: promoResult.discountAmount,
                label: promoResult.label
            });
            result.discountTotal += promoResult.discountAmount;

            // Distribute discount across items
            distributeDiscount(result.items, promoResult.discountAmount, 'promo', promoCode);
        } else {
            result.warnings.push(promoResult.error);
        }
    }

    // Apply promoter discount if enabled and code provided
    if (promoterCode && event.promoterSettings?.enabled && event.promoterSettings?.buyerDiscountsEnabled) {
        const promoterResult = calculatePromoterBuyerDiscount(result.items, event);

        if (promoterResult.discountAmount > 0) {
            result.discounts.push({
                type: 'promoter',
                code: promoterCode,
                amount: promoterResult.discountAmount,
                label: `Promoter Discount (-₹${Math.round(promoterResult.discountAmount)})`
            });
            result.discountTotal += promoterResult.discountAmount;

            // Distribute discount
            distributeDiscount(result.items, promoterResult.discountAmount, 'promoter', 'Promoter Code');
        }
    }

    // Calculate final prices and check for free order
    let allFree = true;
    for (const item of result.items) {
        const discountSum = item.discounts.reduce((sum, d) => sum + d.amount, 0);
        item.finalPrice = Math.max(0, item.subtotal - discountSum);
        if (item.finalPrice > 0) {
            allFree = false;
        }
    }

    // Calculate grand total before fees
    const discountedSubtotal = result.subtotal - result.discountTotal;

    // Calculate fees (only if not free)
    if (discountedSubtotal > 0) {
        result.fees.platformFee = Math.round((discountedSubtotal * PLATFORM_FEES.platformFeePercent / 100) * 100) / 100;
        result.fees.paymentFee = Math.round((discountedSubtotal * PLATFORM_FEES.paymentFeePercent / 100) * 100) / 100;
        const feesBeforeGST = result.fees.platformFee + result.fees.paymentFee;
        result.fees.gst = Math.round((feesBeforeGST * PLATFORM_FEES.gstPercent / 100) * 100) / 100;
        result.fees.total = result.fees.platformFee + result.fees.paymentFee + result.fees.gst;
    }

    result.grandTotal = Math.round((discountedSubtotal + result.fees.total) * 100) / 100;
    result.isFree = allFree || result.grandTotal === 0;

    return result;
}

/**
 * Distribute a discount proportionally across items
 */
function distributeDiscount(items, totalDiscount, type, label) {
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    let remaining = totalDiscount;

    for (let i = 0; i < items.length; i++) {
        let itemDiscount;
        if (i === items.length - 1) {
            // Last item gets remainder to avoid rounding errors
            itemDiscount = remaining;
        } else {
            itemDiscount = Math.round((items[i].subtotal / subtotal) * totalDiscount * 100) / 100;
        }

        items[i].discounts.push({
            type,
            amount: itemDiscount,
            label
        });

        remaining -= itemDiscount;
    }
}

/**
 * Apply a promo code and calculate discount
 */
export function applyPromoCodeDiscount(code, items, event) {
    // Find promo code in event
    const promoCodes = event.ticketCatalog?.promoCodes || [];
    const promoCode = promoCodes.find(
        pc => pc.code.toUpperCase() === code.toUpperCase() && pc.isActive
    );

    if (!promoCode) {
        return { valid: false, error: 'Invalid promo code' };
    }

    // Check validity period
    const now = new Date();
    if (promoCode.startsAt && now < new Date(promoCode.startsAt)) {
        return { valid: false, error: 'Promo code not yet active' };
    }
    if (promoCode.endsAt && now > new Date(promoCode.endsAt)) {
        return { valid: false, error: 'Promo code has expired' };
    }

    // Check redemption limits
    if (promoCode.maxRedemptions && promoCode.redemptionCount >= promoCode.maxRedemptions) {
        return { valid: false, error: 'Promo code has reached maximum uses' };
    }

    // Filter applicable items
    const applicableItems = items.filter(item => {
        if (!promoCode.tierIds || promoCode.tierIds.length === 0) {
            return true; // Applies to all tiers
        }
        return promoCode.tierIds.includes(item.tierId);
    });

    if (applicableItems.length === 0) {
        return { valid: false, error: 'Promo code does not apply to selected tickets' };
    }

    // Calculate discount
    const applicableSubtotal = applicableItems.reduce((sum, i) => sum + i.subtotal, 0);
    let discountAmount;

    if (promoCode.discountType === 'percent') {
        discountAmount = (applicableSubtotal * promoCode.discountValue) / 100;
    } else {
        discountAmount = Math.min(promoCode.discountValue, applicableSubtotal);
    }

    return {
        valid: true,
        discountAmount: Math.round(discountAmount * 100) / 100,
        label: `${promoCode.name || promoCode.code} (-₹${Math.round(discountAmount)})`,
        codeId: promoCode.id,
        applicableTiers: applicableItems.map(i => i.tierId)
    };
}

/**
 * Calculate promoter buyer discount based on event settings
 */
export function calculatePromoterBuyerDiscount(items, event) {
    const settings = event.promoterSettings;

    if (!settings?.enabled || !settings?.buyerDiscountsEnabled) {
        return { discountAmount: 0, applicableTiers: [] };
    }

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    let totalDiscount = 0;
    const applicableTiers = [];

    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);
        if (!tier) continue;

        // Check if tier has promoter enabled
        const tierPromoterEnabled = tier.promoterEnabled !== false;
        if (!tierPromoterEnabled) continue;

        // Get discount rate - either tier override or default
        let discountRate = settings.defaultBuyerDiscountRate || 0;
        let discountType = settings.defaultBuyerDiscountType || 'percent';

        // Check for tier-level override (only if not using default)
        if (!settings.useDefaultBuyerDiscount && tier.promoterDiscount !== undefined) {
            discountRate = tier.promoterDiscount;
            discountType = tier.promoterDiscountType || 'percent';
        }

        // Calculate discount for this item
        let itemDiscount;
        if (discountType === 'percent') {
            itemDiscount = (item.subtotal * discountRate) / 100;
        } else {
            itemDiscount = discountRate * item.quantity;
        }

        totalDiscount += itemDiscount;
        applicableTiers.push({
            tierId: tier.id,
            discount: Math.round(itemDiscount * 100) / 100
        });
    }

    return {
        discountAmount: Math.round(totalDiscount * 100) / 100,
        applicableTiers
    };
}

/**
 * Calculate promoter commission for an order
 */
export function calculatePromoterCommission(items, event) {
    const settings = event.promoterSettings;

    if (!settings?.enabled) {
        return { commissionAmount: 0, breakdown: [] };
    }

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    let totalCommission = 0;
    const breakdown = [];

    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);
        if (!tier) continue;

        // Check if tier has promoter enabled
        const tierPromoterEnabled = tier.promoterEnabled !== false;
        if (!tierPromoterEnabled) continue;

        // Get commission rate - either tier override or default
        let commissionRate = settings.defaultCommissionRate || 0;
        let commissionType = settings.defaultCommissionType || 'percent';

        // Check for tier-level override (only if not using default)
        if (!settings.useDefaultCommission && tier.promoterCommission !== undefined) {
            commissionRate = tier.promoterCommission;
            commissionType = tier.promoterCommissionType || 'percent';
        }

        // Calculate commission for this item
        let itemCommission;
        if (commissionType === 'percent') {
            itemCommission = (item.subtotal * commissionRate) / 100;
        } else {
            itemCommission = commissionRate * item.quantity;
        }

        totalCommission += itemCommission;
        breakdown.push({
            tierId: tier.id,
            tierName: tier.name,
            quantity: item.quantity,
            subtotal: item.subtotal,
            commissionRate,
            commissionType,
            commission: Math.round(itemCommission * 100) / 100
        });
    }

    return {
        commissionAmount: Math.round(totalCommission * 100) / 100,
        breakdown
    };
}

/**
 * Validate pricing to ensure positive margins
 */
export function validatePricingMargins(pricing, commissionAmount) {
    const warnings = [];
    const errors = [];

    const netRevenue = pricing.subtotal - pricing.discountTotal - commissionAmount;

    if (netRevenue < 0) {
        errors.push('Discounts and commissions exceed ticket value');
    }

    if (netRevenue > 0 && netRevenue < MINIMUM_PAYOUT_FLOOR) {
        warnings.push(`Net revenue (₹${netRevenue.toFixed(2)}) is below minimum floor (₹${MINIMUM_PAYOUT_FLOOR})`);
    }

    // Warn if commission is unusually high
    if (commissionAmount > 0 && pricing.subtotal > 0) {
        const commissionPercent = (commissionAmount / pricing.subtotal) * 100;
        if (commissionPercent > 50) {
            warnings.push(`Commission (${commissionPercent.toFixed(1)}%) exceeds 50% of ticket value`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        netRevenue: Math.round(netRevenue * 100) / 100
    };
}

/**
 * Create a new promo code
 */
export function createPromoCode(eventId, codeData, createdBy) {
    const now = new Date().toISOString();

    return {
        id: randomUUID(),
        eventId,
        code: codeData.code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        name: codeData.name || codeData.code,
        type: codeData.type || 'private',
        discountType: codeData.discountType || 'percent',
        discountValue: Number(codeData.discountValue) || 0,
        tierIds: codeData.tierIds || [], // Empty = all tiers
        maxRedemptions: codeData.maxRedemptions || null,
        maxPerUser: codeData.maxPerUser || null,
        startsAt: codeData.startsAt || now,
        endsAt: codeData.endsAt || null,
        redemptionCount: 0,
        isActive: true,
        createdBy,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Increment promo code redemption count
 */
export function recordPromoRedemption(promoCode, userId) {
    return {
        ...promoCode,
        redemptionCount: (promoCode.redemptionCount || 0) + 1,
        updatedAt: new Date().toISOString()
    };
}

/**
 * Check if user has exceeded per-user redemption limit for a promo code
 */
export function checkUserRedemptionLimit(promoCode, userId, userRedemptions = 0) {
    if (!promoCode.maxPerUser) {
        return { allowed: true };
    }

    if (userRedemptions >= promoCode.maxPerUser) {
        return {
            allowed: false,
            error: 'You have already used this promo code'
        };
    }

    return { allowed: true };
}

/**
 * Get price schedule summary for display
 */
export function getPriceScheduleSummary(tier) {
    const schedules = tier.scheduledPrices || [];
    const basePrice = tier.basePrice ?? tier.price ?? 0;

    if (schedules.length === 0) {
        return {
            currentPrice: basePrice,
            currentLabel: 'Regular',
            upcoming: [],
            hasScheduledPricing: false
        };
    }

    const now = new Date();
    const current = getEffectivePrice(tier, now);

    // Find upcoming price changes
    const upcoming = schedules
        .filter(s => new Date(s.startsAt) > now)
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        .map(s => ({
            name: s.name,
            price: s.price,
            startsAt: s.startsAt,
            change: s.price - current.price
        }));

    return {
        currentPrice: current.price,
        currentLabel: current.label || 'Regular',
        upcoming,
        hasScheduledPricing: true,
        basePrice
    };
}

export default {
    getEffectivePrice,
    calculateOrderPricing,
    applyPromoCodeDiscount,
    calculatePromoterBuyerDiscount,
    calculatePromoterCommission,
    validatePricingMargins,
    createPromoCode,
    recordPromoRedemption,
    checkUserRedemptionLimit,
    getPriceScheduleSummary,
    PLATFORM_FEES,
    MINIMUM_PAYOUT_FLOOR
};

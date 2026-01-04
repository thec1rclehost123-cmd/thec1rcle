/**
 * THE C1RCLE - Pricing Engine
 * Production-grade pricing calculations for tickets, fees, and discounts
 */

// Default fee configuration (platform defaults)
const DEFAULT_FEES = {
    platformFee: 5,          // 5%
    platformFeeType: 'percent',
    paymentFee: 2.5,         // 2.5% for Razorpay
    paymentFeeType: 'percent',
    tax: 18,                 // 18% GST
    taxType: 'percent'
};

// Minimum payout floor to prevent negative margins
const MINIMUM_PAYOUT_FLOOR = 10; // ₹10 minimum

/**
 * Calculate price for a single tier at a given timestamp
 * Handles scheduled price changes and quantity-based pricing
 */
export function calculateTierPrice(tier, quantity, timestamp = new Date()) {
    let price = tier.pricing?.basePrice ?? tier.price ?? 0;

    // Apply scheduled price changes
    if (tier.pricing?.scheduledChanges && Array.isArray(tier.pricing.scheduledChanges)) {
        const activeSchedule = tier.pricing.scheduledChanges.find(schedule => {
            const startsAt = new Date(schedule.startsAt);
            const endsAt = new Date(schedule.endsAt);
            return schedule.isActive && timestamp >= startsAt && timestamp <= endsAt;
        });

        if (activeSchedule) {
            price = activeSchedule.price;
        }
    }

    // Apply quantity-based pricing
    if (tier.pricing?.quantityPricing && Array.isArray(tier.pricing.quantityPricing)) {
        const applicableRule = tier.pricing.quantityPricing.find(rule =>
            quantity >= rule.minQuantity && quantity <= rule.maxQuantity
        );

        if (applicableRule) {
            price = applicableRule.pricePerUnit;
        }
    }

    return Math.max(0, price);
}

/**
 * Apply rounding rules to a price
 */
export function applyRounding(amount, roundingRule = 'none', precision = 0) {
    if (roundingRule === 'none') {
        return amount;
    }

    const factor = Math.pow(10, precision);

    switch (roundingRule) {
        case 'up':
            return Math.ceil(amount * factor) / factor;
        case 'down':
            return Math.floor(amount * factor) / factor;
        case 'nearest':
            return Math.round(amount * factor) / factor;
        default:
            return amount;
    }
}

/**
 * Calculate fees for a given subtotal
 */
export function calculateFees(subtotal, event, feeConfig = {}) {
    const fees = {
        ...DEFAULT_FEES,
        ...feeConfig
    };

    let platformFee = 0;
    let paymentFee = 0;
    let hostFee = 0;
    let clubFee = 0;
    let tax = 0;

    // Platform fee
    if (fees.platformFeeType === 'percent') {
        platformFee = (subtotal * fees.platformFee) / 100;
    } else {
        platformFee = fees.platformFee;
    }

    // Payment fee
    if (fees.paymentFeeType === 'percent') {
        paymentFee = (subtotal * fees.paymentFee) / 100;
    } else {
        paymentFee = fees.paymentFee;
    }

    // Host fee (if applicable)
    if (fees.hostFee) {
        if (fees.hostFeeType === 'percent') {
            hostFee = (subtotal * fees.hostFee) / 100;
        } else {
            hostFee = fees.hostFee;
        }
    }

    // Club fee (if applicable)
    if (fees.clubFee) {
        if (fees.clubFeeType === 'percent') {
            clubFee = (subtotal * fees.clubFee) / 100;
        } else {
            clubFee = fees.clubFee;
        }
    }

    // Tax (applied on subtotal + fees)
    const taxableAmount = subtotal + platformFee + paymentFee + hostFee + clubFee;
    if (fees.tax) {
        if (fees.taxType === 'percent') {
            tax = (taxableAmount * fees.tax) / 100;
        } else {
            tax = fees.tax;
        }
    }

    const total = platformFee + paymentFee + hostFee + clubFee + tax;

    return {
        platformFee: Math.round(platformFee * 100) / 100,
        paymentFee: Math.round(paymentFee * 100) / 100,
        hostFee: Math.round(hostFee * 100) / 100,
        clubFee: Math.round(clubFee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(total * 100) / 100
    };
}

/**
 * Validate and apply a promo code
 */
export function applyPromoCode(code, items, event, context = {}) {
    const { userId, deviceId, timestamp = new Date(), redemptionHistory = [] } = context;

    // Find promo code in event
    const promoCode = event.ticketCatalog?.promoCodes?.find(
        pc => pc.code.toUpperCase() === code.toUpperCase() && pc.isActive
    );

    if (!promoCode) {
        return { valid: false, error: 'Invalid promo code' };
    }

    // Check validity period
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const startsAt = new Date(promoCode.validity.startsAt);
    const endsAt = new Date(promoCode.validity.endsAt);

    if (now < startsAt) {
        return { valid: false, error: 'Promo code not yet active' };
    }

    if (now > endsAt) {
        return { valid: false, error: 'Promo code has expired' };
    }

    // Check redemption limits
    if (promoCode.limits.totalRedemptions &&
        promoCode.redemptionCount >= promoCode.limits.totalRedemptions) {
        return { valid: false, error: 'Promo code has reached maximum redemptions' };
    }

    // Check per-user limit
    if (promoCode.limits.perUserRedemptions && userId) {
        const userRedemptions = redemptionHistory.filter(
            r => r.userId === userId && r.codeId === promoCode.id
        ).length;

        if (userRedemptions >= promoCode.limits.perUserRedemptions) {
            return { valid: false, error: 'You have already used this code' };
        }
    }

    // Check per-device limit
    if (promoCode.limits.perDeviceRedemptions && deviceId) {
        const deviceRedemptions = redemptionHistory.filter(
            r => r.deviceId === deviceId && r.codeId === promoCode.id
        ).length;

        if (deviceRedemptions >= promoCode.limits.perDeviceRedemptions) {
            return { valid: false, error: 'Code already used on this device' };
        }
    }

    // Check cooldown
    if (promoCode.limits.cooldownMinutes && userId) {
        const lastRedemption = redemptionHistory
            .filter(r => r.userId === userId && r.codeId === promoCode.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        if (lastRedemption) {
            const cooldownEnd = new Date(lastRedemption.timestamp);
            cooldownEnd.setMinutes(cooldownEnd.getMinutes() + promoCode.limits.cooldownMinutes);

            if (now < cooldownEnd) {
                const remainingMinutes = Math.ceil((cooldownEnd - now) / 60000);
                return { valid: false, error: `Please wait ${remainingMinutes} minutes before using this code again` };
            }
        }
    }

    // Check role binding
    if (promoCode.roleBound) {
        if (!context.userRole || !promoCode.roleBound.roles.includes(context.userRole)) {
            return { valid: false, error: 'This code is not available for your account type' };
        }
    }

    // Check geo restrictions
    if (promoCode.validity.validRegions && promoCode.validity.validRegions.length > 0) {
        if (!context.region || !promoCode.validity.validRegions.includes(context.region)) {
            return { valid: false, error: 'This code is not valid in your region' };
        }
    }

    // Calculate discount
    let discountAmount = 0;
    const applicableItems = items.filter(item => {
        // Check if code applies to this tier
        if (promoCode.scope.tierIds && promoCode.scope.tierIds.length > 0) {
            return promoCode.scope.tierIds.includes(item.tierId);
        }
        return true;
    });

    if (applicableItems.length === 0) {
        return { valid: false, error: 'Code does not apply to selected items' };
    }

    const applicableSubtotal = applicableItems.reduce((sum, item) => sum + item.subtotal, 0);

    if (promoCode.discountType === 'percent') {
        discountAmount = (applicableSubtotal * promoCode.discountValue) / 100;
    } else {
        discountAmount = Math.min(promoCode.discountValue, applicableSubtotal);
    }

    return {
        valid: true,
        code: promoCode,
        discountAmount: Math.round(discountAmount * 100) / 100,
        applicableItems: applicableItems.map(i => i.tierId),
        label: `${promoCode.name} (-₹${Math.round(discountAmount)})`
    };
}

/**
 * Calculate promoter discount and commission
 */
export function calculatePromoterDiscounts(items, event, promoterSettings) {
    if (!promoterSettings || !promoterSettings.enabled) {
        return {
            buyerDiscount: 0,
            commission: 0,
            applicableItems: []
        };
    }

    let totalBuyerDiscount = 0;
    let totalCommission = 0;
    const applicableItems = [];

    for (const item of items) {
        // Skip if tier is not promoter-enabled
        const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId);
        if (!tier) continue;

        const tierPromoterEnabled = tier.promoterOverride?.enabled ??
            (promoterSettings.enabled && tier.promoterEnabled !== false);

        if (!tierPromoterEnabled) continue;

        // Get commission rate
        let commissionRate = promoterSettings.defaultCommissionRate;
        let commissionType = promoterSettings.defaultCommissionType;

        if (!promoterSettings.useDefaultCommission && tier.promoterOverride) {
            commissionRate = tier.promoterOverride.commissionRate ?? commissionRate;
            commissionType = tier.promoterOverride.commissionType ?? commissionType;
        }

        // Get buyer discount rate
        let discountRate = 0;
        let discountType = 'percent';

        if (promoterSettings.buyerDiscountsEnabled) {
            discountRate = promoterSettings.defaultBuyerDiscountRate || 0;
            discountType = promoterSettings.defaultBuyerDiscountType || 'percent';

            if (!promoterSettings.useDefaultBuyerDiscount && tier.promoterOverride) {
                discountRate = tier.promoterOverride.buyerDiscountRate ?? discountRate;
                discountType = tier.promoterOverride.buyerDiscountType ?? discountType;
            }
        }

        // Calculate amounts
        let itemDiscount = 0;
        let itemCommission = 0;

        if (discountType === 'percent') {
            itemDiscount = (item.subtotal * discountRate) / 100;
        } else {
            itemDiscount = discountRate * item.quantity;
        }

        if (commissionType === 'percent') {
            itemCommission = (item.subtotal * commissionRate) / 100;
        } else {
            itemCommission = commissionRate * item.quantity;
        }

        totalBuyerDiscount += itemDiscount;
        totalCommission += itemCommission;

        applicableItems.push({
            tierId: item.tierId,
            discount: Math.round(itemDiscount * 100) / 100,
            commission: Math.round(itemCommission * 100) / 100
        });
    }

    return {
        buyerDiscount: Math.round(totalBuyerDiscount * 100) / 100,
        commission: Math.round(totalCommission * 100) / 100,
        applicableItems
    };
}

/**
 * Calculate bundle pricing
 */
export function calculateBundlePricing(items, event) {
    if (!event.ticketCatalog?.bundleRules || event.ticketCatalog.bundleRules.length === 0) {
        return { bundles: [], savings: 0 };
    }

    const bundles = [];
    let totalSavings = 0;

    // Create a map of items for easier lookup
    const itemMap = new Map();
    for (const item of items) {
        itemMap.set(item.tierId, (itemMap.get(item.tierId) || 0) + item.quantity);
    }

    for (const bundleRule of event.ticketCatalog.bundleRules) {
        if (!bundleRule.isActive) continue;

        // Check if we can form this bundle
        let maxBundles = Infinity;
        for (const component of bundleRule.components) {
            const available = itemMap.get(component.tierId) || 0;
            maxBundles = Math.min(maxBundles, Math.floor(available / component.quantity));
        }

        if (maxBundles > 0 && maxBundles !== Infinity) {
            // Limit to maxBundlesPerOrder
            maxBundles = Math.min(maxBundles, bundleRule.maxBundlesPerOrder);

            // Calculate individual price
            let individualPrice = 0;
            for (const component of bundleRule.components) {
                const tier = event.ticketCatalog.tiers.find(t => t.id === component.tierId);
                if (tier) {
                    individualPrice += (tier.pricing?.basePrice ?? tier.price ?? 0) * component.quantity;
                }
            }

            const savings = (individualPrice - bundleRule.bundlePrice) * maxBundles;

            bundles.push({
                bundleId: bundleRule.id,
                name: bundleRule.name,
                quantity: maxBundles,
                price: bundleRule.bundlePrice * maxBundles,
                savings: savings,
                label: bundleRule.savingsLabel
            });

            totalSavings += savings;
        }
    }

    return {
        bundles,
        savings: Math.round(totalSavings * 100) / 100
    };
}

/**
 * Validate pricing ensures positive margins
 */
export function validateMargins(pricing, promoterSettings, event) {
    const warnings = [];
    const errors = [];

    // Check that we don't have negative payouts
    const totalDiscounts = pricing.discountTotal || 0;
    const totalCommission = promoterSettings?.commission || 0;
    const netRevenue = pricing.subtotal - totalDiscounts - totalCommission;

    if (netRevenue < 0) {
        errors.push('Total discounts and commissions exceed ticket value');
    }

    // Check minimum payout floor
    const minimumFloor = promoterSettings?.minimumPayoutFloor || MINIMUM_PAYOUT_FLOOR;
    if (netRevenue > 0 && netRevenue < minimumFloor) {
        warnings.push(`Net revenue (₹${netRevenue}) is below minimum floor (₹${minimumFloor})`);
    }

    // Check commission doesn't exceed 50%
    if (promoterSettings?.commission && pricing.subtotal > 0) {
        const commissionPercent = (totalCommission / pricing.subtotal) * 100;
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
 * Main pricing engine function
 * Calculates complete pricing for a checkout
 */
export function calculatePricing(input) {
    const {
        items,
        event,
        promoCode = null,
        promoterCode = null,
        timestamp = new Date(),
        context = {}
    } = input;

    const warnings = [];
    const calculatedItems = [];

    // Calculate base prices for each item
    for (const item of items) {
        const tier = event.ticketCatalog?.tiers?.find(t => t.id === item.tierId) ||
            event.tickets?.find(t => t.id === item.tierId);

        if (!tier) {
            throw new Error(`Ticket tier not found: ${item.tierId}`);
        }

        const unitPrice = calculateTierPrice(tier, item.quantity, timestamp);
        const subtotal = unitPrice * item.quantity;

        calculatedItems.push({
            tierId: item.tierId,
            tierName: tier.name,
            entryType: tier.entryType || 'general',
            quantity: item.quantity,
            unitPrice,
            subtotal,
            discounts: [],
            finalPrice: subtotal
        });
    }

    // Calculate subtotal
    const subtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Apply discounts
    const discounts = [];
    let discountTotal = 0;

    // 1. Promo code discount
    if (promoCode) {
        const promoResult = applyPromoCode(promoCode, calculatedItems, event, context);
        if (promoResult.valid) {
            discounts.push({
                type: 'promo',
                code: promoCode,
                amount: promoResult.discountAmount,
                label: promoResult.label
            });
            discountTotal += promoResult.discountAmount;

            // Distribute discount across items
            for (const item of calculatedItems) {
                if (promoResult.applicableItems.includes(item.tierId)) {
                    const itemShare = (item.subtotal / subtotal) * promoResult.discountAmount;
                    item.discounts.push({
                        type: 'promo',
                        amount: Math.round(itemShare * 100) / 100,
                        label: promoCode
                    });
                    item.finalPrice -= itemShare;
                }
            }
        } else {
            warnings.push(promoResult.error);
        }
    }

    // 2. Promoter discount
    if (promoterCode && event.promoterSettings?.enabled) {
        const promoterResult = calculatePromoterDiscounts(calculatedItems, event, event.promoterSettings);
        if (promoterResult.buyerDiscount > 0) {
            discounts.push({
                type: 'promoter',
                code: promoterCode,
                amount: promoterResult.buyerDiscount,
                label: `Promoter Discount (-₹${Math.round(promoterResult.buyerDiscount)})`
            });
            discountTotal += promoterResult.buyerDiscount;

            // Distribute discount
            for (const item of calculatedItems) {
                const itemPromoter = promoterResult.applicableItems.find(a => a.tierId === item.tierId);
                if (itemPromoter) {
                    item.discounts.push({
                        type: 'promoter',
                        amount: itemPromoter.discount,
                        label: 'Promoter Discount'
                    });
                    item.finalPrice -= itemPromoter.discount;
                }
            }
        }
    }

    // 3. Bundle savings
    const bundleResult = calculateBundlePricing(items, event);
    if (bundleResult.savings > 0) {
        discounts.push({
            type: 'bundle',
            amount: bundleResult.savings,
            label: `Bundle Savings (-₹${Math.round(bundleResult.savings)})`
        });
        discountTotal += bundleResult.savings;
    }

    // Round final prices
    for (const item of calculatedItems) {
        item.finalPrice = Math.max(0, Math.round(item.finalPrice * 100) / 100);
    }

    // Calculate fees on discounted subtotal
    const discountedSubtotal = subtotal - discountTotal;
    const fees = calculateFees(discountedSubtotal, event, event.ticketCatalog?.tiers?.[0]?.pricing?.fees);

    // Calculate grand total based on fee display mode
    const feeDisplayMode = event.ticketCatalog?.tiers?.[0]?.pricing?.feeDisplayMode || 'exclusive';
    let grandTotal;

    if (feeDisplayMode === 'inclusive') {
        // Fees are included in the base price
        grandTotal = discountedSubtotal;
    } else {
        // Fees are added on top
        grandTotal = discountedSubtotal + fees.total;
    }

    // Apply rounding
    const roundingRule = event.ticketCatalog?.tiers?.[0]?.pricing?.roundingRule || 'none';
    const roundingPrecision = event.ticketCatalog?.tiers?.[0]?.pricing?.roundingPrecision || 0;
    grandTotal = applyRounding(grandTotal, roundingRule, roundingPrecision);

    // Validate margins
    const marginValidation = validateMargins(
        { subtotal, discountTotal },
        { commission: promoterCode ? calculatePromoterDiscounts(calculatedItems, event, event.promoterSettings).commission : 0 },
        event
    );

    warnings.push(...marginValidation.warnings);

    return {
        items: calculatedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        discounts,
        discountTotal: Math.round(discountTotal * 100) / 100,
        fees: {
            platformFee: fees.platformFee,
            paymentFee: fees.paymentFee,
            serviceFee: fees.hostFee + fees.clubFee,
            tax: fees.tax,
            total: fees.total
        },
        grandTotal: Math.round(grandTotal * 100) / 100,
        currency: 'INR',
        warnings,
        isFreeOrder: grandTotal === 0
    };
}

export default {
    calculateTierPrice,
    applyRounding,
    calculateFees,
    applyPromoCode,
    calculatePromoterDiscounts,
    calculateBundlePricing,
    validateMargins,
    calculatePricing,
    DEFAULT_FEES,
    MINIMUM_PAYOUT_FLOOR
};

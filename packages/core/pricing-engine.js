/**
 * THE C1RCLE - Master Pricing Engine
 * Production-grade pricing calculations for tickets, fees, and discounts.
 * Unified source of truth for Apps, API, and Functions.
 */

// Default fee configuration (platform authority)
const DEFAULT_FEES = {
    platformFeeRate: 0.05,     // 5%
    paymentFeeRate: 0.025,    // 2.5% (Razorpay)
    gstRate: 0.18             // 18% on fees
};

/**
 * Get effective price for a single tier at a given timestamp
 * Handles scheduled price changes
 */
export function getEffectivePrice(tier, timestamp = new Date()) {
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // 1. Check scheduled prices (if any)
    const schedules = tier.scheduledPrices || tier.pricing?.scheduledChanges || [];
    if (Array.isArray(schedules)) {
        for (const schedule of schedules) {
            const startsAt = new Date(schedule.startsAt);
            const endsAt = new Date(schedule.endsAt);

            if (now >= startsAt && now <= endsAt) {
                return {
                    price: Number(schedule.price),
                    label: schedule.name,
                    isScheduled: true
                };
            }
        }
    }

    // 2. Fall back to base price
    return {
        price: Number(tier.basePrice ?? tier.price ?? 0),
        label: null,
        isScheduled: false
    };
}

/**
 * Calculate fees for a given discounted subtotal
 * Hierarchy: Platform 5% -> Payment 2.5% -> GST 18% on Fees
 */
export function calculateFees(discountedSubtotal) {
    if (discountedSubtotal <= 0) {
        return { platform: 0, payment: 0, gst: 0, total: 0 };
    }

    const platform = Math.round((discountedSubtotal * DEFAULT_FEES.platformFeeRate) * 100) / 100;
    const payment = Math.round((discountedSubtotal * DEFAULT_FEES.paymentFeeRate) * 100) / 100;

    // GST is applied ONLY on the service fees (platform + payment)
    const gst = Math.round(((platform + payment) * DEFAULT_FEES.gstRate) * 100) / 100;

    return {
        platform,
        payment,
        gst,
        total: Math.round((platform + payment + gst) * 100) / 100
    };
}

/**
 * Main Pricing Engine
 * Calculates complete pricing for a checkout session
 */
export async function calculatePricing(input) {
    const {
        event,
        items,
        promoCode = null,
        promoterCode = null,
        userId = null,
        timestamp = new Date()
    } = input;

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const result = {
        items: [],
        subtotal: 0,
        discounts: [],
        discountTotal: 0,
        fees: { platform: 0, payment: 0, gst: 0, total: 0 },
        grandTotal: 0,
        isFree: false,
        ledger: {
            subtotal_raw: 0,
            discount_total_raw: 0,
            fees_total_raw: 0,
            total_raw: 0,
            currency: 'INR',
            version: '3.0.unified'
        }
    };

    // 1. Calculate Item Base Prices
    for (const item of items) {
        const tier = tiers.find(t => t.id === item.tierId);
        if (!tier) continue;

        const priceInfo = getEffectivePrice(tier, timestamp);
        const quantity = Number(item.quantity) || 1;
        const subtotal = priceInfo.price * quantity;

        result.items.push({
            tierId: tier.id,
            tierName: tier.name,
            quantity,
            unitPrice: priceInfo.price,
            priceLabel: priceInfo.label,
            subtotal,
            formatted: {
                unitPrice: `₹${priceInfo.price.toLocaleString()}`,
                subtotal: `₹${subtotal.toLocaleString()}`
            }
        });

        result.subtotal += subtotal;
    }

    // 2. Apply Promoter Discounts (Buyer side)
    if (promoterCode && event.promoterSettings?.enabled && event.promoterSettings?.buyerDiscountsEnabled) {
        let totalPromoterDiscount = 0;
        for (const item of result.items) {
            const tier = tiers.find(t => t.id === item.tierId);
            if (!tier || tier.promoterEnabled === false) continue;

            let rate = event.promoterSettings.discount || 0;
            let type = event.promoterSettings.discountType || 'percent';

            if (!event.promoterSettings.useDefaultDiscount && tier.promoterDiscount !== undefined) {
                rate = tier.promoterDiscount;
                type = tier.promoterDiscountType || 'percent';
            }

            if (type === 'percent') {
                totalPromoterDiscount += (item.subtotal * rate) / 100;
            } else {
                totalPromoterDiscount += rate * item.quantity;
            }
        }

        if (totalPromoterDiscount > 0) {
            const amount = Math.round(totalPromoterDiscount * 100) / 100;
            result.discounts.push({
                type: 'promoter',
                code: promoterCode,
                amount,
                label: 'Promoter Discount'
            });
            result.discountTotal += amount;
        }
    }

    // 3. Apply Promo Codes
    // Note: In Phase 1, we still rely on the external validator if provided, 
    // but the engine handles the arithmetic.
    if (promoCode && input.promoValidator) {
        const promoRes = await input.promoValidator(event.id, promoCode, userId, result.items);
        if (promoRes.valid) {
            result.discounts.push({
                type: 'promo',
                code: promoCode,
                id: promoRes.promoCode?.id,
                amount: promoRes.discountAmount,
                label: promoRes.message || 'Promo Applied'
            });
            result.discountTotal += promoRes.discountAmount;
        }
    }

    // 4. Final Reconciliation
    const discountedSubtotal = Math.max(0, result.subtotal - result.discountTotal);
    result.fees = calculateFees(discountedSubtotal);
    result.grandTotal = Math.round((discountedSubtotal + result.fees.total) * 100) / 100;
    result.isFree = result.grandTotal === 0;

    // 5. Populate Audit Ledger
    result.ledger = {
        ...result.ledger,
        subtotal_raw: result.subtotal,
        discount_total_raw: result.discountTotal,
        fees_platform_raw: result.fees.platform,
        fees_payment_raw: result.fees.payment,
        fees_gst_raw: result.fees.gst,
        fees_total_raw: result.fees.total,
        total_raw: result.grandTotal
    };

    return { success: true, pricing: result };
}

export default {
    getEffectivePrice,
    calculateFees,
    calculatePricing,
    DEFAULT_FEES
};

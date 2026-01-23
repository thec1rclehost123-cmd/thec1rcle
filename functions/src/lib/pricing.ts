

import { validatePromoCode } from './promos';

export function getEffectivePrice(tier: any, timestamp = new Date()) {
    const now = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Check scheduled prices
    if (tier.scheduledPrices && Array.isArray(tier.scheduledPrices)) {
        for (const schedule of tier.scheduledPrices) {
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

    // Fall back to base price
    return {
        price: Number(tier.basePrice ?? tier.price ?? 0),
        label: null,
        isScheduled: false
    };
}

export async function calculatePricingInternal(event: any, items: any[], options: any = {}) {
    const { promoCode = null, promoterCode = null, userId = null } = options;

    const tiers = event.ticketCatalog?.tiers || event.tickets || [];
    const result: any = {
        items: [],
        subtotal: 0,
        discounts: [],
        discountTotal: 0,
        fees: { platform: 0, payment: 0, gst: 0, total: 0 },
        grandTotal: 0,
        isFree: false,
        // Audit Ledger fields
        ledger: {
            subtotal_raw: 0,
            discount_total_raw: 0,
            fees_platform_raw: 0,
            fees_payment_raw: 0,
            fees_gst_raw: 0,
            total_raw: 0,
            currency: 'INR'
        }
    };

    // 1. DYNAMIC TIER PRICING AUTHORITY
    for (const item of items) {
        const tier = tiers.find((t: any) => t.id === item.tierId);
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
            subtotal,
            formatted: {
                unitPrice: `₹${priceInfo.price.toLocaleString()}`,
                subtotal: `₹${subtotal.toLocaleString()}`
            }
        });

        result.subtotal += subtotal;
    }

    // 2. PROMOTER DISCOUNTauthority
    if (promoterCode && event.promoterSettings?.enabled && event.promoterSettings?.buyerDiscountsEnabled) {
        let totalPromoterDiscount = 0;
        for (const item of result.items) {
            const tier = tiers.find((t: any) => t.id === item.tierId);
            if (!tier || tier.promoterEnabled === false) continue;

            let discountRate = event.promoterSettings.discount || 0;
            let discountType = event.promoterSettings.discountType || 'percent';

            if (!event.promoterSettings.useDefaultDiscount && tier.promoterDiscount !== undefined) {
                discountRate = tier.promoterDiscount;
                discountType = tier.promoterDiscountType || 'percent';
            }

            if (discountType === 'percent') {
                totalPromoterDiscount += (item.subtotal * discountRate) / 100;
            } else {
                totalPromoterDiscount += discountRate * item.quantity;
            }
        }

        if (totalPromoterDiscount > 0) {
            const amount = Math.round(totalPromoterDiscount * 100) / 100;
            result.discounts.push({
                type: 'promoter',
                code: promoterCode,
                amount,
                label: 'Promoter Discount',
                formatted: `- ₹${amount.toLocaleString()}`
            });
            result.discountTotal += totalPromoterDiscount;
        }
    }

    // 3. PROMO CODES authority
    if (promoCode) {
        const promoRes = await validatePromoCode(event.id, promoCode, userId, result.items);
        if (promoRes.valid && promoRes.promoCode) {
            result.discounts.push({
                type: 'promo',
                code: promoCode,
                id: promoRes.promoCode.id,
                amount: promoRes.discountAmount,
                label: promoRes.message || 'Promo Applied',
                formatted: `- ₹${promoRes.discountAmount.toLocaleString()}`
            });
            result.discountTotal += promoRes.discountAmount;
        } else {
            result.promoError = promoRes.error;
        }
    }

    // 4. FEE HIERARCHY (Platform 5% → Payment 2.5% → GST 18% on Fees)
    const discountedSubtotal = Math.max(0, result.subtotal - result.discountTotal);

    if (discountedSubtotal > 0) {
        // Platform Fee: 5% (fixed authority)
        result.fees.platform = Math.round((discountedSubtotal * 0.05) * 100) / 100;

        // Payment Fee: 2.5% (fixed authority)
        result.fees.payment = Math.round((discountedSubtotal * 0.025) * 100) / 100;

        // GST: 18% only on the service fees (platform + payment)
        result.fees.gst = Math.round(((result.fees.platform + result.fees.payment) * 0.18) * 100) / 100;

        result.fees.total = Math.round((result.fees.platform + result.fees.payment + result.fees.gst) * 100) / 100;

        // Formatted versions for UI display
        result.fees.formatted = {
            platform: `₹${result.fees.platform.toLocaleString()}`,
            payment: `₹${result.fees.payment.toLocaleString()}`,
            gst: `₹${result.fees.gst.toLocaleString()}`,
            total: `₹${result.fees.total.toLocaleString()}`
        };
    }

    // 5. FINAL RECONCILIATION
    result.grandTotal = Math.round((discountedSubtotal + result.fees.total) * 100) / 100;
    result.isFree = result.grandTotal === 0;

    // Populate Master Ledger for audit trail
    result.ledger = {
        subtotal_raw: result.subtotal,
        discount_total_raw: result.discountTotal,
        discounted_subtotal_raw: discountedSubtotal,
        fees_platform_raw: result.fees.platform,
        fees_payment_raw: result.fees.payment,
        fees_gst_raw: result.fees.gst,
        fees_total_raw: result.fees.total,
        total_raw: result.grandTotal,
        currency: 'INR',
        logic_version: '2.0.hardened'
    };

    // Client display labels
    result.display = {
        subtotal: `₹${result.subtotal.toLocaleString()}`,
        discounts: `- ₹${result.discountTotal.toLocaleString()}`,
        fees: `₹${result.fees.total.toLocaleString()}`,
        total: `₹${result.grandTotal.toLocaleString()}`
    };

    return { success: true, pricing: result };
}



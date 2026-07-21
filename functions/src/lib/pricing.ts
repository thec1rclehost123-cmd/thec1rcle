import { validatePromoCode } from './promos';
// @ts-ignore
import {
  calculatePricing as coreCalculatePricing,
  getEffectivePrice as coreGetEffectivePrice,
} from '@c1rcle/core/pricing-engine';

export function getEffectivePrice(tier: any, timestamp = new Date()) {
  return coreGetEffectivePrice(tier, timestamp);
}

export async function calculatePricingInternal(event: any, items: any[], options: any = {}) {
  const { promoCode = null, promoterCode = null, userId = null } = options;

  const result = await coreCalculatePricing({
    event,
    items,
    promoCode,
    promoterCode,
    userId,
    promoValidator: validatePromoCode, // Reuse functions-specific promo validator
  });

  if (!result.success) return result;

  const pricing = result.pricing;

  // Maintain legacy display and formatting fields for Cloud Functions consumers
  pricing.display = {
    subtotal: `₹${pricing.subtotal.toLocaleString()}`,
    discounts: `- ₹${pricing.discountTotal.toLocaleString()}`,
    fees: `₹${pricing.fees.total.toLocaleString()}`,
    total: `₹${pricing.grandTotal.toLocaleString()}`,
  };

  // Re-populate fee formatted versions if missing
  if (!pricing.fees.formatted) {
    pricing.fees.formatted = {
      platform: `₹${(pricing.fees.platform ?? pricing.fees.platformFee ?? 0).toLocaleString()}`,
      payment: `₹${(pricing.fees.payment ?? pricing.fees.paymentFee ?? 0).toLocaleString()}`,
      gst: `₹${(pricing.fees.gst ?? pricing.fees.tax ?? 0).toLocaleString()}`,
      total: `₹${(pricing.fees.total ?? 0).toLocaleString()}`,
    };
  }

  return { success: true, pricing };
}

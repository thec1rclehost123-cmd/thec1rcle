"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePricingInternal = exports.getEffectivePrice = void 0;
const promos_1 = require("./promos");
// @ts-ignore
const pricing_engine_1 = require("@c1rcle/core/pricing-engine");
function getEffectivePrice(tier, timestamp = new Date()) {
    return (0, pricing_engine_1.getEffectivePrice)(tier, timestamp);
}
exports.getEffectivePrice = getEffectivePrice;
async function calculatePricingInternal(event, items, options = {}) {
    const { promoCode = null, promoterCode = null, userId = null } = options;
    const result = await (0, pricing_engine_1.calculatePricing)({
        event,
        items,
        promoCode,
        promoterCode,
        userId,
        promoValidator: promos_1.validatePromoCode // Reuse functions-specific promo validator
    });
    if (!result.success)
        return result;
    const pricing = result.pricing;
    // Maintain legacy display and formatting fields for Cloud Functions consumers
    pricing.display = {
        subtotal: `₹${pricing.subtotal.toLocaleString()}`,
        discounts: `- ₹${pricing.discountTotal.toLocaleString()}`,
        fees: `₹${pricing.fees.total.toLocaleString()}`,
        total: `₹${pricing.grandTotal.toLocaleString()}`
    };
    // Re-populate fee formatted versions if missing
    if (!pricing.fees.formatted) {
        pricing.fees.formatted = {
            platform: `₹${pricing.fees.platform.toLocaleString()}`,
            payment: `₹${pricing.fees.payment.toLocaleString()}`,
            gst: `₹${pricing.fees.gst.toLocaleString()}`,
            total: `₹${pricing.fees.total.toLocaleString()}`
        };
    }
    return { success: true, pricing };
}
exports.calculatePricingInternal = calculatePricingInternal;
//# sourceMappingURL=pricing.js.map
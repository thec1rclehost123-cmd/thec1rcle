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
    var _a, _b, _c, _d, _e, _f, _g;
    const { promoCode = null, promoterCode = null, userId = null } = options;
    const result = await (0, pricing_engine_1.calculatePricing)({
        event,
        items,
        promoCode,
        promoterCode,
        userId,
        promoValidator: promos_1.validatePromoCode, // Reuse functions-specific promo validator
    });
    if (!result.success)
        return result;
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
            platform: `₹${((_b = (_a = pricing.fees.platform) !== null && _a !== void 0 ? _a : pricing.fees.platformFee) !== null && _b !== void 0 ? _b : 0).toLocaleString()}`,
            payment: `₹${((_d = (_c = pricing.fees.payment) !== null && _c !== void 0 ? _c : pricing.fees.paymentFee) !== null && _d !== void 0 ? _d : 0).toLocaleString()}`,
            gst: `₹${((_f = (_e = pricing.fees.gst) !== null && _e !== void 0 ? _e : pricing.fees.tax) !== null && _f !== void 0 ? _f : 0).toLocaleString()}`,
            total: `₹${((_g = pricing.fees.total) !== null && _g !== void 0 ? _g : 0).toLocaleString()}`,
        };
    }
    return { success: true, pricing };
}
exports.calculatePricingInternal = calculatePricingInternal;
//# sourceMappingURL=pricing.js.map
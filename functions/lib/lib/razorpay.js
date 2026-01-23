"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRazorpayOrder = exports.isRazorpayConfigured = void 0;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const razorpay_1 = __importDefault(require("razorpay"));
function isRazorpayConfigured() {
    return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}
exports.isRazorpayConfigured = isRazorpayConfigured;
async function createRazorpayOrder({ amount, currency = "INR", receipt, notes = {} }) {
    if (!isRazorpayConfigured()) {
        console.log("[Razorpay] Not configured, returning mock order");
        return {
            id: `order_mock_${Date.now()}`,
            amount,
            currency,
            receipt,
            status: "created",
            created_at: Math.floor(Date.now() / 1000)
        };
    }
    const instance = new razorpay_1.default({
        key_id: RAZORPAY_KEY_ID || '',
        key_secret: RAZORPAY_KEY_SECRET || '',
    });
    return await instance.orders.create({
        amount,
        currency,
        receipt,
        notes
    });
}
exports.createRazorpayOrder = createRazorpayOrder;
//# sourceMappingURL=razorpay.js.map
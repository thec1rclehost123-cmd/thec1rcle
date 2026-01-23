
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

import Razorpay from 'razorpay';

export function isRazorpayConfigured() {
    return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder({
    amount,
    currency = "INR",
    receipt,
    notes = {}
}: any) {
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

    const instance = new Razorpay({
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

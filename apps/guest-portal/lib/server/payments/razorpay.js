/**
 * Razorpay Payment Integration
 * Handles payment creation, verification, and refunds
 */

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Check if Razorpay is configured
export function isRazorpayConfigured() {
    return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

/**
 * Create a Razorpay order
 * @param {Object} orderDetails - Order details
 * @returns {Object} Razorpay order response
 */
export async function createRazorpayOrder({
    amount, // Amount in paise (₹100 = 10000 paise)
    currency = "INR",
    receipt, // Order ID from our system
    notes = {}
}) {
    if (!isRazorpayConfigured()) {
        // Return mock order for development
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

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify({
            amount,
            currency,
            receipt,
            notes
        })
    });

    if (!response.ok) {
        const error = await response.json();
        console.error("[Razorpay] Order creation failed:", error);
        throw new Error(error.error?.description || "Failed to create payment order");
    }

    return await response.json();
}

/**
 * Verify Razorpay payment signature
 * @param {Object} paymentData - Payment response from Razorpay
 * @returns {boolean} Whether signature is valid
 */
export function verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
}) {
    if (!isRazorpayConfigured()) {
        // Auto-verify in development
        return true;
    }

    const crypto = require("node:crypto");
    const data = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(data)
        .digest("hex");

    return expectedSignature === razorpay_signature;
}

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Object} Payment details
 */
export async function fetchPayment(paymentId) {
    if (!isRazorpayConfigured()) {
        return {
            id: paymentId,
            amount: 0,
            status: "captured",
            method: "mock"
        };
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: {
            "Authorization": `Basic ${auth}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.description || "Failed to fetch payment");
    }

    return await response.json();
}

/**
 * Capture a payment (for authorized but not captured payments)
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in paise
 * @returns {Object} Capture response
 */
export async function capturePayment(paymentId, amount) {
    if (!isRazorpayConfigured()) {
        return { id: paymentId, status: "captured", amount };
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify({ amount })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.description || "Failed to capture payment");
    }

    return await response.json();
}

/**
 * Initiate a refund
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund in paise (optional, full refund if not specified)
 * @param {Object} options - Additional refund options
 * @returns {Object} Refund response
 */
export async function initiateRefund(paymentId, amount = null, options = {}) {
    if (!isRazorpayConfigured()) {
        return {
            id: `rfnd_mock_${Date.now()}`,
            payment_id: paymentId,
            amount: amount || 0,
            status: "processed"
        };
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const body = {
        speed: options.speed || "normal", // "normal" or "optimum"
        notes: options.notes || {}
    };

    if (amount) {
        body.amount = amount;
    }

    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.description || "Failed to initiate refund");
    }

    return await response.json();
}

/**
 * Fetch refund details
 * @param {string} refundId - Razorpay refund ID
 * @returns {Object} Refund details
 */
export async function fetchRefund(refundId) {
    if (!isRazorpayConfigured()) {
        return { id: refundId, status: "processed" };
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/refunds/${refundId}`, {
        headers: {
            "Authorization": `Basic ${auth}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.description || "Failed to fetch refund");
    }

    return await response.json();
}

/**
 * Get Razorpay client configuration for frontend
 * @returns {Object} Client configuration
 */
export function getRazorpayClientConfig() {
    return {
        key: RAZORPAY_KEY_ID || "rzp_test_DEVELOPMENT",
        currency: "INR",
        name: "THE C1RCLE",
        description: "Event Tickets",
        image: "/logo.png",
        prefill: {
            name: "",
            email: "",
            contact: ""
        },
        theme: {
            color: "#1d1d1f"
        }
    };
}

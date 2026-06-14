/**
 * Razorpay HTTP Client — thin wrapper around the Razorpay REST API.
 *
 * Uses native `fetch` + HTTP Basic Auth (key_id:key_secret).
 * No npm package needed — the SDK is just a wrapper around these same calls.
 *
 * Required environment variables:
 *   RAZORPAY_KEY_ID      — test: rzp_test_xxx  / live: rzp_live_xxx
 *   RAZORPAY_KEY_SECRET  — the secret corresponding to the key
 *
 * Razorpay API docs: https://razorpay.com/docs/api/orders/
 */

const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";

/** Returns the Basic Auth header value: "Basic base64(key_id:key_secret)" */
function getAuthHeader(): string {
    const keyId     = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    return `Basic ${credentials}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RazorpayOrderCreateParams {
    /** Amount in PAISE (smallest currency unit). e.g. ₹500 = 50000 paise */
    amount: number;
    currency?: string;          // defaults to "INR"
    receipt: string;            // our reservationId — used for idempotency
    notes?: Record<string, string>;
}

export interface RazorpayOrder {
    id: string;                 // "order_xxxxx" — sent to frontend for Razorpay.js
    entity: string;             // "order"
    amount: number;             // paise
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;            // mirrors what we sent (= reservationId)
    status: "created" | "attempted" | "paid";
    attempts: number;
    created_at: number;         // Unix timestamp
}

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay order.
 *
 * IDEMPOTENCY via `receipt`:
 *   If this call is retried with the same `receipt` (= our reservationId),
 *   Razorpay returns the SAME order rather than creating a duplicate.
 *   This means if the network drops after Razorpay creates the order but
 *   before we update Firestore, a retry of POST /api/payment/initiate
 *   will get the same orderId and succeed safely.
 *
 * Throws on non-2xx responses with the Razorpay error description.
 */
export async function createRazorpayOrder(
    params: RazorpayOrderCreateParams
): Promise<RazorpayOrder> {
    const body = {
        amount:   params.amount,
        currency: params.currency ?? "INR",
        receipt:  params.receipt,
        notes:    params.notes ?? {},
    };

    const response = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
        method: "POST",
        headers: {
            "Content-Type":  "application/json",
            "Authorization": getAuthHeader(),
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        // Razorpay error shape: { error: { code, description, reason, ... } }
        const description = data?.error?.description || `Razorpay API error ${response.status}`;
        throw new Error(description);
    }

    return data as RazorpayOrder;
}

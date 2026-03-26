/**
 * POST /api/payment/webhook
 *
 * Razorpay calls this endpoint whenever a payment event occurs.
 * This is the ONLY place bookings are confirmed. Never the client.
 *
 * CRITICAL: This route must NOT use `withAuth`. Razorpay doesn't send
 * Firebase tokens. Authentication here is done via HMAC-SHA256 signature.
 *
 * CRITICAL: We must read the raw body as text BEFORE parsing as JSON.
 * HMAC is computed over the exact bytes Razorpay sent — any parsing/
 * re-serialization would corrupt the signature check.
 *
 * Required env var:
 *   RAZORPAY_WEBHOOK_SECRET — set in Razorpay Dashboard → Webhooks → Secret
 *   (different from RAZORPAY_KEY_SECRET — do not confuse them)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { confirmBooking } from "@/lib/server/bookingStore";

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

/**
 * Verifies the `X-Razorpay-Signature` header against the raw request body.
 *
 * Razorpay computes: HMAC-SHA256(rawBody, webhookSecret)
 * We compute the same and compare using timingSafeEqual to prevent
 * timing-based attacks that could allow forged webhook calls.
 */
function verifyRazorpaySignature(rawBody: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        logger.error("webhook", "RAZORPAY_WEBHOOK_SECRET is not set");
        return false;
    }

    const expectedSignature = createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    // timingSafeEqual prevents timing attacks — always compare same-length buffers
    try {
        return timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(signature,         "hex")
        );
    } catch {
        // Buffer lengths differ (malformed signature) → reject
        return false;
    }
}

// ---------------------------------------------------------------------------
// Webhook payload types (Razorpay event shape)
// ---------------------------------------------------------------------------

interface RazorpayWebhookPayload {
    event: string;              // "payment.captured" | "payment.failed" | ...
    payload: {
        payment: {
            entity: {
                id:       string;   // "pay_xxx" — razorpayPaymentId
                order_id: string;   // "order_xxx" — razorpayOrderId
                amount:   number;   // paise
                currency: string;
                status:   string;   // "captured" | "failed" | ...
            };
        };
    };
    created_at: number;         // Unix timestamp
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    // ── Step 1: Read raw body as text — required for HMAC ────────────────────
    // DO NOT call req.json() before this. JSON.parse → JSON.stringify would
    // change whitespace and break the signature check.
    const rawBody = await req.text();

    // ── Step 2: Verify HMAC signature ────────────────────────────────────────
    // Razorpay sends the signature in the X-Razorpay-Signature header.
    // If missing or invalid, reject immediately with 400 (not 401 — we don't
    // want to leak that auth is involved).
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    if (!signature || !verifyRazorpaySignature(rawBody, signature)) {
        logger.warn("webhook", "Invalid or missing Razorpay signature — request rejected");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ── Step 3: Parse the verified payload ───────────────────────────────────
    let payload: RazorpayWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        logger.warn("webhook", "Failed to parse webhook body");
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // ── Step 4: Route by event type ──────────────────────────────────────────
    // We only care about payment.captured (money received).
    // All other events (payment.failed, refund.created, etc.) are ignored
    // in Phase-1 — Razorpay will still expect a 200 response.
    const { event, payload: eventPayload } = payload;

    if (event !== "payment.captured") {
        // Acknowledge receipt so Razorpay stops retrying — we just don't act on it
        logger.info("webhook", `Ignored event: ${event}`);
        return NextResponse.json({ received: true });
    }

    const { id: razorpayPaymentId, order_id: razorpayOrderId, amount: paidAmount } =
        eventPayload.payment.entity;

    if (!razorpayPaymentId || !razorpayOrderId || typeof paidAmount !== "number") {
        logger.error("webhook", "Missing paymentId, orderId, or amount in payload", { event, payload });
        return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
    }

    // ── Step 5: Confirm the booking ───────────────────────────────────────────
    // paidAmount (in paise) is verified inside confirmBooking against
    // reservation.totalAmount — we never trust client-supplied amounts.
    try {
        const result = await confirmBooking(razorpayOrderId, razorpayPaymentId, paidAmount);

        switch (result) {
            case "confirmed":
                logger.info("webhook", "Booking confirmed successfully", {
                    razorpayOrderId,
                    razorpayPaymentId,
                });
                break;

            case "already_processed":
                // Normal — Razorpay re-delivered a webhook we already handled.
                // Returning 200 stops further retries.
                logger.info("webhook", "Duplicate webhook — already processed", {
                    razorpayPaymentId,
                });
                break;

            case "expired_refund_needed":
                // Money received for an expired reservation.
                // Logged inside confirmBooking() with all details for ops team.
                // We still return 200 so Razorpay doesn't retry indefinitely.
                logger.error("webhook", "Manual refund needed", {
                    razorpayOrderId,
                    razorpayPaymentId,
                });
                break;
        }

        // ALWAYS return 200 to Razorpay after processing.
        // Any non-200 tells Razorpay to retry — which we only want on real failures.
        return NextResponse.json({ received: true });

    } catch (error: any) {
        // Unexpected error (Firestore down, network issue, etc.)
        // Return 500 — this WILL cause Razorpay to retry, which is correct:
        // the payment was captured but we failed to confirm the booking.
        // Razorpay retries with exponential backoff for up to 24 hours.
        logger.error("webhook", "Unhandled error processing webhook", {
            error:             error.message,
            razorpayOrderId,
            razorpayPaymentId,
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

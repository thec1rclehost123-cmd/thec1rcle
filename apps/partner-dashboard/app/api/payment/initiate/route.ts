import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { initiatePayment, PaymentError } from "@/lib/server/paymentStore";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const InitiatePaymentSchema = z.object({
    reservationId: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// POST /api/payment/initiate
//
// Creates a Razorpay order for an existing "pending" reservation.
// Returns the order details the frontend needs to open the Razorpay checkout.
//
// DOES NOT:
//   - Confirm the booking (that is the webhook's job — Step 5)
//   - Trust any payment result from the client
//   - Create a booking doc
//
// Frontend flow after this call:
//   1. Receive { razorpayOrderId, razorpayKeyId, amount, currency }
//   2. Open Razorpay.js checkout
//   3. On success callback → show "Processing your payment..." UI
//   4. Poll GET /api/bookings/me or wait for page refresh
//      (the webhook has already confirmed in the background)
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        // ── Parse & validate ─────────────────────────────────────────────────
        const body = await req.json().catch(() => null);
        if (!body) return fail("Request body is required", 400);

        const parsed = InitiatePaymentSchema.safeParse(body);
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);
        }

        const { reservationId } = parsed.data;
        const userId = auth.uid;

        if (!isFirebaseConfigured()) {
            return fail("Payment service is unavailable", 503);
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            logger.error("payment/initiate", "Razorpay env vars missing");
            return fail("Payment service is not configured", 503);
        }

        // ── Initiate ─────────────────────────────────────────────────────────
        const result = await initiatePayment(reservationId, userId);

        logger.info("payment/initiate", "Razorpay order created", {
            reservationId,
            razorpayOrderId: result.razorpayOrderId,
            userId,
            amount: result.amount,
        });

        // Return everything Razorpay.js needs to open checkout.
        // razorpayKeyId is public — safe to send to frontend.
        // razorpayKeySecret is NEVER sent to the client.
        return ok({
            razorpayOrderId: result.razorpayOrderId,
            razorpayKeyId:   result.razorpayKeyId,
            reservationId:   result.reservationId,
            amount:          result.amount,     // paise
            currency:        result.currency,   // "INR"
            expiresAt:       result.expiresAt,  // ISO — show countdown
        });

    } catch (error: any) {
        // ── Known business errors — 4xx ──────────────────────────────────────
        if (error instanceof PaymentError) {
            const statusMap: Record<string, number> = {
                RESERVATION_NOT_FOUND:    404,
                RESERVATION_NOT_PENDING:  409,
                RESERVATION_EXPIRED:      410,  // 410 Gone — reservation is dead
                WRONG_USER:               403,
            };
            return fail(error.message, statusMap[error.code] ?? 400);
        }

        // ── Infrastructure / Razorpay errors — 500 ──────────────────────────
        logger.error("payment/initiate", "POST failed", { error: error.message });
        return fail("Failed to initiate payment. Please try again.", 500);
    }
});

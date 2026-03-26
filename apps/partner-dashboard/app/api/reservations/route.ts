import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { createReservation, ReservationError } from "@/lib/server/reservationStore";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const CreateReservationSchema = z.object({
    eventId:  z.string().min(1).max(128),
    quantity: z.number().int().min(1).max(10),
});

// ---------------------------------------------------------------------------
// POST /api/reservations
//
// Creates a seat hold via Firestore transaction.
// Returns the reservation ID and total amount (in paise) to hand off to
// POST /api/payments for Razorpay order creation (Step 3).
//
// Does NOT create a Razorpay order — that is Step 3.
// Does NOT charge the user — payment is Step 4.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        // ── Parse & validate body ────────────────────────────────────────────
        const body = await req.json().catch(() => null);
        if (!body) return fail("Request body is required", 400);

        const parsed = CreateReservationSchema.safeParse(body);
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);
        }

        const { eventId, quantity } = parsed.data;
        const userId = auth.uid; // Firebase Auth UID from verified token

        // ── Firebase availability check ──────────────────────────────────────
        if (!isFirebaseConfigured()) {
            return fail("Booking service is unavailable", 503);
        }

        // ── Run the atomic reservation transaction ───────────────────────────
        // This is where race conditions are handled. See reservationStore.ts
        // for a full explanation of how Firestore optimistic concurrency works.
        const reservation = await createReservation(eventId, userId, quantity);

        logger.info("reservations", "Reservation created", {
            reservationId: reservation.id,
            eventId,
            userId,
            quantity,
            totalAmount: reservation.totalAmount,
        });

        return ok(
            {
                reservationId: reservation.id,
                eventId:       reservation.eventId,
                quantity:      reservation.quantity,
                totalAmount:   reservation.totalAmount,    // paise — pass to Razorpay
                pricePerSeat:  reservation.pricePerSeat,  // paise — for display
                expiresAt:     reservation.expiresAt,     // ISO — show countdown in UI
            },
            "Reservation created",
            201
        );

    } catch (error: any) {
        // ── Known business errors — return 4xx ───────────────────────────────
        if (error instanceof ReservationError) {
            const statusMap: Record<string, number> = {
                EVENT_NOT_FOUND:     404,
                EVENT_NOT_AVAILABLE: 409,
                INSUFFICIENT_SEATS:  409,
                INVALID_QUANTITY:    400,
            };
            return fail(error.message, statusMap[error.code] ?? 400);
        }

        // ── Unknown / infrastructure errors — log and return 500 ─────────────
        logger.error("reservations", "POST failed", { error: error.message });
        return fail("Failed to create reservation. Please try again.", 500);
    }
});

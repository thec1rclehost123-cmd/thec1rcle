/**
 * Booking Store — webhook-driven confirmation logic.
 *
 * Called ONLY by POST /api/payment/webhook after HMAC verification.
 *
 * "processing" status (UX improvement):
 *   Before the main transaction, we set the reservation to "processing".
 *   This makes the brief confirmation window (~100–500ms) visible to the
 *   frontend — users see "Confirming your booking..." instead of
 *   "Payment pending" during this window.
 *
 * bookingRef (product improvement):
 *   Every confirmed booking gets a human-readable reference: "CIR-XXXXXX".
 *   This is shown in the UI, email confirmations, and at the event gate
 *   alongside the QR code.
 *
 * Audit logs:
 *   PROCESSING and CONFIRMED events are written to `booking_audit_logs`.
 *   Failures in audit log writes are silently swallowed (non-critical).
 */

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase/admin";
import { logger } from "./logger";
import { writeAuditLog } from "./auditLogStore";
import type { ReservationDoc, BookingDoc, EventDoc } from "../types/booking";

/** Generates a user-facing booking reference: "CIR-7F3K2A" */
function generateBookingRef(): string {
    return "CIR-" + randomBytes(3).toString("hex").toUpperCase();
}

// ---------------------------------------------------------------------------
// confirmBooking
// ---------------------------------------------------------------------------

export async function confirmBooking(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    paidAmount: number
): Promise<"confirmed" | "already_processed" | "expired_refund_needed"> {
    const db = getAdminDb();

    logger.info("bookingStore", "Webhook received", { razorpayOrderId, razorpayPaymentId, paidAmount });

    // ── Fast-path idempotency check ───────────────────────────────────────────
    const existingSnap = await db.collection("bookings")
        .where("razorpayPaymentId", "==", razorpayPaymentId)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        logger.info("bookingStore", "Duplicate webhook — booking already exists", {
            razorpayPaymentId,
            bookingId: existingSnap.docs[0].id,
        });
        return "already_processed";
    }

    // ── Find reservation by Razorpay order ID ────────────────────────────────
    const reservationSnap = await db.collection("reservations")
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();

    if (reservationSnap.empty) {
        logger.error("bookingStore", "CRITICAL: No reservation for Razorpay order", {
            razorpayOrderId, razorpayPaymentId,
        });
        return "already_processed";
    }

    const reservationRef = reservationSnap.docs[0].ref;
    const reservation    = reservationSnap.docs[0].data() as ReservationDoc;
    const eventRef       = db.collection("events").doc(reservation.eventId);

    // ── Set "processing" status (UX signal) ──────────────────────────────────
    // Written BEFORE the main transaction so the frontend can show
    // "Confirming your booking..." during the brief processing window.
    //
    // This is a best-effort write — if it fails we continue anyway.
    // The transaction below handles correctness regardless of this write.
    if (reservation.status === "payment_pending") {
        try {
            await reservationRef.update({
                status:    "processing",
                updatedAt: new Date().toISOString(),
            });
            // Audit: webhook received, processing started
            await writeAuditLog("PROCESSING", {
                eventId:       reservation.eventId,
                reservationId: reservation.id,
                userId:        reservation.userId,
                metadata: { razorpayOrderId, razorpayPaymentId },
            });
        } catch {
            // Non-critical — the transaction below still runs correctly
        }
    }

    // Generate IDs outside the transaction
    const bookingId  = randomBytes(16).toString("hex");
    const bookingRef = generateBookingRef();
    const qrToken    = randomBytes(16).toString("hex");
    const now        = new Date().toISOString();

    let outcome: "confirmed" | "already_processed" | "expired_refund_needed" = "confirmed";

    await db.runTransaction(async (tx: any) => {
        // ── ALL READS first (Firestore transaction requirement) ───────────────
        const resSnap   = await tx.get(reservationRef);
        const eventSnap = await tx.get(eventRef);

        if (!resSnap.exists) {
            outcome = "already_processed";
            return;
        }

        const res   = resSnap.data() as ReservationDoc;
        const event = eventSnap.exists ? (eventSnap.data() as EventDoc) : null;

        // ── CHECK 1: Status double-check (primary concurrency guard) ──────────
        // "confirmed" → another webhook already committed; exit cleanly.
        // "processing" → our own pre-set above; this is the expected state, proceed.
        // "payment_pending" → pre-set failed (Firestore glitch), still valid, proceed.
        if (res.status === "confirmed") {
            logger.info("bookingStore", "Already confirmed — skipping", { reservationId: res.id });
            outcome = "already_processed";
            return;
        }

        // ── CHECK 2: Expiry ───────────────────────────────────────────────────
        if (res.status === "expired") {
            logger.error("bookingStore", "EXPIRED_REFUND_CASE", {
                reservationId: res.id, razorpayOrderId, razorpayPaymentId,
                userId: res.userId, eventId: res.eventId, totalAmount: res.totalAmount,
                action: "MANUAL_REFUND_REQUIRED",
            });
            outcome = "expired_refund_needed";
            return;
        }

        // Any status that isn't processing/payment_pending → unexpected
        if (res.status !== "processing" && res.status !== "payment_pending") {
            logger.warn("bookingStore", "Unexpected reservation status on webhook", {
                reservationId: res.id, status: res.status,
            });
            outcome = "already_processed";
            return;
        }

        // ── CHECK 3: Amount verification (MONEY SAFETY) ───────────────────────
        if (paidAmount !== res.totalAmount) {
            logger.error("bookingStore", "AMOUNT_MISMATCH", {
                reservationId: res.id, razorpayPaymentId,
                paidAmount, expectedAmount: res.totalAmount,
                action: "MANUAL_REVIEW_REQUIRED",
            });
            outcome = "already_processed";
            return;
        }

        // ── CHECK 4: Event capacity safety ────────────────────────────────────
        if (event) {
            const currentSold = event.soldCount || 0;
            if (currentSold + res.quantity > event.totalSeats) {
                logger.error("bookingStore", "CAPACITY_EXCEEDED", {
                    reservationId: res.id, razorpayPaymentId,
                    currentSold, quantity: res.quantity, totalSeats: event.totalSeats,
                    action: "MANUAL_REFUND_REQUIRED",
                });
                outcome = "expired_refund_needed";
                return;
            }
        }

        // ── WRITE: All 3 writes atomically ────────────────────────────────────
        const bookingData: BookingDoc = {
            id:               bookingId,
            bookingRef,                     // "CIR-7F3K2A" — shown to user
            reservationId:    res.id,
            eventId:          res.eventId,
            userId:           res.userId,
            quantity:         res.quantity,
            pricePerSeat:     res.pricePerSeat,
            totalAmount:      res.totalAmount,
            razorpayOrderId,
            razorpayPaymentId,
            qrToken,
            status:           "confirmed",
            createdAt:        now,
            updatedAt:        now,
        };

        tx.set(db.collection("bookings").doc(bookingId), bookingData);
        tx.update(reservationRef, { status: "confirmed", updatedAt: now });
        tx.update(eventRef, {
            soldCount: FieldValue.increment(res.quantity),
            updatedAt: now,
        });

        outcome = "confirmed";
    });

    // ── Post-transaction: logging and audit ───────────────────────────────────
    if (outcome === "confirmed") {
        logger.info("bookingStore", "Booking created", {
            bookingId,
            bookingRef,
            reservationId: reservation.id,
            userId:        reservation.userId,
            eventId:       reservation.eventId,
            quantity:      reservation.quantity,
            totalAmount:   reservation.totalAmount,
        });

        logger.info("bookingStore", "Booking confirmed", { bookingId, bookingRef });

        await writeAuditLog("CONFIRMED", {
            eventId:       reservation.eventId,
            reservationId: reservation.id,
            userId:        reservation.userId,
            bookingId,
            metadata: { bookingRef, razorpayPaymentId, totalAmount: reservation.totalAmount },
        });
    } else if (outcome === "expired_refund_needed") {
        logger.warn("bookingStore", "Expired reservation — refund required", {
            reservationId: reservation.id,
            razorpayOrderId,
            razorpayPaymentId,
            totalAmount:   reservation.totalAmount,
        });

        await writeAuditLog("EXPIRED_REFUND_NEEDED", {
            eventId:       reservation.eventId,
            reservationId: reservation.id,
            userId:        reservation.userId,
            metadata: { razorpayOrderId, razorpayPaymentId, totalAmount: reservation.totalAmount },
        });
    }

    return outcome;
}

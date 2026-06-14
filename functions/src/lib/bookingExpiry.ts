/**
 * Booking Expiry — reservation cleanup for the Phase-1 booking system.
 *
 * Runs every 5 minutes via Firebase Scheduled Function (see index.ts).
 *
 * What it does:
 *   1. Queries `reservations` where:
 *        status IN ["pending", "payment_pending"]
 *        expiresAt < now
 *   2. For each stale reservation, runs a Firestore TRANSACTION that:
 *        a. Re-reads the reservation (to catch concurrent confirmation)
 *        b. Skips if status is already "confirmed" or "expired"
 *        c. Marks reservation as "expired"
 *        d. Increments event.availableSeats by reservation.quantity
 *
 * Safety properties:
 *   • No double-increment:  Transaction re-reads status before writing.
 *     If the webhook confirmed the reservation between the query and the
 *     transaction commit, the transaction sees status === "confirmed" and
 *     skips the seat restore entirely.
 *   • Safe on scheduler retry: If the function runs twice (GCP guarantees
 *     at-least-once delivery), the second run queries and finds status
 *     already "expired" or "confirmed" → skips them. Zero-seat double restore.
 *   • Batch limit: Processes 100 reservations per run. If more than 100
 *     are stale, they are caught in the next 5-minute window.
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

const RESERVATIONS_COLLECTION = "reservations";
const EVENTS_COLLECTION       = "events";
const BATCH_LIMIT             = 100;

/**
 * Expires stale reservations and restores their seats atomically.
 * Called by the scheduled function in index.ts.
 */
export async function expireStaleReservations(): Promise<void> {
    const now = new Date().toISOString();

    // Query for reservations past their expiry time in any active state:
    //   "pending"         → user held seats but never started payment
    //   "payment_pending" → user opened Razorpay but never completed
    //   "processing"      → webhook set processing but transaction failed/timed out
    //
    // Required Firestore composite index:
    //   Collection: reservations
    //   Fields:     status (Array contains-any), expiresAt (ASC)
    const staleSnap = await db.collection(RESERVATIONS_COLLECTION)
        .where("status", "in", ["pending", "payment_pending", "processing"])
        .where("expiresAt", "<", now)
        .limit(BATCH_LIMIT)
        .get();

    if (staleSnap.empty) {
        console.log("[BookingExpiry] No stale reservations found");
        return;
    }

    console.log(`[BookingExpiry] Found ${staleSnap.size} stale reservations — processing`);

    let expiredCount  = 0;
    let skippedCount  = 0;
    let errorCount    = 0;

    // Process each reservation in a separate transaction.
    // We do NOT use a single batch for all of them because each requires a
    // read-before-write (to check current status) which mandates a transaction.
    for (const doc of staleSnap.docs) {
        const reservationId = doc.id;
        const reservationRef = db.collection(RESERVATIONS_COLLECTION).doc(reservationId);

        try {
            await db.runTransaction(async (tx) => {
                // ── Re-read inside transaction ────────────────────────────────
                // The query result may be stale by the time we process it.
                // Re-reading inside the transaction ensures we act on the
                // latest state and that our write is atomic with our read.
                const freshSnap = await tx.get(reservationRef);

                if (!freshSnap.exists) {
                    // Reservation was deleted between query and transaction — skip
                    skippedCount++;
                    return;
                }

                const reservation = freshSnap.data() as any;

                // ── Skip-if-safe checks ────────────────────────────────────────
                // These are the cases where we must NOT restore seats:

                // Case 1: Webhook arrived and confirmed the booking before we
                // ran. Seats are correctly sold — do NOT restore them.
                if (reservation.status === "confirmed") {
                    console.log(`[BookingExpiry] Skipping confirmed reservation ${reservationId}`);
                    skippedCount++;
                    return;
                }

                // Case 2: Already expired by a previous scheduler run.
                // Seats already restored — do NOT double-restore.
                if (reservation.status === "expired") {
                    console.log(`[BookingExpiry] Skipping already-expired reservation ${reservationId}`);
                    skippedCount++;
                    return;
                }

                // Case 3: Cancelled reservations (user or admin cancelled them
                // before expiry, seats already restored at that point).
                if (reservation.status === "cancelled") {
                    skippedCount++;
                    return;
                }

                // ── Status is "pending", "payment_pending", or "processing" → expire ──
                const now = new Date().toISOString();
                const eventRef = db.collection(EVENTS_COLLECTION).doc(reservation.eventId);

                // Write 1: Mark reservation expired
                tx.update(reservationRef, {
                    status:    "expired",
                    updatedAt: now,
                });

                // Write 2: Restore the held seats atomically.
                tx.update(eventRef, {
                    availableSeats: admin.firestore.FieldValue.increment(reservation.quantity),
                    updatedAt:      now,
                });

                expiredCount++;
                console.log(`[BookingExpiry] Expired reservation ${reservationId}`, {
                    userId:    reservation.userId,
                    eventId:   reservation.eventId,
                    quantity:  reservation.quantity,
                    status:    reservation.status,
                });

                // Audit log — best-effort write outside the transaction
                db.collection("booking_audit_logs").add({
                    action:        "EXPIRED",
                    eventId:       reservation.eventId,
                    reservationId,
                    userId:        reservation.userId,
                    metadata: {
                        quantity:      reservation.quantity,
                        previousStatus: reservation.status,
                    },
                    timestamp: now,
                }).catch(() => { /* non-critical */ });
            });

        } catch (error: any) {
            // Log individual failures but continue processing the rest.
            // A single bad reservation shouldn't block others from being expired.
            errorCount++;
            console.error(`[BookingExpiry] Failed to expire reservation ${reservationId}:`, error.message);
        }
    }

    console.log(`[BookingExpiry] Complete — expired: ${expiredCount}, skipped: ${skippedCount}, errors: ${errorCount}`);
}

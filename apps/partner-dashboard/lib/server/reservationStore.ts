/**
 * Reservation Store — direct Firestore via Admin SDK
 *
 * Contains the atomic seat-hold transaction that prevents overbooking
 * and duplicate reservations.
 *
 * No Redis, no queues — Firestore optimistic concurrency handles contention.
 *
 * STATUS FLOW:
 *   createReservation()  → status: "pending"
 *   initiatePayment()    → status: "payment_pending"  (Razorpay order created)
 *   webhook confirms     → status: "confirmed"         (booking created)
 *   scheduler expires    → status: "expired"           (either pending or payment_pending)
 */

import { randomBytes } from "node:crypto";
import { getAdminDb } from "../firebase/admin";
import { writeAuditLog } from "./auditLogStore";
import type { ReservationDoc, EventDoc } from "../types/booking";

/** Reservation expires 15 minutes after creation */
const RESERVATION_TTL_MS = 15 * 60 * 1000;

/** Max seats per single reservation */
const MAX_QUANTITY = 10;

// ---------------------------------------------------------------------------
// Error codes — caught by the API route to return the right HTTP status
// ---------------------------------------------------------------------------
export class ReservationError extends Error {
    constructor(
        public readonly code:
            | "EVENT_NOT_FOUND"
            | "EVENT_NOT_AVAILABLE"
            | "INSUFFICIENT_SEATS"
            | "INVALID_QUANTITY"
            | "ALREADY_RESERVED",
        message: string
    ) {
        super(message);
        this.name = "ReservationError";
    }
}

// ---------------------------------------------------------------------------
// createReservation
// ---------------------------------------------------------------------------

/**
 * Atomically reserves `quantity` seats for `eventId` on behalf of `userId`.
 *
 * HOW OVERBOOKING IS PREVENTED (Firestore optimistic concurrency):
 * ─────────────────────────────────────────────────────────────────
 *   1. READ the event doc inside the transaction — Firestore records its version.
 *   2. Check availability and WRITE (decrement seats + create reservation)
 *      in the same atomic unit.
 *   3. At commit, Firestore compares the doc's current version against what
 *      we read. If another request mutated it in the meantime, our transaction
 *      is ABORTED and retried automatically (up to 5 times by the Admin SDK).
 *   4. Only one transaction can win per seat. The rest retry, re-read the
 *      decremented count, and throw INSUFFICIENT_SEATS if none remain.
 *
 * Result: 50 users booking the last 2 seats → exactly 2 succeed, 48 get 409.
 *
 * HOW DUPLICATE RESERVATIONS ARE PREVENTED (idempotency check):
 * ─────────────────────────────────────────────────────────────────
 *   Inside the same transaction, we query for any existing reservation where:
 *     userId == userId AND eventId == eventId AND status IN ["pending", "payment_pending"]
 *
 *   If one exists → throw ALREADY_RESERVED with the existing reservation ID.
 *
 *   The caller (API route) returns the existing reservation's ID in the
 *   409 response so the frontend can resume the existing flow instead of
 *   creating a duplicate.
 *
 *   Because this query runs inside the transaction, Firestore version-tracks
 *   it: if a concurrent request creates a matching reservation between our
 *   read and our write, our transaction is aborted and retried — on retry,
 *   the query will find the newly created reservation and throw ALREADY_RESERVED.
 */
export async function createReservation(
    eventId: string,
    userId: string,
    quantity: number
): Promise<ReservationDoc> {
    // Validate quantity before hitting Firestore
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new ReservationError(
            "INVALID_QUANTITY",
            `Quantity must be between 1 and ${MAX_QUANTITY}`
        );
    }

    const db = getAdminDb();
    const eventRef = db.collection("events").doc(eventId);

    // Generate the reservation ID upfront so we can reference it inside the
    // transaction. Using crypto.randomBytes for collision-safe IDs.
    const reservationId = randomBytes(16).toString("hex");
    const reservationRef = db.collection("reservations").doc(reservationId);

    // Build the idempotency query — checks for any active reservation from
    // this user for this event BEFORE we decrement seats or create a new doc.
    const existingQuery = db.collection("reservations")
        .where("userId", "==", userId)
        .where("eventId", "==", eventId)
        .where("status", "in", ["pending", "payment_pending"])
        .limit(1);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);

    let reservationData: ReservationDoc;

    await db.runTransaction(async (tx: any) => {
        // ── READ 1: Idempotency check ─────────────────────────────────────────
        // Query for an existing active reservation. Firestore version-tracks
        // this query result, so concurrent duplicate requests are caught on retry.
        const existingSnap = await tx.get(existingQuery);
        if (!existingSnap.empty) {
            const existing = existingSnap.docs[0].data() as ReservationDoc;
            throw new ReservationError(
                "ALREADY_RESERVED",
                // Pass existing ID in message — API route surfaces it to frontend
                // so the client can resume the existing payment flow.
                `Reservation already active: ${existing.id}`
            );
        }

        // ── READ 2: Event availability ────────────────────────────────────────
        // Firestore tracks this doc's version. If any other request changes
        // availableSeats between now and commit, the transaction retries.
        const eventSnap = await tx.get(eventRef);

        if (!eventSnap.exists) {
            throw new ReservationError("EVENT_NOT_FOUND", `Event ${eventId} not found`);
        }

        const event = eventSnap.data() as EventDoc;

        // ── BUSINESS RULES ────────────────────────────────────────────────────
        if (event.status !== "published") {
            throw new ReservationError(
                "EVENT_NOT_AVAILABLE",
                `Event is not available for booking (status: ${event.status})`
            );
        }

        if (event.availableSeats < quantity) {
            throw new ReservationError(
                "INSUFFICIENT_SEATS",
                event.availableSeats === 0
                    ? "This event is sold out"
                    : `Only ${event.availableSeats} seat(s) remaining`
            );
        }

        // ── WRITE: Atomic decrement + reservation creation ────────────────────
        // Both writes land in the same Firestore commit — they succeed or fail
        // together. No partial state is possible.

        const totalAmount = event.price * quantity;

        reservationData = {
            id: reservationId,
            eventId,
            userId,
            quantity,
            pricePerSeat: event.price,
            totalAmount,
            razorpayOrderId: null,  // Written in initiatePayment() — Step 3
            status: "pending",      // → "payment_pending" after Razorpay order creation
            expiresAt: expiresAt.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };

        // Decrement available seats atomically
        tx.update(eventRef, {
            availableSeats: event.availableSeats - quantity,
            updatedAt: now.toISOString(),
        });

        // Create the reservation doc
        tx.set(reservationRef, reservationData);
    });

    // Audit log — non-critical, swallowed on failure
    await writeAuditLog("RESERVED", {
        eventId:       reservationData!.eventId,
        reservationId: reservationData!.id,
        userId:        reservationData!.userId,
        metadata: { quantity, totalAmount: reservationData!.totalAmount, expiresAt: reservationData!.expiresAt },
    });

    return reservationData!;
}

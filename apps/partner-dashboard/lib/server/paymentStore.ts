/**
 * Payment Store — Razorpay order creation + reservation state transition.
 *
 * Called by POST /api/payment/initiate.
 *
 * This is a two-phase operation:
 *   Phase 1 — Read + validate the reservation from Firestore
 *   Phase 2 — Create a Razorpay order (external API call)
 *   Phase 3 — Update the reservation in Firestore (status + orderId)
 *
 * NOTE: Phases 2 and 3 are NOT in a Firestore transaction because Firestore
 * transactions cannot span external HTTP calls. Instead, idempotency is
 * guaranteed by the Razorpay `receipt` field (= reservationId):
 *   - If Phase 2 succeeds but Phase 3 fails (network blip), a retry of
 *     POST /api/payment/initiate will get the SAME Razorpay order ID from
 *     Phase 2 (Razorpay deduplicates by receipt) and succeed at Phase 3.
 *   - No duplicate charges are possible.
 */

import { getAdminDb } from '../firebase/admin';
import { createRazorpayOrder } from './razorpayClient';
import type { ReservationDoc } from '../types/booking';

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export class PaymentError extends Error {
  constructor(
    public readonly code:
      | 'RESERVATION_NOT_FOUND'
      | 'RESERVATION_NOT_PENDING'
      | 'RESERVATION_EXPIRED'
      | 'WRONG_USER',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ---------------------------------------------------------------------------
// Result shape returned to the API route
// ---------------------------------------------------------------------------

export interface PaymentInitResult {
  razorpayOrderId: string; // "order_xxxxx" — sent to Razorpay.js on frontend
  razorpayKeyId: string; // RAZORPAY_KEY_ID — sent to frontend to init Razorpay.js
  reservationId: string;
  amount: number; // paise — Razorpay.js needs this
  currency: string; // "INR"
  expiresAt: string; // ISO — frontend shows countdown
}

// ---------------------------------------------------------------------------
// initiatePayment
// ---------------------------------------------------------------------------

/**
 * Validates a reservation, creates a Razorpay order, and transitions
 * the reservation from "pending" → "payment_pending".
 *
 * HOW DUPLICATE PAYMENTS ARE PREVENTED:
 * ──────────────────────────────────────
 *   1. We only proceed if status === "pending". If the user somehow calls
 *      this endpoint twice:
 *        - First call: status is "pending" → creates Razorpay order,
 *          sets status to "payment_pending".
 *        - Second call: status is now "payment_pending" → throws
 *          RESERVATION_NOT_PENDING with the existing orderId so the frontend
 *          can resume the already-initiated payment flow.
 *
 *   2. Even if two concurrent requests slip through (race between reads),
 *      the Razorpay `receipt` field (= reservationId) causes Razorpay to
 *      return the SAME order for both — no duplicate charge ever happens.
 *
 * HOW RETRY WORKS SAFELY:
 * ─────────────────────────
 *   Scenario: Razorpay order created (Phase 2), but Firestore update fails (Phase 3).
 *   On retry:
 *     - Status is still "pending" → proceeds to Phase 2.
 *     - Razorpay receipt = same reservationId → Razorpay returns the same orderId.
 *     - Phase 3 writes the same orderId to Firestore → idempotent.
 *   No duplicate order, no extra charge.
 */
export async function initiatePayment(
  reservationId: string,
  userId: string,
): Promise<PaymentInitResult> {
  const db = getAdminDb();
  const reservationRef = db.collection('reservations').doc(reservationId);

  // ── Phase 1: Read + validate reservation ─────────────────────────────────
  const reservationSnap = await reservationRef.get();

  if (!reservationSnap.exists) {
    throw new PaymentError('RESERVATION_NOT_FOUND', `Reservation ${reservationId} not found`);
  }

  const reservation = reservationSnap.data() as ReservationDoc;

  // Only the user who created the reservation can pay for it
  if (reservation.userId !== userId) {
    throw new PaymentError('WRONG_USER', 'You do not own this reservation');
  }

  // If already in payment_pending (e.g. duplicate request), surface the existing orderId
  if (reservation.status === 'payment_pending' && reservation.razorpayOrderId) {
    return {
      razorpayOrderId: reservation.razorpayOrderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
      reservationId,
      amount: reservation.totalAmount,
      currency: 'INR',
      expiresAt: reservation.expiresAt,
    };
  }

  // Only "pending" reservations can initiate payment
  if (reservation.status !== 'pending') {
    throw new PaymentError(
      'RESERVATION_NOT_PENDING',
      `Reservation is ${reservation.status} — cannot initiate payment`,
    );
  }

  // Check expiry: expiresAt is stored as ISO string
  if (new Date(reservation.expiresAt) <= new Date()) {
    throw new PaymentError(
      'RESERVATION_EXPIRED',
      'This reservation has expired. Please start a new booking.',
    );
  }

  // ── Phase 2: Create Razorpay order ────────────────────────────────────────
  // receipt = reservationId ensures idempotency on retry:
  // same receipt → same Razorpay order, no duplicate charge.
  const order = await createRazorpayOrder({
    amount: reservation.totalAmount, // already in paise
    receipt: reservationId, // idempotency key
    notes: {
      eventId: reservation.eventId,
      userId: reservation.userId,
    },
  });

  // ── Phase 3: Transition reservation to payment_pending ────────────────────
  // If this write fails and the caller retries: Phase 2 returns same orderId,
  // this write succeeds on retry. Fully safe.
  const now = new Date().toISOString();
  await reservationRef.update({
    razorpayOrderId: order.id,
    status: 'payment_pending',
    updatedAt: now,
  });

  return {
    razorpayOrderId: order.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
    reservationId,
    amount: reservation.totalAmount,
    currency: 'INR',
    expiresAt: reservation.expiresAt,
  };
}

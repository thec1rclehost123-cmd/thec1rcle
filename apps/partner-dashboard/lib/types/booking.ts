/**
 * Booking System — Firestore Schema Types
 *
 * Collections:
 *   events             → source of truth for seat availability
 *   reservations       → temporary seat hold before payment
 *   bookings           → permanent ticket purchase (webhook-created only)
 *   booking_audit_logs → immutable event trail for every state change
 *
 * Full reservation status lifecycle:
 *   pending         → seats held, no payment started
 *   payment_pending → Razorpay order created, user on checkout screen
 *   processing      → webhook received, confirmation in progress (~100–500ms)
 *   confirmed       → booking created (webhook ONLY, never client-side)
 *   expired         → scheduler released stale reservation after 15 min
 *   cancelled       → user or admin cancelled before payment
 *
 * All monetary values are in PAISE (1 INR = 100 paise).
 * All timestamps are ISO 8601 strings.
 */

// ---------------------------------------------------------------------------
// Collection: "events"
// ---------------------------------------------------------------------------

/**
 * Firestore path: events/{eventId}
 *
 * Indexes:
 *   status ASC, date ASC        (public listing)
 *   hostId ASC, status ASC      (host dashboard)
 *   venueId ASC, status ASC     (venue dashboard)
 *
 * availableSeats and soldCount are ONLY mutated inside Firestore transactions.
 */
export interface EventDoc {
  id: string;
  title: string;
  description: string;
  date: string; // "2026-04-15"
  startTime: string; // "20:00"
  endTime: string; // "23:00"
  city: string;
  hostId: string;
  venueId: string;
  venueName: string;

  // Ticketing — all in PAISE
  price: number;
  totalSeats: number; // set at creation, never changed
  availableSeats: number; // decremented by reservation transaction
  soldCount: number; // incremented by FieldValue.increment on confirmation

  status: 'draft' | 'published' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Collection: "reservations"
// ---------------------------------------------------------------------------

/**
 * Firestore path: reservations/{reservationId}
 *
 * Indexes:
 *   status (array-contains), expiresAt ASC   → expiry scheduler
 *   userId ASC, status ASC                   → user's active reservations
 *   razorpayOrderId ASC                      → webhook lookup
 *
 * razorpayOrderId is null at creation. Written when Razorpay order is created.
 */
export type ReservationStatus =
  | 'pending' // seats held, no payment started
  | 'payment_pending' // Razorpay order created, awaiting user payment
  | 'processing' // webhook received, writing booking (~100–500ms window)
  | 'confirmed' // booking confirmed by webhook
  | 'expired' // scheduler released seats after 15 min
  | 'cancelled'; // explicitly cancelled

export interface ReservationDoc {
  id: string; // Also used as Razorpay receipt for idempotency

  eventId: string;
  userId: string;
  quantity: number;

  // Financials — PAISE
  pricePerSeat: number;
  totalAmount: number;

  razorpayOrderId: string | null;

  status: ReservationStatus;
  expiresAt: string; // ISO — createdAt + 15 min
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Collection: "bookings"
// ---------------------------------------------------------------------------

/**
 * Firestore path: bookings/{bookingId}
 *
 * Created ONLY by POST /api/payment/webhook after HMAC verification.
 * Never created client-side.
 *
 * Indexes:
 *   userId ASC, createdAt DESC             → user booking history
 *   eventId ASC, status ASC               → event guest list / check-in
 *   razorpayPaymentId ASC                 → webhook idempotency lookup
 *
 * bookingRef is the user-facing reference (e.g. "CIR-7F3K2A").
 * qrToken is the opaque token encoded in the QR code at the event gate.
 */
export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'refunded';

export interface BookingDoc {
  id: string;

  bookingRef: string; // "CIR-XXXXXX" — human-readable, shown in UI and emails

  // Traceability
  reservationId: string;
  eventId: string;
  userId: string;

  // Ticket details
  quantity: number;
  pricePerSeat: number;
  totalAmount: number;

  // Payment proof
  razorpayOrderId: string;
  razorpayPaymentId: string;

  // Check-in
  qrToken: string;

  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Collection: "booking_audit_logs"
// ---------------------------------------------------------------------------

/**
 * Firestore path: booking_audit_logs/{logId}
 *
 * Append-only. Never updated after creation.
 * Used for debugging refunds, disputes, and user complaints.
 *
 * Indexes:
 *   eventId ASC, timestamp DESC      → per-event activity feed
 *   reservationId ASC, timestamp ASC → full lifecycle of a reservation
 */
export type AuditAction =
  | 'RESERVED' // Reservation created, seats held
  | 'PAYMENT_INITIATED' // Razorpay order created
  | 'PROCESSING' // Webhook received, confirmation starting
  | 'CONFIRMED' // Booking created successfully
  | 'EXPIRED' // Scheduler expired stale reservation
  | 'CANCELLED' // User/admin cancelled
  | 'EXPIRED_REFUND_NEEDED'; // Payment received for expired reservation

export interface BookingAuditLog {
  id: string;
  action: AuditAction;

  // Context
  eventId: string;
  reservationId: string;
  bookingId?: string; // set for CONFIRMED action
  userId: string;

  // Optional detail
  metadata?: Record<string, unknown>;

  timestamp: string; // ISO
}

// ---------------------------------------------------------------------------
// API request/response shapes
// ---------------------------------------------------------------------------

export interface CreateReservationBody {
  eventId: string;
  quantity: number;
}

export interface CreateReservationResponse {
  reservationId: string;
  eventId: string;
  quantity: number;
  totalAmount: number;
  expiresAt: string;
}

/**
 * Audit Log Store — append-only event trail for the booking system.
 *
 * Writes to the `booking_audit_logs` Firestore collection.
 * Never updates or deletes — every log entry is immutable.
 *
 * Used for:
 *   - Debugging refund disputes ("what happened to reservation X?")
 *   - User complaints ("I paid but have no booking")
 *   - Ops dashboards (event activity timeline)
 *
 * Failures are intentionally swallowed — audit log writes are non-critical.
 * A failed audit log should never block a booking or expiry operation.
 */

import { randomBytes } from 'node:crypto';
import { getAdminDb } from '../firebase/admin';
import { logger } from './logger';
import type { BookingAuditLog, AuditAction } from '../types/booking';

/**
 * Writes a single audit log entry.
 * Silently catches and logs any write failure — never throws.
 */
export async function writeAuditLog(
  action: AuditAction,
  params: {
    eventId: string;
    reservationId: string;
    userId: string;
    bookingId?: string;
    bookingRef?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db = getAdminDb();
    const logId = randomBytes(12).toString('hex');

    const entry: BookingAuditLog = {
      id: logId,
      action,
      eventId: params.eventId,
      reservationId: params.reservationId,
      userId: params.userId,
      bookingId: params.bookingId,
      metadata: params.metadata,
      timestamp: new Date().toISOString(),
    };

    // Remove undefined fields before writing (Firestore rejects them)
    if (!entry.bookingId) delete entry.bookingId;
    if (!entry.metadata) delete entry.metadata;

    await db.collection('booking_audit_logs').doc(logId).set(entry);
  } catch (err: any) {
    // Non-critical — log the failure but never propagate it
    logger.warn('auditLogStore', 'Failed to write audit log (non-critical)', {
      action,
      reservationId: params.reservationId,
      error: err.message,
    });
  }
}

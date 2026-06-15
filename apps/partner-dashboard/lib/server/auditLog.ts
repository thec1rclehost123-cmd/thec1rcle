import { getAdminDb } from '@/lib/firebase/admin';
import type { AuditLogEntry } from '@/lib/types/venue-foundation';

/**
 * Writes an audit log entry to audit_logs/{venueId}/entries/{autoId}.
 * Fire-and-forget — never throws, so a logging failure never blocks the response.
 */
export async function writeAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  try {
    const db = getAdminDb();
    const timestamp = new Date().toISOString();
    await db
      .collection('audit_logs')
      .doc(entry.venueId)
      .collection('entries')
      .add({ ...entry, timestamp });
  } catch (err) {
    console.error('[auditLog] Failed to write audit entry:', err);
  }
}

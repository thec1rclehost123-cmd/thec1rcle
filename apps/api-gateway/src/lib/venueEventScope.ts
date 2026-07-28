import type { Firestore } from 'firebase-admin/firestore';

/**
 * Resolve an event only when it belongs to the exact authenticated venue.
 * Returning null for both missing and cross-venue IDs prevents tenant
 * enumeration before finance or reconciliation services are called.
 */
export async function loadVenueScopedEvent(
  db: Firestore,
  eventId: string,
  venueId: string,
): Promise<{ id: string; data: Record<string, any> } | null> {
  if (!eventId || !venueId) return null;
  const snapshot = await db.collection('events').doc(eventId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, any>;
  if (String(data?.venueId || '') !== String(venueId)) return null;
  return { id: snapshot.id, data };
}

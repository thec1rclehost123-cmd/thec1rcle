/**
 * THE C1RCLE - Waitlist Engine
 * Handles over-capacity interest and automated notifications.
 */

import { createHash, randomUUID } from 'node:crypto';
import { getAdminDb } from './admin.js';

const WAITLIST_COLLECTION = 'waitlist';

/**
 * Adds a user to the waitlist for an event/tier
 */
export async function joinWaitlist({ eventId, tierId, userId, email, phone }) {
  const db = getAdminDb();

  // Verify the event is actually sold out
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) throw new Error('Event not found');
  const event = { id: eventSnap.id, ...eventSnap.data() };
  const tiers = event.ticketCatalog?.tiers || event.tickets || event.ticketTiers || event.tiers || [];
  if (tiers.length > 0) {
    const allSoldOut = tiers.every(t => (t.remaining ?? t.availableQuantity ?? -1) <= 0);
    if (!allSoldOut) throw new Error('Event is not sold out');
  }

  // Check for existing entry (backward compatible with legacy random-ID entries)
  const existing = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('email', '==', email)
    .where('status', '==', 'waiting')
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }

  // Use deterministic document ID based on email+eventId to prevent duplicate entries on race
  const idHash = createHash('sha256').update(`${email}_${eventId}`).digest('hex').slice(0, 16);
  const entryId = `wl_${idHash}`;

  const now = new Date().toISOString();
  const entry = {
    id: entryId,
    eventId,
    tierId: tierId || 'any',
    userId: userId || null,
    email,
    phone: phone || null,
    status: 'waiting',
    createdAt: now,
    expiresAt: null,
  };

  await db.collection(WAITLIST_COLLECTION).doc(entryId).set(entry);
  return entry;
}

/**
 * Processes the waitlist when inventory becomes available
 */
export async function processWaitlist(eventId, tierId) {
  const db = getAdminDb();

  // Find next person in line
  const snapshot = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('tierId', 'in', [tierId, 'any'])
    .where('status', '==', 'waiting')
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const nextUser = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min window

  const updates = {
    status: 'notified',
    notifiedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Mark any expired "notified" entries for cleanup

  await db.collection(WAITLIST_COLLECTION).doc(nextUser.id).update(updates);

  return { ...nextUser, ...updates };
}

/**
 * Verifies if a user has waitlist priority to purchase
 */
export async function verifyWaitlistAccess(eventId, email) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('email', '==', email)
    .where('status', '==', 'notified')
    .get();

  if (snapshot.empty) return { valid: false };

  const entry = snapshot.docs[0].data();
  const isExpired = new Date(entry.expiresAt) < new Date();

  return {
    valid: !isExpired,
    entry: { id: snapshot.docs[0].id, ...entry },
  };
}

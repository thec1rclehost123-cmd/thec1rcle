/**
 * THE C1RCLE - Waitlist Engine
 * Handles over-capacity interest and automated notifications.
 */

import { randomUUID } from 'node:crypto';
import { getAdminDb } from './admin.js';

const WAITLIST_COLLECTION = 'waitlist';

/**
 * Adds a user to the waitlist for an event/tier
 */
export async function joinWaitlist({ eventId, tierId, userId, email, phone }) {
  const db = getAdminDb();

  // Check for existing active entry
  const existing = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('email', '==', email)
    .where('status', '==', 'waiting')
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }

  const entry = {
    id: `wl_${randomUUID().substring(0, 8)}`,
    eventId,
    tierId: tierId || 'any',
    userId: userId || null,
    email,
    phone: phone || null,
    status: 'waiting', // 'waiting', 'notified', 'purchased', 'expired'
    createdAt: new Date().toISOString(),
  };

  await db.collection(WAITLIST_COLLECTION).doc(entry.id).set(entry);
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

import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { trackEventView } from './analytics-service.js';
import * as surgeCore from './surge.js';

const EVENT_COLLECTION = 'events';
const USER_COLLECTION = 'users';
const LIKES_COLLECTION = 'likes';
const WAITLIST_COLLECTION = 'waitlist';
const LOYALTY_LOOKBACK_DAYS = 120;

export function normalizeInterestedUserGender(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return 'other';
  if (
    ['female', 'woman', 'women', 'girl', 'girls', 'f', 'cis female', 'cis woman'].includes(
      normalized,
    )
  )
    return 'female';
  if (['male', 'man', 'men', 'boy', 'boys', 'm', 'cis male', 'cis man'].includes(normalized))
    return 'male';
  return 'other';
}

function serialize(value) {
  if (value == null) return value;
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === 'object' && typeof item.toDate === 'function') {
        return item.toDate().toISOString();
      }
      return item;
    }),
  );
}

function takeInterestedUsers(bucket, count, usedIds) {
  if (!Array.isArray(bucket) || count <= 0) return [];
  const selected = [];
  for (const user of bucket) {
    if (!user?.id || usedIds.has(user.id)) continue;
    selected.push(user);
    usedIds.add(user.id);
    if (selected.length >= count) break;
  }
  return selected;
}

export function selectInterestedUsersForDisplay(users = [], limit = 20) {
  const safeLimit = Math.max(Number(limit) || 0, 0);
  if (safeLimit === 0 || !Array.isArray(users) || users.length === 0) return [];

  const femaleUsers = [];
  const maleUsers = [];
  const otherUsers = [];

  for (const user of users) {
    const bucket = normalizeInterestedUserGender(user?.gender);
    if (bucket === 'female') femaleUsers.push(user);
    else if (bucket === 'male') maleUsers.push(user);
    else otherUsers.push(user);
  }

  const usedIds = new Set();
  const selected = [];
  const preferredFemaleCount = Math.min(Math.round(safeLimit * 0.7), femaleUsers.length);
  const preferredMaleCount = Math.min(safeLimit - preferredFemaleCount, maleUsers.length);

  selected.push(...takeInterestedUsers(femaleUsers, preferredFemaleCount, usedIds));
  selected.push(...takeInterestedUsers(maleUsers, preferredMaleCount, usedIds));

  for (const pool of [femaleUsers, maleUsers, otherUsers]) {
    if (selected.length >= safeLimit) break;
    selected.push(...takeInterestedUsers(pool, safeLimit - selected.length, usedIds));
  }

  return selected.slice(0, safeLimit);
}

export async function getEventInterested(db, eventId, limit = 20) {
  if (!eventId) return { count: 0, users: [] };

  const eventDoc = await db.collection(EVENT_COLLECTION).doc(eventId).get();
  const eventData = eventDoc.exists ? eventDoc.data() : {};
  const count = eventData?.stats?.saves || 0;
  const fetchLimit = Math.max(Number(limit) * 5, 60);

  const likesSnapshot = await db
    .collection(LIKES_COLLECTION)
    .where('eventId', '==', eventId)
    .orderBy('createdAt', 'desc')
    .limit(fetchLimit)
    .get();

  const userIds = Array.from(
    new Set(likesSnapshot.docs.map((doc) => doc.data().userId).filter(Boolean)),
  );
  if (userIds.length === 0) return { count, users: [] };

  const userDocs = await Promise.all(
    userIds.map((uid) => db.collection(USER_COLLECTION).doc(uid).get()),
  );
  const users = userDocs
    .filter((doc) => doc.exists)
    .map((doc) => {
      const data = doc.data() || {};
      const displayName = data.displayName || 'C1RCLE Member';
      return {
        id: doc.id,
        name: displayName,
        handle: data.handle || `@${displayName.toLowerCase().replace(/\s/g, '')}`,
        photoURL: data.photoURL || null,
        initials: displayName
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        gender: normalizeInterestedUserGender(data.gender),
      };
    });

  return serialize({ count, users: selectInterestedUsersForDisplay(users, limit) });
}

export async function toggleEventRsvp(db, { eventId, userId, shouldInclude }) {
  if (!eventId) throw new Error('Event ID is required');
  if (!userId) throw new Error('Authentication required');

  const userRef = db.collection(USER_COLLECTION).doc(userId);
  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const likeRef = db.collection(LIKES_COLLECTION).doc(`${userId}_${eventId}`);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const [userDoc, eventDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(eventRef),
    ]);

    if (!userDoc.exists) throw new Error('User profile not found');
    if (!eventDoc.exists) throw new Error('Event not found');

    const userData = userDoc.data() || {};
    const attendedEvents = Array.isArray(userData.attendedEvents) ? userData.attendedEvents : [];
    const alreadyIncluded = attendedEvents.includes(eventId);
    const nextIncluded = Boolean(shouldInclude);

    if (nextIncluded === alreadyIncluded) return;

    const nextAttendedEvents = nextIncluded
      ? [...attendedEvents, eventId]
      : attendedEvents.filter((id) => id !== eventId);

    transaction.update(userRef, {
      attendedEvents: nextAttendedEvents,
      updatedAt: now,
    });

    transaction.update(eventRef, {
      'stats.saves': FieldValue.increment(nextIncluded ? 1 : -1),
      updatedAt: now,
    });

    if (nextIncluded) {
      transaction.set(likeRef, { userId, eventId, createdAt: now });
    } else {
      transaction.delete(likeRef);
    }
  });

  return { success: true };
}

export async function trackGuestEventView(db, { eventId, viewerId }) {
  if (!eventId || !viewerId) return { ok: true };

  try {
    const isNewSession = await trackEventView(eventId, viewerId);
    if (isNewSession) {
      await db
        .collection(EVENT_COLLECTION)
        .doc(eventId)
        .set(
          {
            stats: { views: FieldValue.increment(1) },
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    }
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

export async function trackGuestEventInteraction(db, { eventId, type, ref }) {
  if (!eventId) return { ok: true };

  try {
    if (type === 'impression') {
      await db
        .collection(EVENT_COLLECTION)
        .doc(eventId)
        .update({
          'stats.impressions': FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        });
    }

    if (ref) {
      await db
        .collection('event_conversion_events')
        .add({
          eventId,
          type: type || 'interaction',
          ref,
          source: 'guest-portal',
          createdAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

async function buildQueueTrustScore(db, userId) {
  if (!userId || userId === 'anonymous') {
    return { tier: surgeCore.QUEUE_TIERS.ANONYMOUS, score: 0 };
  }

  let tier = surgeCore.QUEUE_TIERS.AUTHENTICATED;
  let score = 0;

  try {
    const now = new Date();
    const lookbackDate = new Date(now.getTime() - LOYALTY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const ordersSnapshot = await db
      .collection('orders')
      .where('userId', '==', userId)
      .where('createdAt', '>=', lookbackDate.toISOString())
      .get();

    let attendedCount = 0;
    let refundCount = 0;
    let noShowCount = 0;

    ordersSnapshot.docs.forEach((doc) => {
      const order = doc.data() || {};
      if (order.status === 'confirmed') {
        if (order.checkedIn || order.tickets?.some((ticket) => ticket.status === 'checked_in')) {
          attendedCount += 1;
        } else {
          const eventDate = new Date(order.eventDate);
          if (eventDate < now) noShowCount += 1;
        }
      } else if (order.status === 'refunded') {
        refundCount += 1;
      }
    });

    score = attendedCount * 100 - refundCount * 50 - noShowCount * 30;
    if (attendedCount >= 2 && score > 0) tier = surgeCore.QUEUE_TIERS.LOYAL;

    const userDoc = await db.collection(USER_COLLECTION).doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    if (userData.emailVerified) score += 50;
    if (userData.createdAt) {
      const createdAt = userData.createdAt?.toDate
        ? userData.createdAt.toDate()
        : new Date(userData.createdAt);
      const accountAgeHours = (now - createdAt) / (1000 * 60 * 60);
      if (accountAgeHours < 24) score = Math.floor(score * 0.5);
    }
  } catch {
    return { tier, score: 0 };
  }

  return { tier, score };
}

export async function getEventSurgeStatus(db, eventId) {
  return surgeCore.getSurgeStatus(db, eventId);
}

export async function joinEventQueue(db, { eventId, userId = 'anonymous', deviceId = 'default' }) {
  await surgeCore.recordSurgeMetric(db, eventId, 'queue_join').catch(() => false);
  const trust = await buildQueueTrustScore(db, userId);
  return surgeCore.joinQueue(db, eventId, userId, deviceId, trust);
}

export async function getEventQueueStatus(db, queueId) {
  return surgeCore.getQueueStatus(db, queueId);
}

export async function joinEventWaitlist(db, { eventId, ticketId, tierId, userId, email, phone }) {
  if (!eventId || !email) throw new Error('Event ID and Email are required');

  const normalizedTierId = tierId || ticketId || 'any';
  const existingSnapshot = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('email', '==', email)
    .where('status', '==', 'waiting')
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    return serialize({ id: existingSnapshot.docs[0].id, ...existingSnapshot.docs[0].data() });
  }

  const id = `wl_${randomUUID().substring(0, 8)}`;
  const entry = {
    id,
    eventId,
    ticketId: normalizedTierId,
    tierId: normalizedTierId,
    userId: userId || null,
    email,
    phone: phone || null,
    status: 'waiting',
    createdAt: new Date().toISOString(),
    notifiedAt: null,
  };

  await db.collection(WAITLIST_COLLECTION).doc(id).set(entry);
  return entry;
}

export async function verifyEventWaitlistAccess(db, { eventId, email }) {
  if (!eventId || !email) throw new Error('Event ID and Email are required');

  const snapshot = await db
    .collection(WAITLIST_COLLECTION)
    .where('eventId', '==', eventId)
    .where('email', '==', email)
    .where('status', '==', 'notified')
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const entry = snapshot.docs[0].data();
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return null;
  return serialize({ id: snapshot.docs[0].id, ...entry });
}

import { getAdminDb, isFirebaseConfigured } from './admin.js';
import { createHash } from 'node:crypto';

const EVENT_COLLECTION = 'events';
const EVENT_CARD_INDEX_COLLECTION = 'event_card_index';
const RECOMMENDATION_PROFILE_COLLECTION = 'recommendation_profiles';
const CANDIDATE_CACHE_TTL_MS = 60_000;
const PERSONALIZATION_DEADLINE_MS = 1_800;
const candidateCache = new WeakMap();
const candidateRequests = new WeakMap();

function calculateMatchScore(
  event,
  { preferredTags, preferredCities, preferredHosts, pastEventIds },
) {
  let score = 0;
  const eventTags = [...(event.tags || []), event.category]
    .filter(Boolean)
    .map((tag) => String(tag).toLowerCase());
  score += eventTags.filter((tag) => preferredTags.has(tag)).length * 5;
  if (preferredHosts.has(event.host)) score += 15;
  if (preferredCities.has(event.city)) score += 10;
  score += (event.heatScore || 0) * 0.1;
  if (pastEventIds.has(event.id)) score -= 100;
  return score;
}

function resolveDb(db) {
  if (db) return db;
  return isFirebaseConfigured() ? getAdminDb() : null;
}

async function listCandidateEvents(limit = 100, dbOverride = null) {
  const db = resolveDb(dbOverride);
  if (!db) return [];
  const cached = candidateCache.get(db);
  if (cached && cached.expiresAt > Date.now() && cached.items.length >= Math.min(limit, 100)) {
    return cached.items.slice(0, limit);
  }
  const inFlight = candidateRequests.get(db);
  if (inFlight) return (await inFlight).slice(0, limit);

  const request = db
    .collection(EVENT_CARD_INDEX_COLLECTION)
    .where('visibility', '==', 'public')
    .where('startAt', '>=', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .orderBy('startAt', 'asc')
    .limit(100)
    .get()
    .then((snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      candidateCache.set(db, { items, expiresAt: Date.now() + CANDIDATE_CACHE_TTL_MS });
      return items;
    })
    .finally(() => {
      candidateRequests.delete(db);
    });
  candidateRequests.set(db, request);
  return (await request).slice(0, limit);
}

async function getUserOrderHistory(userId, limit = 50, dbOverride = null) {
  const db = resolveDb(dbOverride);
  if (!userId || !db) return [];
  const [ordersSnap, rsvpsSnap] = await Promise.all([
    db.collection('orders').where('userId', '==', userId).limit(limit).get(),
    db.collection('rsvp_orders').where('userId', '==', userId).limit(limit).get(),
  ]);
  return [
    ...ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    ...rsvpsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  ];
}

async function buildUserProfile(userId, dbOverride = null) {
  const db = resolveDb(dbOverride);
  const [orders, signalSnapshot] = await Promise.all([
    getUserOrderHistory(userId, 50, db),
    db
      ? db
          .collection(RECOMMENDATION_PROFILE_COLLECTION)
          .doc(userId)
          .collection('categories')
          .orderBy('lastBrowsedAt', 'desc')
          .limit(20)
          .get()
      : Promise.resolve(null),
  ]);
  const preferredTags = new Set();
  const preferredCities = new Set();
  const preferredHosts = new Set();
  const pastEventIds = new Set();

  if (orders.length > 0) {
    const eventIds = [...new Set(orders.map((o) => o.eventId).filter(Boolean))];
    if (eventIds.length > 0 && db) {
      const chunks = [];
      for (let i = 0; i < eventIds.length; i += 10) chunks.push(eventIds.slice(i, i + 10));
      const eventDocs = (
        await Promise.all(
          chunks.map((chunk) =>
            db.collection(EVENT_COLLECTION).where('__name__', 'in', chunk).get(),
          ),
        )
      ).flatMap((snap) => snap.docs);

      eventDocs.forEach((doc) => {
        const event = doc.data();
        pastEventIds.add(doc.id);
        (event.tags || []).forEach((t) => preferredTags.add(t.toLowerCase()));
        if (event.city) preferredCities.add(event.city);
        if (event.host) preferredHosts.add(event.host);
      });
    }
  }

  if (signalSnapshot) {
    signalSnapshot.docs.forEach((doc) => {
      const category = String(doc.data()?.category || '')
        .trim()
        .toLowerCase();
      if (category) preferredTags.add(category);
    });
  }

  return { preferredTags, preferredCities, preferredHosts, pastEventIds };
}

async function buildUserProfileWithinDeadline(userId, dbOverride = null) {
  let timeout;
  try {
    return await Promise.race([
      buildUserProfile(userId, dbOverride),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), PERSONALIZATION_DEADLINE_MS);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function warmRecommendationCandidates(dbOverride = null) {
  return listCandidateEvents(100, dbOverride);
}

export async function getRecommendedEvents(userId, limit = 5, dbOverride = null) {
  if (!userId) {
    const candidates = await listCandidateEvents(100, dbOverride);
    return candidates.sort((a, b) => (b.heatScore || 0) - (a.heatScore || 0)).slice(0, limit);
  }

  const [candidates, userProfile] = await Promise.all([
    listCandidateEvents(100, dbOverride),
    buildUserProfileWithinDeadline(userId, dbOverride),
  ]);
  if (!userProfile) {
    return candidates.sort((a, b) => (b.heatScore || 0) - (a.heatScore || 0)).slice(0, limit);
  }
  return candidates
    .filter((e) => e.status !== 'past')
    .map((event) => ({ event, score: calculateMatchScore(event, userProfile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.event);
}

export async function getSimilarEvents(eventId, limit = 3, dbOverride = null) {
  const candidates = await listCandidateEvents(100, dbOverride);
  const sourceEvent = candidates.find((e) => e.id === eventId);
  if (!sourceEvent) return [];

  const sourceTags = new Set((sourceEvent.tags || []).map((t) => t.toLowerCase()));

  return candidates
    .filter((e) => e.id !== eventId && e.status !== 'past')
    .map((event) => {
      let score = 0;
      const overlap = (event.tags || [])
        .map((t) => t.toLowerCase())
        .filter((t) => sourceTags.has(t)).length;
      score += overlap * 10;
      if (event.category === sourceEvent.category) score += 5;
      if (event.host === sourceEvent.host) score += 8;
      if (event.city === sourceEvent.city) score += 3;
      return { event, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.event);
}

export async function recordRecommendationSignal(db, { userId, type, category, requestId = null }) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedUserId = String(userId || '').trim();
  const normalizedType = String(type || '').trim();
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase();
  if (!normalizedUserId) throw new Error('Authentication required');
  if (normalizedType !== 'category_browse') throw new Error('Unsupported recommendation signal');
  if (!normalizedCategory) throw new Error('Category is required');

  const categoryId = createHash('sha256')
    .update(`recommendation-category:v1:${normalizedCategory}`)
    .digest('hex')
    .slice(0, 40);
  const profileRef = db.collection(RECOMMENDATION_PROFILE_COLLECTION).doc(normalizedUserId);
  const categoryRef = profileRef.collection('categories').doc(categoryId);

  return db.runTransaction(async (transaction) => {
    const [profileDoc, categoryDoc] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(categoryRef),
    ]);
    const now = new Date().toISOString();
    const priorCategory = categoryDoc.data() || {};
    const nextCount = Math.max(0, Number(priorCategory.browseCount) || 0) + 1;
    const nextVersion = Math.max(0, Number(profileDoc.data()?.version) || 0) + 1;

    transaction.set(
      categoryRef,
      {
        category: normalizedCategory,
        browseCount: nextCount,
        firstBrowsedAt: priorCategory.firstBrowsedAt || now,
        lastBrowsedAt: now,
        lastRequestId: requestId,
      },
      { merge: true },
    );
    transaction.set(
      profileRef,
      {
        userId: normalizedUserId,
        version: nextVersion,
        updatedAt: now,
      },
      { merge: true },
    );

    return {
      accepted: true,
      type: normalizedType,
      category: normalizedCategory,
      profileVersion: nextVersion,
    };
  });
}

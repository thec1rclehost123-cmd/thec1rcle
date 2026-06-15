import { getAdminDb, isFirebaseConfigured } from './admin.js';

const EVENT_COLLECTION = 'events';
const PUBLIC_LIFECYCLE_STATES_LOCAL = ['scheduled', 'live'];

function calculateMatchScore(
  event,
  { preferredTags, preferredCities, preferredHosts, pastEventIds },
) {
  let score = 0;
  const eventTags = (event.tags || []).map((t) => t.toLowerCase());
  score += eventTags.filter((tag) => preferredTags.has(tag)).length * 5;
  if (preferredHosts.has(event.host)) score += 15;
  if (preferredCities.has(event.city)) score += 10;
  score += (event.heatScore || 0) * 0.1;
  if (pastEventIds.has(event.id)) score -= 100;
  return score;
}

async function listCandidateEvents(limit = 100) {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const snapshot = await db
    .collection(EVENT_COLLECTION)
    .where('lifecycle', 'in', PUBLIC_LIFECYCLE_STATES_LOCAL)
    .where('isDeleted', '==', false)
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getUserOrderHistory(userId, limit = 50) {
  if (!userId || !isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const [ordersSnap, rsvpsSnap] = await Promise.all([
    db.collection('orders').where('userId', '==', userId).limit(limit).get(),
    db.collection('rsvp_orders').where('userId', '==', userId).limit(limit).get(),
  ]);
  return [
    ...ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    ...rsvpsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  ];
}

async function buildUserProfile(userId) {
  const orders = await getUserOrderHistory(userId, 50);
  const preferredTags = new Set();
  const preferredCities = new Set();
  const preferredHosts = new Set();
  const pastEventIds = new Set();

  if (orders.length > 0) {
    const eventIds = [...new Set(orders.map((o) => o.eventId).filter(Boolean))];
    if (eventIds.length > 0 && isFirebaseConfigured()) {
      const db = getAdminDb();
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

  return { preferredTags, preferredCities, preferredHosts, pastEventIds };
}

export async function getRecommendedEvents(userId, limit = 5) {
  const candidates = await listCandidateEvents(100);
  if (!userId) {
    return candidates.sort((a, b) => (b.heatScore || 0) - (a.heatScore || 0)).slice(0, limit);
  }

  const userProfile = await buildUserProfile(userId);
  return candidates
    .filter((e) => e.status !== 'past')
    .map((event) => ({ event, score: calculateMatchScore(event, userProfile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.event);
}

export async function getSimilarEvents(eventId, limit = 3) {
  const candidates = await listCandidateEvents(100);
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

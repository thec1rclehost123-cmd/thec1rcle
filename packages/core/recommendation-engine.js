import { getAdminDb, isFirebaseConfigured } from './admin.js';

const EVENT_COLLECTION = 'events';
const PUBLIC_LIFECYCLE_STATES_LOCAL = ['scheduled', 'live'];
const RECOMMENDATION_MODEL_VERSION = 'explore-v2';

function normalized(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function eventSignals(event) {
  return new Set(
    [...(Array.isArray(event.tags) ? event.tags : []), event.category, event.eventType, event.genre]
      .filter(Boolean)
      .map(normalized),
  );
}

function intentScore(event, intents) {
  const signals = eventSignals(event);
  let score = 0;
  if (
    intents.has('friends') &&
    ['social', 'group', 'party', 'club'].some((tag) => signals.has(tag))
  )
    score += 4;
  if (
    intents.has('meet_people') &&
    ['social', 'networking', 'singles'].some((tag) => signals.has(tag))
  )
    score += 4;
  if (intents.has('host_promote') && (event.hostId || event.host || event.promoterId)) score += 2;
  if (intents.has('discover')) score += 1;
  return score;
}

function calculateMatch(
  event,
  {
    preferredTags,
    preferredCities,
    preferredHosts,
    preferredVenueIds = new Set(),
    pastEventIds,
    savedEventIds = new Set(),
    onboardingTags,
    intents,
  },
) {
  let score = 0;
  const eventTags = [...eventSignals(event)];
  const historyMatches = eventTags.filter((tag) => preferredTags.has(tag)).length;
  const onboardingMatches = eventTags.filter((tag) => onboardingTags.has(tag)).length;
  const cityMatch = preferredCities.has(normalized(event.city));
  const matchedIntentScore = intentScore(event, intents);
  score += historyMatches * 5;
  score += onboardingMatches * 12;
  if (preferredHosts.has(event.host)) score += 15;
  if (preferredVenueIds.has(event.venueId)) score += 14;
  if (savedEventIds.has(event.id)) score += 8;
  if (cityMatch) score += 18;
  score += matchedIntentScore;
  score += (event.heatScore || 0) * 0.1;
  const startAt = new Date(event.startDate || event.startsAt || event.date || 0).getTime();
  const daysUntil = Number.isFinite(startAt) ? (startAt - Date.now()) / 86_400_000 : Infinity;
  if (daysUntil >= 0 && daysUntil <= 14) score += 5;
  else if (daysUntil > 14 && daysUntil <= 30) score += 2;
  const signalCount = eventSignals(event).size;
  if (!event.title || !event.city || signalCount === 0) score -= 6;
  if (pastEventIds.has(event.id)) score -= 100;

  let reasonCode = 'TRENDING';
  let reasonLabel = 'Trending now';
  if (onboardingMatches > 0 && cityMatch) {
    reasonCode = 'VIBE_AND_CITY_MATCH';
    reasonLabel = `Because it matches your tastes in ${event.city}`;
  } else if (onboardingMatches > 0) {
    reasonCode = 'VIBE_MATCH';
    reasonLabel = 'Because it matches your nightlife tastes';
  } else if (cityMatch) {
    reasonCode = 'CITY_MATCH';
    reasonLabel = `Popular in ${event.city}`;
  } else if (matchedIntentScore > 0) {
    reasonCode = 'INTENT_MATCH';
    reasonLabel = 'Matched to what brings you to THE C1RCLE';
  } else if (preferredVenueIds.has(event.venueId)) {
    reasonCode = 'VENUE_MATCH';
    reasonLabel = 'From a venue you follow';
  } else if (historyMatches > 0 || preferredHosts.has(event.host)) {
    reasonCode = 'HISTORY_MATCH';
    reasonLabel = 'Based on events you like';
  }

  return { score, reasonCode, reasonLabel };
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
  const db = isFirebaseConfigured() ? getAdminDb() : null;
  const [orders, userDoc] = await Promise.all([
    getUserOrderHistory(userId, 50),
    db ? db.collection('users').doc(userId).get() : Promise.resolve(null),
  ]);
  const userData = userDoc?.exists ? userDoc.data() || {} : {};
  const discoveryProfile = userData.discoveryProfile || {};
  const behaviorSignals = discoveryProfile.behaviorSignals || {};
  const preferredTags = new Set();
  const preferredCities = new Set();
  const preferredHosts = new Set();
  const preferredVenueIds = new Set(
    (behaviorSignals.followedVenueIds || userData.followedVenueIds || []).map(String),
  );
  const pastEventIds = new Set();
  const savedEventIds = new Set(
    (behaviorSignals.savedEventIds || userData.savedEventIds || []).map(String),
  );
  const onboardingTags = new Set(
    (discoveryProfile.vibeTags || userData.vibeTags || []).map(normalized),
  );
  const intents = new Set((discoveryProfile.intents || userData.intents || []).map(normalized));
  (behaviorSignals.browsedCategories || []).forEach((category) => preferredTags.add(normalized(category)));
  const city = discoveryProfile.cityName || userData.city;
  if (city) preferredCities.add(normalized(city));

  const extractEventIds = (values) =>
    (Array.isArray(values) ? values : [])
      .map((value) => (typeof value === 'string' ? value : value?.eventId || value?.id))
      .filter(Boolean)
      .map(String);
  const historicalEventIds = orders.map((order) => order.eventId).filter(Boolean).map(String);
  const interestEventIds = [
    ...extractEventIds(userData.interestedEventIds),
    ...extractEventIds(userData.interestedEvents),
    ...extractEventIds(userData.attendedEvents),
    ...extractEventIds(behaviorSignals.viewedEventIds),
    ...extractEventIds(behaviorSignals.savedEventIds),
  ];

  if (historicalEventIds.length > 0 || interestEventIds.length > 0) {
    const eventIds = [...new Set([...historicalEventIds, ...interestEventIds])];
    historicalEventIds.forEach((eventId) => pastEventIds.add(eventId));
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
        (event.tags || []).forEach((tag) => preferredTags.add(normalized(tag)));
        if (event.category) preferredTags.add(normalized(event.category));
        if (event.city) preferredCities.add(normalized(event.city));
        if (event.host) preferredHosts.add(event.host);
        if (event.venueId) preferredVenueIds.add(event.venueId);
      });
    }
  }

  return {
    preferredTags,
    preferredCities,
    preferredHosts,
    preferredVenueIds,
    pastEventIds,
    savedEventIds,
    onboardingTags,
    intents,
    profileVersion: Number(discoveryProfile.profileVersion || 1),
    cityId: discoveryProfile.cityId || userData.cityId || null,
  };
}

export async function getRecommendationCacheContext(userId) {
  const profile = await buildUserProfile(userId);
  return {
    modelVersion: RECOMMENDATION_MODEL_VERSION,
    profileVersion: profile.profileVersion,
    cityId: profile.cityId,
  };
}

export function rankEventsForProfile(candidates, userProfile, limit = 5) {
  return candidates
    .filter((event) => event.status !== 'past')
    .map((event) => ({ event, ...calculateMatch(event, userProfile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getRecommendedEventsV2(userId, limit = 5) {
  const candidates = await listCandidateEvents(100);
  const userProfile = await buildUserProfile(userId);
  const ranked = rankEventsForProfile(candidates, userProfile, limit);
  const personalized =
    userProfile.onboardingTags.size > 0 ||
    userProfile.preferredCities.size > 0 ||
    userProfile.intents.size > 0 ||
    userProfile.preferredTags.size > 0 ||
    userProfile.preferredVenueIds.size > 0 ||
    userProfile.savedEventIds.size > 0;

  return {
    modelVersion: RECOMMENDATION_MODEL_VERSION,
    profileVersion: userProfile.profileVersion,
    items: ranked,
    fallbackUsed: !personalized,
  };
}

export async function getRecommendedEvents(userId, limit = 5) {
  if (!userId) {
    const candidates = await listCandidateEvents(100);
    return candidates.sort((a, b) => (b.heatScore || 0) - (a.heatScore || 0)).slice(0, limit);
  }

  const response = await getRecommendedEventsV2(userId, limit);
  return response.items.map((item) => item.event);
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

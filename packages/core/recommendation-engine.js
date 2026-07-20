import { getAdminDb, isFirebaseConfigured } from './admin.js';

const EVENT_COLLECTION = 'events';
const PUBLIC_LIFECYCLE_STATES_LOCAL = ['scheduled', 'live'];
const RECOMMENDATION_MODEL_VERSION = 'explore-v2';
const DAY_MS = 24 * 60 * 60 * 1000;
const TASTE_ALIASES = {
  clubs: ['club', 'clubbing', 'nightclub', 'party'],
  live_music: ['live_music', 'concert', 'gig', 'music'],
  lounges: ['lounge', 'cocktail', 'bar'],
  festivals: ['festival', 'fest'],
  college_nights: ['college', 'student', 'campus'],
  underground: ['underground', 'warehouse', 'techno', 'house'],
  food_culture: ['food', 'brunch', 'dining', 'culinary'],
  premium: ['premium', 'vip', 'exclusive', 'luxury'],
};
const TASTE_LABELS = {
  clubs: 'club nights',
  live_music: 'live music',
  lounges: 'lounges',
  festivals: 'festivals',
  college_nights: 'college nights',
  underground: 'underground nights',
  food_culture: 'food and culture',
  premium: 'premium experiences',
};

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

function eventCitySignals(event) {
  const values = [event.city, event.cityName, event.cityKey, event.location]
    .filter(Boolean)
    .map(normalized);
  const aliases = new Set(values);
  for (const value of values) {
    aliases.add(value.replace(/_in$/, ''));
    aliases.add(value.split('_')[0]);
  }
  return aliases;
}

function matchingOnboardingTaste(signals, onboardingTags) {
  for (const taste of onboardingTags) {
    const aliases = TASTE_ALIASES[taste] || [taste];
    if (aliases.some((alias) => signals.has(alias))) return taste;
  }
  return null;
}

function eventStartTime(event) {
  const value = event.startDate || event.startsAt || event.startTime || event.date;
  const timestamp = value?.toDate?.()?.getTime?.() ?? new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function eventCreatedTime(event) {
  const value = event.createdAt || event.publishedAt;
  const timestamp = value?.toDate?.()?.getTime?.() ?? new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function timeRelevanceScore(event, now) {
  const start = eventStartTime(event);
  if (!start) return 0;
  const daysUntil = (start - now) / DAY_MS;
  if (daysUntil < 0) return -100;
  if (daysUntil <= 3) return 7;
  if (daysUntil <= 7) return 5;
  if (daysUntil <= 30) return 2;
  return 0;
}

function dataQualityPenalty(event) {
  let penalty = 0;
  if (!event.title) penalty += 8;
  if (!event.city && !event.cityName && !event.cityKey && !event.location) penalty += 5;
  if (!eventStartTime(event)) penalty += 4;
  if (!event.poster && !event.image && !event.coverImage && !event.coverPhoto) penalty += 2;
  return penalty;
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
  { preferredTags, preferredCities, preferredHosts, pastEventIds, onboardingTags, intents },
  now = Date.now(),
) {
  let score = 0;
  const signals = eventSignals(event);
  const eventTags = [...signals];
  const historyMatches = eventTags.filter((tag) => preferredTags.has(tag)).length;
  const matchedTaste = matchingOnboardingTaste(signals, onboardingTags);
  const onboardingMatches = matchedTaste ? 1 : 0;
  const citySignals = eventCitySignals(event);
  const cityMatch = [...preferredCities].some((city) => citySignals.has(city));
  const matchedIntentScore = intentScore(event, intents);
  const eventCityLabel = event.city || event.cityName || event.location || 'your city';
  score += historyMatches * 5;
  score += onboardingMatches * 12;
  if (preferredHosts.has(event.host)) score += 15;
  if (cityMatch) score += 18;
  score += matchedIntentScore;
  score += Math.min(Number(event.heatScore || event.stats?.heat || 0) * 0.1, 10);
  score += Math.min(Number(event.stats?.saves || event.saves || 0) * 0.05, 4);
  score += timeRelevanceScore(event, now);
  const createdAt = eventCreatedTime(event);
  if (createdAt && now - createdAt <= 14 * DAY_MS) score += 3;
  score -= dataQualityPenalty(event);
  if (pastEventIds.has(event.id)) score -= 100;

  let reasonCode = 'TRENDING';
  let reasonLabel = 'Trending now';
  if (onboardingMatches > 0 && cityMatch) {
    reasonCode = 'VIBE_AND_CITY_MATCH';
    reasonLabel = `Because you chose ${TASTE_LABELS[matchedTaste] || matchedTaste} — in ${eventCityLabel}`;
  } else if (onboardingMatches > 0) {
    reasonCode = 'VIBE_MATCH';
    reasonLabel = `Because you chose ${TASTE_LABELS[matchedTaste] || matchedTaste}`;
  } else if (cityMatch) {
    reasonCode = 'CITY_MATCH';
    reasonLabel = `Popular in ${eventCityLabel}`;
  } else if (matchedIntentScore > 0) {
    reasonCode = 'INTENT_MATCH';
    reasonLabel = 'Matched to what brings you to THE C1RCLE';
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
  const preferredTags = new Set();
  const preferredCities = new Set();
  const preferredHosts = new Set();
  const pastEventIds = new Set();
  const onboardingTags = new Set(
    (discoveryProfile.vibeTags || userData.vibeTags || []).map(normalized),
  );
  const intents = new Set((discoveryProfile.intents || userData.intents || []).map(normalized));
  const city = discoveryProfile.cityName || userData.city;
  if (city) preferredCities.add(normalized(city));
  const cityId = discoveryProfile.cityId || userData.cityId;
  if (cityId) preferredCities.add(normalized(cityId));

  const savedEventIds = [
    ...(Array.isArray(userData.attendedEvents) ? userData.attendedEvents : []),
    ...(Array.isArray(userData.interestedEventIds) ? userData.interestedEventIds : []),
  ]
    .map((item) => (typeof item === 'string' ? item : item?.eventId || item?.id))
    .filter(Boolean);
  const eventIds = [
    ...new Set([...orders.map((order) => order.eventId).filter(Boolean), ...savedEventIds]),
  ];
  eventIds.forEach((eventId) => pastEventIds.add(eventId));
  if (eventIds.length > 0 && isFirebaseConfigured()) {
    const historyDb = getAdminDb();
    const chunks = [];
    for (let index = 0; index < eventIds.length; index += 10)
      chunks.push(eventIds.slice(index, index + 10));
    const eventDocs = (
      await Promise.all(
        chunks.map((chunk) =>
          historyDb.collection(EVENT_COLLECTION).where('__name__', 'in', chunk).get(),
        ),
      )
    ).flatMap((snapshot) => snapshot.docs);

    eventDocs.forEach((doc) => {
      const event = doc.data();
      (event.tags || []).forEach((tag) => preferredTags.add(normalized(tag)));
      if (event.category) preferredTags.add(normalized(event.category));
      if (event.city) preferredCities.add(normalized(event.city));
      if (event.host) preferredHosts.add(event.host);
    });
  }

  return {
    preferredTags,
    preferredCities,
    preferredHosts,
    pastEventIds,
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
  const now = Date.now();
  return candidates
    .filter((event) => {
      if (event.status === 'past' || event.lifecycle === 'ended' || event.lifecycle === 'cancelled')
        return false;
      const start = eventStartTime(event);
      return !start || start >= now;
    })
    .map((event) => ({ event, ...calculateMatch(event, userProfile, now) }))
    .filter((item) => !userProfile.pastEventIds.has(item.event.id))
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
    userProfile.preferredTags.size > 0;

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

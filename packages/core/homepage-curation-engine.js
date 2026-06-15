import { getAdminDb, isFirebaseConfigured } from './admin.js';
import { getRedisClient } from './redis.js';
import { PUBLIC_LIFECYCLE_STATES, mapEventForClient } from './events.js';

const EVENT_COLLECTION = 'events';
const SPOTLIGHTS_DOC = { collection: 'platform_settings', id: 'spotlights' };

export const FEATURED_EVENT_LIMIT = 6;

export function mergePinnedAndHeatEvents(
  pinnedEvents = [],
  heatEvents = [],
  limit = FEATURED_EVENT_LIMIT,
) {
  const merged = [];
  const seen = new Set();
  for (const event of [...pinnedEvents, ...heatEvents]) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
    if (merged.length >= limit) break;
  }
  return merged;
}

async function cacheGet(key) {
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, data, ttlSeconds = 300) {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch {
    /* fail open */
  }
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isEligibleFeaturedEvent(event, nowIso) {
  if (!event?.id) return false;
  if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) return false;
  if (event.isDeleted === true) return false;
  const end = event.endDate || event.startDate;
  return !!end && end >= nowIso;
}

const compareByHeat = (a, b) =>
  (b?.heatScore ?? b?.stats?.heatScore ?? 0) - (a?.heatScore ?? a?.stats?.heatScore ?? 0);

async function getPinnedFeaturedIds() {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const doc = await db.collection(SPOTLIGHTS_DOC.collection).doc(SPOTLIGHTS_DOC.id).get();
  return doc.exists ? normalizeIdList(doc.data()?.featured) : [];
}

async function getPinnedFeaturedEvents(ids, nowIso) {
  if (!isFirebaseConfigured() || ids.length === 0) return [];
  const db = getAdminDb();
  const refs = ids.map((id) => db.collection(EVENT_COLLECTION).doc(id));
  const snapshots = await db.getAll(...refs);
  const byId = new Map();
  snapshots.forEach((snap) => {
    if (!snap.exists) return;
    const event = mapEventForClient(snap.data(), snap.id);
    if (isEligibleFeaturedEvent(event, nowIso)) byId.set(snap.id, event);
  });
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function getHeatEvents(limit, nowIso) {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const candidateLimit = Math.max(limit * 4, 24);
  let snapshot;
  try {
    snapshot = await db
      .collection(EVENT_COLLECTION)
      .where('lifecycle', 'in', PUBLIC_LIFECYCLE_STATES)
      .where('endDate', '>=', nowIso)
      .orderBy('heatScore', 'desc')
      .limit(candidateLimit)
      .get();
  } catch {
    try {
      snapshot = await db
        .collection(EVENT_COLLECTION)
        .where('lifecycle', 'in', PUBLIC_LIFECYCLE_STATES)
        .where('endDate', '>=', nowIso)
        .limit(Math.max(candidateLimit, 60))
        .get();
    } catch {
      snapshot = await db
        .collection(EVENT_COLLECTION)
        .where('lifecycle', 'in', PUBLIC_LIFECYCLE_STATES)
        .limit(Math.max(candidateLimit, 60))
        .get();
    }
  }
  return snapshot.docs
    .map((doc) => mapEventForClient(doc.data(), doc.id))
    .filter((event) => isEligibleFeaturedEvent(event, nowIso))
    .sort(compareByHeat)
    .slice(0, candidateLimit);
}

export async function getFeaturedEvents(limit = FEATURED_EVENT_LIMIT) {
  const cacheKey = `featured:events:${limit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const nowIso = new Date().toISOString();
  const pinnedIds = await getPinnedFeaturedIds();
  const [pinnedEvents, heatEvents] = await Promise.all([
    getPinnedFeaturedEvents(pinnedIds, nowIso),
    getHeatEvents(limit, nowIso),
  ]);

  const result = mergePinnedAndHeatEvents(pinnedEvents, heatEvents, limit);
  await cacheSet(cacheKey, result, 180);
  return result;
}

export async function getHomepageSelects() {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection('homepage_selects').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getHomepageInterviews() {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection('homepage_interviews').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export function getHomepageStats(events, city) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthEvents = events.filter((event) => {
    if (!event.startDate) return false;
    const date = new Date(event.startDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weeklyRegistrations = events.reduce((count, event) => {
    const updatedAt = event.updatedAt ? new Date(event.updatedAt) : now;
    if (updatedAt < sevenDaysAgo) return count;
    const stats = event.stats || {};
    if (typeof stats.rsvps === 'number') return count + stats.rsvps;
    if (Array.isArray(event.guests)) return count + event.guests.length;
    return count;
  }, 0);

  return { eventsThisMonth: monthEvents.length, weeklyRegistrations, city };
}

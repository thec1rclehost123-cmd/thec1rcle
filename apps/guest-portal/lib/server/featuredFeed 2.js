import { cache } from "react";
import { PUBLIC_LIFECYCLE_STATES, mapEventForClient } from "@c1rcle/core/events";

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin.js";
import { listEvents } from "./eventStore.js";
import { FEATURED_EVENT_LIMIT, mergePinnedAndHeatEvents } from "./featuredFeedUtils.js";

const EVENT_COLLECTION = "events";
const SPOTLIGHTS_COLLECTION = "platform_settings";
const SPOTLIGHTS_DOC_ID = "spotlights";

const toHeatScore = (event) => event?.heatScore ?? event?.stats?.heatScore ?? 0;

const compareByHeatScore = (a, b) => toHeatScore(b) - toHeatScore(a);

const normalizeIdList = (value) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const ids = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
};

const isEligibleFeaturedEvent = (event, nowIso = new Date().toISOString()) => {
  if (!event?.id) return false;
  if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) return false;
  if (event.isDeleted === true) return false;

  const end = event.endDate || event.startDate;
  if (!end) return false;

  return end >= nowIso;
};

async function getPinnedFeaturedIds() {
  if (!isFirebaseConfigured()) return [];

  const db = getAdminDb();
  const doc = await db.collection(SPOTLIGHTS_COLLECTION).doc(SPOTLIGHTS_DOC_ID).get();
  if (!doc.exists) return [];

  return normalizeIdList(doc.data()?.featured);
}

async function getPinnedFeaturedEvents(ids, nowIso) {
  if (!isFirebaseConfigured() || ids.length === 0) return [];

  const db = getAdminDb();
  const refs = ids.map((id) => db.collection(EVENT_COLLECTION).doc(id));
  const snapshots = await db.getAll(...refs);
  const byId = new Map();

  snapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;
    const event = mapEventForClient(snapshot.data(), snapshot.id);
    if (!isEligibleFeaturedEvent(event, nowIso)) return;
    byId.set(snapshot.id, event);
  });

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function getAutomaticHeatEvents(limit, nowIso) {
  const candidateLimit = Math.max(limit * 4, 24);

  if (!isFirebaseConfigured()) {
    const fallbackEvents = await listEvents({ limit: candidateLimit, sort: "heat" });
    return fallbackEvents
      .filter((event) => isEligibleFeaturedEvent(event, nowIso))
      .sort(compareByHeatScore)
      .slice(0, candidateLimit);
  }

  const db = getAdminDb();
  let snapshot;

  try {
    snapshot = await db
      .collection(EVENT_COLLECTION)
      .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
      .where("endDate", ">=", nowIso)
      .orderBy("heatScore", "desc")
      .limit(candidateLimit)
      .get();
  } catch (error) {
    try {
      snapshot = await db
        .collection(EVENT_COLLECTION)
        .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
        .where("endDate", ">=", nowIso)
        .limit(Math.max(candidateLimit, 60))
        .get();
    } catch (secondError) {
      snapshot = await db
        .collection(EVENT_COLLECTION)
        .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
        .limit(Math.max(candidateLimit, 60))
        .get();
    }
  }

  return snapshot.docs
    .map((doc) => mapEventForClient(doc.data(), doc.id))
    .filter((event) => isEligibleFeaturedEvent(event, nowIso))
    .sort(compareByHeatScore)
    .slice(0, candidateLimit);
}

export const getFeaturedEvents = cache(async (limit = FEATURED_EVENT_LIMIT) => {
  const nowIso = new Date().toISOString();
  const pinnedIds = await getPinnedFeaturedIds();
  const [pinnedEvents, heatEvents] = await Promise.all([
    getPinnedFeaturedEvents(pinnedIds, nowIso),
    getAutomaticHeatEvents(limit, nowIso),
  ]);

  return mergePinnedAndHeatEvents(pinnedEvents, heatEvents, limit);
});

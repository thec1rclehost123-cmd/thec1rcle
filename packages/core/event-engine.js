import {
  normalizeCity,
  PUBLIC_LIFECYCLE_STATES,
  mapEventForClient,
  EVENT_LIFECYCLE,
  getCityLabel,
  resolvePoster,
} from './events.js';
import { randomUUID } from 'node:crypto';

export async function getEvent(eventId, { client = false } = {}) {
  if (!eventId) return null;
  const { getAdminDb } = await import('./admin.js');
  const db = getAdminDb();
  const doc = await db.collection('events').doc(eventId).get();
  if (!doc.exists) return null;
  const data = { id: doc.id, ...doc.data() };
  return client ? mapEventForClient(data, doc.id) : data;
}

/**
 * Calculates a heat score for trending events.
 * High scores indicate trending/popular events.
 */
export function calculateHeatScore(event) {
  const stats = event.stats || {};
  const guestsCount = Array.isArray(event.guests) ? event.guests.length : 0;
  const now = Date.now();
  const startMs = event.startDate ? new Date(event.startDate).getTime() : now;
  const hoursUntil = Math.max((startMs - now) / 36e5, 0);

  // 7-day window decay
  const recencyBoost = Math.max(168 - hoursUntil, 0);
  const guestBoost = guestsCount * 4;
  const rsvpBoost = (stats.rsvps || guestsCount) * 3;
  const viewsBoost = (stats.views || 0) * 0.1;
  const saveBoost = (stats.saves || 0) * 0.4;
  const shareBoost = (stats.shares || 0) * 0.8;

  return Math.round(recencyBoost + guestBoost + rsvpBoost + viewsBoost + saveBoost + shareBoost);
}

/**
 * Resolves the starting price of an event based on its tickets.
 */
export function resolveStartingPrice(event) {
  if (typeof event.startingPrice === 'number') return event.startingPrice;
  if (typeof event.priceRange?.min === 'number') return event.priceRange.min;
  if (Array.isArray(event.tickets) && event.tickets.length) {
    return event.tickets.reduce(
      (min, ticket) => Math.min(min, Number(ticket.price) || 0),
      Infinity,
    );
  }
  return 0;
}

/**
 * Determines current status based on time.
 */
export function determineStatus(start, end) {
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : now;
  const endMs = end ? new Date(end).getTime() : startMs;
  if (now < startMs) return 'upcoming';
  if (now >= startMs && now <= endMs) return 'live';
  return 'past';
}

/**
 * Pure transformation logic for building a complete Event object.
 * Moved from eventStore.js for universal use.
 */
export function buildEvent(payload = {}) {
  const isHost = payload.creatorRole === 'host';
  const isDraft = payload.lifecycle === EVENT_LIFECYCLE.DRAFT;
  const required = isDraft
    ? ['title']
    : isHost || payload.creatorRole === 'club'
      ? ['title', 'city', 'host']
      : ['title', 'startDate', 'location', 'host'];

  const missing = required.filter((field) => !payload[field]);
  if (missing.length) {
    throw new Error(`Missing fields: ${missing.join(', ')}`);
  }

  const nowIso = new Date().toISOString();
  const startDate = payload.startDate || '';
  const endDate = payload.endDate || startDate;
  const gallery = Array.isArray(payload.gallery) ? payload.gallery : [];
  const guests = Array.isArray(payload.guests) ? payload.guests : [];
  const tags = Array.isArray(payload.tags || payload.features)
    ? payload.tags || payload.features
    : [];

  const poster = resolvePoster(payload);
  const cityKey = normalizeCity(payload.city, payload.location);
  const cityLabel = getCityLabel(cityKey);

  const event = {
    id: payload.id || randomUUID(),
    slug: payload.slug || payload.id || randomUUID(),
    title: payload.title?.trim(),
    summary: payload.summary?.trim() || '',
    description: payload.description?.trim() || payload.summary?.trim() || '',
    category: payload.category?.trim() || 'Trending',
    tags,
    host: (payload.host || 'C1RCLE Partner').trim(),
    hostId: payload.hostId || (payload.creatorRole === 'host' ? payload.creatorId : '') || '',
    location: (payload.location || payload.venueName || '').trim(),
    venue: (payload.venue || payload.venueName || '').trim(),
    venueId:
      payload.venueId ||
      (payload.creatorRole === 'venue' || payload.creatorRole === 'club'
        ? payload.creatorId
        : '') ||
      '',
    promotersEnabled: payload.promotersEnabled ?? payload.promoterSettings?.enabled ?? true,
    city: cityLabel,
    cityKey,
    country: payload.country || 'India',
    startDate,
    endDate,
    timezone: payload.timezone || 'Asia/Kolkata',
    poster,
    image: poster,
    accentColor: payload.accentColor || '#ffffff',
    guests: guests.length ? guests : ['New', 'Guests'],
    gallery: gallery.length ? gallery : [poster],
    tickets: payload.tickets || [],
    tables: payload.tables || [],
    priceRange: payload.priceRange || { min: 0, max: 0, currency: 'INR' },
    isRSVP: !!payload.isRSVP,
    promoterSettings: payload.promoterSettings || { enabled: true },
    // Top-level visibility field for public discovery filtering.
    // Explicitly stored so filtering code never relies on undefined-defaulting.
    // Lifecycle-gating (isEventPublic) is the real access guard, not this field alone.
    visibility: payload.visibility || 'public',
    settings: payload.settings || { showExplore: true, visibility: 'public' },
    stats: payload.stats || { rsvps: 0, views: 0, saves: 0, shares: 0 },
    isDeleted: payload.isDeleted ?? false,
    createdAt: payload.createdAt || nowIso,
    updatedAt: nowIso,
    lifecycle: payload.lifecycle || EVENT_LIFECYCLE.DRAFT,
    creatorRole: (payload.creatorRole === 'club' ? 'venue' : payload.creatorRole) || 'venue',
    creatorId: payload.creatorId || '',
    auditTrail: payload.auditTrail || [],
  };

  event.status = determineStatus(event.startDate, event.endDate);
  event.heatScore = calculateHeatScore(event);

  return event;
}

/**
 * Standard Sorters
 */
export const EVENT_SORTERS = {
  heat: (a, b) => (b.heatScore ?? 0) - (a.heatScore ?? 0),
  new: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  soonest: (a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0),
  price: (a, b) => resolveStartingPrice(a) - resolveStartingPrice(b),
};

/**
 * Filter and sort logic.
 */
export function filterAndSortEvents(events, { city, sort = 'heat', search, host } = {}) {
  const nowIso = new Date().toISOString();

  let results = events.filter((event) => {
    if (!PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) return false;
    const end = event.endDate || event.startDate;
    // Normalize date-only strings (YYYY-MM-DD) to end-of-day so today's events aren't filtered out
    const endNormalized = end && end.length === 10 ? end + 'T23:59:59.999Z' : end;
    if (endNormalized < nowIso) return false;
    if (city && event.cityKey !== normalizeCity(city)) return false;
    if (host && event.host !== host) return false;
    if (search) {
      const lowerSearch = search.toLowerCase();
      return (
        event.title?.toLowerCase().includes(lowerSearch) ||
        event.location?.toLowerCase().includes(lowerSearch) ||
        event.host?.toLowerCase().includes(lowerSearch)
      );
    }
    return true;
  });

  results = results.map((e) => ({
    ...e,
    heatScore: e.heatScore || calculateHeatScore(e),
  }));

  const sorter = EVENT_SORTERS[sort] || EVENT_SORTERS.heat;
  results.sort(sorter);

  return results;
}

export default {
  getEvent,
  calculateHeatScore,
  resolveStartingPrice,
  determineStatus,
  buildEvent,
  filterAndSortEvents,
  EVENT_SORTERS,
};

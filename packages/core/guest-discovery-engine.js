import {
  EVENT_LIFECYCLE,
  PUBLIC_LIFECYCLE_STATES,
  mapEventForClient,
  normalizeCity,
} from './events.js';
import { calculateHeatScore, resolveStartingPrice } from './event-engine.js';

export function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeFilterKey(value) {
  return slugify(String(value || ''));
}

export function normalizeCityKey(value) {
  if (!value) return null;
  const normalized = normalizeCity(String(value));
  return normalized === 'other-in' ? normalizeFilterKey(value) : normalized;
}

export function normalizeBoolean(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

export function normalizeGuestDiscoverySort(value) {
  const normalized = String(value || 'startAt')
    .trim()
    .toLowerCase();
  if (['heat', 'heatscore', 'trending', 'popular'].includes(normalized)) return 'heatScore';
  if (['new', 'newest', 'publishedat', 'createdat'].includes(normalized)) return 'publishedAt';
  if (['price', 'price low to high', 'pricemin'].includes(normalized)) return 'priceMin';
  return 'startAt';
}

export const normalizeEventSort = normalizeGuestDiscoverySort;

export function normalizeDiscoverySort(value) {
  const normalized = String(value || 'followersCount')
    .trim()
    .toLowerCase();
  if (['soonest event', 'soonest', 'nexteventat'].includes(normalized)) return 'nextEventAt';
  if (['new', 'newest', 'updatedat'].includes(normalized)) return 'updatedAt';
  return 'followersCount';
}

export function normalizeGuestDiscoveryLimit(value, fallback = 24, max = 100) {
  return Math.max(1, Math.min(Number(value) || fallback, max));
}

export function isPublicProfileEnabled(entity = {}) {
  if (!entity) return false;
  if (typeof entity.publicProfileEnabled === 'boolean') return entity.publicProfileEnabled;
  if (typeof entity.presenceConfig?.publicProfileEnabled === 'boolean')
    return entity.presenceConfig.publicProfileEnabled;
  const visibility = String(entity.visibility || 'public').toLowerCase();
  return visibility === 'public';
}

export const isGuestPublicProfileEnabled = isPublicProfileEnabled;

export function toEventBoundaryTime(value, boundary = 'start') {
  const iso = toIso(value);
  if (!iso) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}Z`
    : iso;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function isCurrentOrUpcomingGuestEvent(event) {
  if (!event) return false;

  // 🛡️ Reliability: Add a 30-minute grace period to prevent events from vanishing
  // exactly at their end time, accounting for indexing lag and user session drift.
  const GRACE_PERIOD_MS = 30 * 60 * 1000;
  const now = Date.now();
  const startAt = toEventBoundaryTime(event.startAt || event.startDate, 'start');
  const endAt = toEventBoundaryTime(
    event.endAt || event.endDate || event.startAt || event.startDate,
    'end',
  );

  if (!startAt || !endAt) return false;

  // Upcoming: Start time is in the future
  const isUpcoming = startAt > now;

  // Current: Now is between start and end (+ grace period)
  const isCurrent = now >= startAt && now <= endAt + GRACE_PERIOD_MS;

  return isUpcoming || isCurrent;
}

export function normalizeStatusKey(event = {}) {
  const raw = String(event.status || event.lifecycle || '').toLowerCase();
  if (raw.includes('cancel')) return 'canceled';
  const startAt = toEventBoundaryTime(event.startAt || event.startDate, 'start');
  const endAt = toEventBoundaryTime(
    event.endAt || event.endDate || event.startAt || event.startDate,
    'end',
  );
  const now = Date.now();
  if (endAt && endAt < now) return 'ended';
  if (startAt && startAt <= now && (!endAt || endAt >= now)) return 'live';
  return 'upcoming';
}

export function deriveGuestPublicLifecycle(event = {}, statusKey = normalizeStatusKey(event)) {
  const rawLifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  if (rawLifecycle === EVENT_LIFECYCLE.CANCELLED || statusKey === 'canceled')
    return EVENT_LIFECYCLE.CANCELLED;
  if (rawLifecycle === EVENT_LIFECYCLE.PAUSED) return EVENT_LIFECYCLE.PAUSED;
  if (statusKey === 'ended') return EVENT_LIFECYCLE.COMPLETED;
  if (statusKey === 'live') return EVENT_LIFECYCLE.LIVE;
  return EVENT_LIFECYCLE.SCHEDULED;
}

export function isEventPublic(event = {}) {
  const visibility = String(event.visibility || 'public').toLowerCase();
  const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  if (visibility !== 'public') return false;
  if (!lifecycle) return false;
  if (
    [
      EVENT_LIFECYCLE.DRAFT,
      EVENT_LIFECYCLE.SUBMITTED,
      EVENT_LIFECYCLE.NEEDS_CHANGES,
      EVENT_LIFECYCLE.APPROVED,
      EVENT_LIFECYCLE.DENIED,
      EVENT_LIFECYCLE.DELETED,
      'rejected',
      'blocked',
      'internal',
    ].includes(lifecycle)
  ) {
    return false;
  }
  return true;
}

export const isGuestEventPublic = isEventPublic;

export function isGuestDiscoveryVisible(event = {}) {
  const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  const statusKey = String(event.statusKey || '').toLowerCase();
  return (
    Boolean(event) &&
    event.visibility === 'public' &&
    PUBLIC_LIFECYCLE_STATES.includes(lifecycle) &&
    statusKey !== 'ended' &&
    isCurrentOrUpcomingGuestEvent(event)
  );
}

export function isEventDetailVisible(event = {}) {
  const visibility = String(event.visibility || 'public').toLowerCase();
  const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
  if (visibility !== 'public') return false;
  return [
    ...PUBLIC_LIFECYCLE_STATES,
    EVENT_LIFECYCLE.CANCELLED,
    EVENT_LIFECYCLE.PAUSED,
    EVENT_LIFECYCLE.COMPLETED,
  ].includes(lifecycle);
}

export const isGuestEventDetailVisible = isEventDetailVisible;

export function computeHeatScore(event = {}) {
  const stats = event.stats || {};
  const followers = Number(event.followersCount || 0);
  const views = Number(stats.views || event.views || 0);
  const rsvps = Number(stats.rsvps || stats.interested || event.attendeeCount || 0);
  const ticketSales = Number(stats.ticketSales || stats.orders || 0);
  const startAt = new Date(event.startAt || event.startDate || Date.now()).getTime();
  const hoursUntil = Math.max(1, (startAt - Date.now()) / (1000 * 60 * 60));
  const freshness = hoursUntil < 48 ? 30 : hoursUntil < 168 ? 15 : 5;
  return Math.round(followers * 0.1 + views * 0.05 + rsvps * 2 + ticketSales * 4 + freshness);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractEventCoordinates(event = {}) {
  const candidates = [
    event.coordinates,
    event.mapLocation,
    event.locationCoordinates,
    event.geo,
    event._geoloc,
    event.location,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const latitude =
      toFiniteNumber(candidate.latitude) ??
      toFiniteNumber(candidate.lat) ??
      toFiniteNumber(candidate._latitude);
    const longitude =
      toFiniteNumber(candidate.longitude) ??
      toFiniteNumber(candidate.lng) ??
      toFiniteNumber(candidate.lon) ??
      toFiniteNumber(candidate._longitude);
    if (latitude !== null && longitude !== null) return { latitude, longitude };
  }

  const latitude = toFiniteNumber(event.latitude) ?? toFiniteNumber(event.lat);
  const longitude = toFiniteNumber(event.longitude) ?? toFiniteNumber(event.lng);
  if (latitude !== null && longitude !== null) return { latitude, longitude };

  return null;
}

function distanceKm(originLat, originLng, targetLat, targetLng) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) * Math.cos(toRadians(targetLat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapPinFromEvent(event = {}, coordinates) {
  return {
    id: event.id,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    heatScore: Number(event.heatScore ?? computeHeatScore(event)) || 0,
  };
}

export async function listEventMapPins(
  db,
  { lat, lng, radius = 15, limit = 500, now = new Date() } = {},
) {
  const latitude = toFiniteNumber(lat);
  const longitude = toFiniteNumber(lng);
  if (latitude === null || longitude === null) throw new Error('lat and lng are required');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Invalid coordinates');
  }

  const safeRadius = Math.max(0.5, Math.min(Number(radius) || 15, 50));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 500));
  const latDelta = safeRadius / 111.12;
  const lngDelta = safeRadius / (111.12 * Math.max(Math.cos(latitude * (Math.PI / 180)), 0.1));
  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  const queryLimit = Math.min(Math.max(safeLimit * 3, 100), 1000);
  const snapshots = await Promise.all(
    ['coordinates.latitude', 'latitude'].map((field) =>
      db
        .collection('events')
        .where(field, '>=', minLat)
        .where(field, '<=', maxLat)
        .limit(queryLimit)
        .get()
        .catch(() => ({ docs: [] })),
    ),
  );

  const seen = new Map();
  snapshots
    .flatMap((snapshot) => snapshot.docs || [])
    .forEach((doc) => {
      if (!seen.has(doc.id)) seen.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
    });

  const pins = [...seen.values()]
    .filter((event) => isEventPublic(event) && isCurrentOrUpcomingGuestEvent(event))
    .map((event) => {
      const coordinates = extractEventCoordinates(event);
      if (!coordinates) return null;
      if (Math.abs(coordinates.longitude - longitude) > lngDelta) return null;
      const distance = distanceKm(latitude, longitude, coordinates.latitude, coordinates.longitude);
      if (distance > safeRadius) return null;
      return {
        ...mapPinFromEvent(event, coordinates),
        distance,
        startsAt: new Date(
          event.startAt || event.startDate || event.startDateTime || nowTime,
        ).getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const heatDelta = Number(b.heatScore || 0) - Number(a.heatScore || 0);
      if (heatDelta !== 0) return heatDelta;
      return Number(a.startsAt || 0) - Number(b.startsAt || 0);
    })
    .slice(0, safeLimit)
    .map(({ distance, startsAt, ...pin }) => pin);

  return {
    pins,
    count: pins.length,
    center: { lat: latitude, lng: longitude },
    radiusKm: safeRadius,
  };
}

export function buildSearchText(parts = []) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function derivePriceRange(rawEvent = {}, priceMin = 0, priceMax = priceMin) {
  if (rawEvent.priceRange && typeof rawEvent.priceRange === 'object') {
    return rawEvent.priceRange;
  }
  return {
    min: priceMin,
    max: priceMax,
    currency: rawEvent.currency || 'INR',
  };
}

export function deriveTickets(rawEvent = {}, priceMin = 0) {
  if (Array.isArray(rawEvent.tickets) && rawEvent.tickets.length > 0) {
    return rawEvent.tickets;
  }
  return [
    {
      id: `${rawEvent.id || rawEvent.slug || 'event'}-default`,
      name: rawEvent.isFree || priceMin <= 0 ? 'Free Entry' : 'General Admission',
      price: priceMin,
      quantity: Number(rawEvent.capacity || 0),
    },
  ];
}

export function extractStartTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(11, 16);
}

export function paginateItems(items = [], limit = 24, cursor = null) {
  const start = cursor ? Math.max(items.findIndex((item) => item.id === cursor) + 1, 0) : 0;
  const slice = items.slice(start, start + limit);
  const nextCursor = slice.length === limit ? slice[slice.length - 1]?.id || null : null;
  return {
    items: slice,
    nextCursor,
    hasMore: start + limit < items.length,
  };
}

export function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function pickAllowed(raw = {}, keys = []) {
  const output = {};
  for (const key of keys) {
    if (raw[key] !== undefined) output[key] = raw[key];
  }
  return output;
}

export function projectGuestEventCard(event = {}) {
  const mapped = mapEventForClient(event, event.id);
  const priceMin = resolveStartingPrice(mapped);
  return {
    ...mapped,
    heatScore: mapped.heatScore || calculateHeatScore(mapped),
    priceMin,
    cityKey: mapped.cityKey || normalizeCity(mapped.city, mapped.location),
  };
}

export function buildEventCardReadModel(rawEvent = {}, { readModelVersion = 2 } = {}) {
  const event = { ...rawEvent };
  const statusKey = normalizeStatusKey(event);
  const lifecycle = deriveGuestPublicLifecycle(event, statusKey);
  const cityKey =
    normalizeCityKey(event.cityKey || event.city || event.cityLabel) || 'unknown-city';
  const areaKey = slugify(event.area || event.neighborhood || '');
  const title = event.title || event.name || 'Untitled Event';
  const slug = event.slug || slugify(title);
  const priceMin = Number(event.priceMin ?? event.ticketPrice ?? event.minPrice ?? 0);
  const priceMax = Number(event.priceMax ?? event.ticketPrice ?? event.maxPrice ?? priceMin);
  const isFree = Boolean(event.isFree || (priceMin <= 0 && priceMax <= 0));
  const startAt = toIso(event.startAt || event.startDate || event.startDateTime);
  const endAt = toIso(event.endAt || event.endDate);
  const tickets = deriveTickets(event, priceMin);
  const priceRange = derivePriceRange(event, priceMin, priceMax);
  const heatScore = computeHeatScore(event);

  return {
    eventId: event.id,
    id: event.id,
    slug,
    title,
    cityKey,
    cityLabel: event.city || event.cityLabel || null,
    areaKey,
    startAt,
    endAt,
    dayKey: startAt?.slice(0, 10) || null,
    lifecycle,
    visibility: 'public',
    posterUrl: event.poster || event.image || event.coverImage || null,
    image: event.poster || event.image || event.coverImage || null,
    hostId: event.hostId || null,
    hostName: event.hostName || event.host || null,
    hostSlug: event.hostSlug || slugify(event.hostName || event.host || ''),
    venueId: event.venueId || null,
    venueName: event.venueName || event.venue || null,
    venueSlug: event.venueSlug || slugify(event.venueName || event.venue || ''),
    venue: event.venueName || event.venue || null,
    host: event.hostName || event.host || null,
    priceMin,
    priceMax,
    isFree,
    price: priceMin,
    startingPrice: priceMin,
    priceRange,
    tickets,
    availabilityLabel:
      event.availabilityLabel ||
      (statusKey === 'canceled' ? 'Canceled' : isFree ? 'Free entry' : 'Tickets available'),
    tags: Array.isArray(event.tags) ? event.tags.slice(0, 8) : [],
    eventType: event.eventType || event.category || null,
    curatedCategory: event.curatedCategory || event.category || null,
    category: event.category || event.curatedCategory || event.eventType || 'Event',
    heatScore,
    searchText: buildSearchText([
      title,
      event.hostName,
      event.host,
      event.venueName,
      event.venue,
      event.city,
      ...(event.tags || []),
    ]),
    publishedAt: toIso(event.publishedAt || event.updatedAt || event.createdAt),
    updatedAt: new Date().toISOString(),
    status: lifecycle,
    statusKey,
    description: event.description || event.summary || '',
    summary: event.summary || event.description || '',
    location: event.location || event.venueName || event.venue || event.cityLabel || '',
    city: event.city || event.cityLabel || null,
    date: typeof event.date === 'string' && event.date.trim() ? event.date : startAt || null,
    time: event.time || event.startTime || extractStartTime(startAt),
    startDate: toIso(event.startDate || event.startDateTime || event.startAt) || startAt,
    endDate: toIso(event.endDate || event.endAt) || endAt,
    startDateTime: toIso(event.startDateTime || event.startDate || event.startAt) || startAt,
    startTime: event.startTime || event.time || extractStartTime(startAt),
    endTime: event.endTime || extractStartTime(endAt),
    guests: Array.isArray(event.guests) ? event.guests : [],
    trending: Boolean(event.trending || heatScore > 40),
    stats: event.stats || {},
    readModelVersion,
    sourceUpdatedAt: toIso(event.updatedAt || event.createdAt) || null,
  };
}

export function buildHostSummaryReadModel(
  host = {},
  eventCards = [],
  { readModelVersion = 1 } = {},
) {
  const slug = host.slug || slugify(host.displayName || host.name || host.handle || host.id);
  const cards = eventCards.filter(
    (event) => event.hostId === host.id && event.visibility === 'public',
  );
  const upcoming = cards
    .filter((event) => event.statusKey === 'upcoming')
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));

  return {
    hostId: host.id,
    id: host.id,
    slug,
    handle: host.handle || `@${slug}`,
    name: host.name || host.displayName || slug,
    displayName: host.displayName || host.name || slug,
    avatar: host.avatar || host.photoURL || host.image || null,
    photoURL: host.photoURL || host.avatar || host.image || null,
    avatarUrl: host.avatar || host.photoURL || host.image || null,
    cover: host.cover || host.coverURL || null,
    coverURL: host.coverURL || host.cover || null,
    coverUrl: host.cover || host.coverURL || null,
    role: host.role || null,
    city: host.city || null,
    neighborhood: host.neighborhood || host.area || null,
    location: host.location || host.city || null,
    cityKey: slugify(host.cityKey || host.city || 'unknown-city'),
    areaKey: slugify(host.area || host.neighborhood || ''),
    vibes: Array.isArray(host.vibes)
      ? host.vibes
      : Array.isArray(host.styleTags)
        ? host.styleTags
        : [],
    genres: Array.isArray(host.genres)
      ? host.genres
      : Array.isArray(host.vibes)
        ? host.vibes
        : Array.isArray(host.styleTags)
          ? host.styleTags
          : [],
    styleTags: Array.isArray(host.styleTags)
      ? host.styleTags
      : Array.isArray(host.vibes)
        ? host.vibes
        : [],
    verified: Boolean(host.verified),
    trending: Boolean(host.trending),
    popular: Boolean(host.popular || Number(host.followersCount ?? host.followers ?? 0) >= 1000),
    followers: Number(host.followers ?? host.followersCount ?? 0),
    followersCount: Number(host.followersCount ?? host.followers ?? 0),
    upcomingEventsCount: upcoming.length,
    nextEventDate: upcoming[0]?.startAt || null,
    nextEventAt: upcoming[0]?.startAt || null,
    featuredEventIds: upcoming.slice(0, 3).map((event) => event.id),
    bioShort: host.bio || host.description || null,
    bio: host.bio || host.description || null,
    searchText: buildSearchText([
      host.displayName,
      host.name,
      host.handle,
      host.city,
      ...(host.vibes || []),
      ...(host.styleTags || []),
    ]),
    updatedAt: new Date().toISOString(),
    readModelVersion,
    publicProfileEnabled:
      host.publicProfileEnabled ?? host.presenceConfig?.publicProfileEnabled ?? true,
    visibility: isPublicProfileEnabled(host) ? 'public' : 'private',
  };
}

export function buildVenueSummaryReadModel(
  venue = {},
  eventCards = [],
  { readModelVersion = 1, menuAvailable = false, highlightsCount = 0 } = {},
) {
  const slug = venue.slug || slugify(venue.name || venue.id);
  const cards = eventCards.filter(
    (event) => event.venueId === venue.id && event.visibility === 'public',
  );
  const upcoming = cards
    .filter((event) => event.statusKey === 'upcoming')
    .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));

  return {
    venueId: venue.id,
    id: venue.id,
    slug,
    name: venue.name || slug,
    displayName: venue.displayName || venue.name || slug,
    photoURL: venue.photoURL || venue.logo || venue.image || null,
    logo: venue.logo || venue.photoURL || null,
    image: venue.image || venue.coverURL || venue.coverImage || null,
    coverURL: venue.coverURL || venue.coverImage || venue.image || null,
    coverImage: venue.coverImage || venue.coverURL || venue.image || null,
    photoUrl: venue.photoURL || venue.image || null,
    coverUrl: venue.coverURL || venue.coverImage || null,
    city: venue.city || null,
    area: venue.area || venue.neighborhood || null,
    neighborhood: venue.neighborhood || venue.area || null,
    cityKey: slugify(venue.cityKey || venue.city || 'unknown-city'),
    areaKey: slugify(venue.area || venue.neighborhood || ''),
    tags: Array.isArray(venue.tags) ? venue.tags : [],
    genres: Array.isArray(venue.genres)
      ? venue.genres
      : Array.isArray(venue.tags)
        ? venue.tags
        : [],
    vibes: Array.isArray(venue.vibes) ? venue.vibes : Array.isArray(venue.tags) ? venue.tags : [],
    tablesAvailable: Boolean(venue.tablesAvailable),
    verified: Boolean(venue.verified),
    isVerified: Boolean(venue.isVerified ?? venue.verified),
    venueType: venue.venueType || venue.category || venue.type || null,
    category: venue.category || venue.venueType || venue.type || null,
    followers: Number(venue.followers ?? venue.followersCount ?? 0),
    followersCount: Number(venue.followersCount ?? venue.followers ?? 0),
    upcomingEventsCount: upcoming.length,
    nextEventAt: upcoming[0]?.startAt || null,
    menuAvailable,
    highlightsCount,
    bioShort: venue.bio || venue.description || null,
    bio: venue.bio || venue.description || null,
    description: venue.description || venue.bio || null,
    searchText: buildSearchText([venue.name, venue.city, venue.area, ...(venue.tags || [])]),
    updatedAt: new Date().toISOString(),
    readModelVersion,
    publicProfileEnabled:
      venue.publicProfileEnabled ?? venue.presenceConfig?.publicProfileEnabled ?? true,
    visibility: isPublicProfileEnabled(venue) ? 'public' : 'private',
  };
}

export function projectHostDetail(rawHost = {}, summary = {}) {
  return {
    ...pickAllowed(rawHost, [
      'id',
      'slug',
      'handle',
      'name',
      'displayName',
      'avatar',
      'photoURL',
      'image',
      'cover',
      'coverURL',
      'bio',
      'description',
      'tagline',
      'role',
      'genres',
      'styleTags',
      'vibes',
      'videos',
      'socialLinks',
      'website',
      'neighborhood',
      'city',
      'location',
      'verified',
      'trending',
      'followers',
      'followersCount',
      'publicProfileEnabled',
      'presenceConfig',
    ]),
    ...summary,
    id: summary.id,
    name: rawHost.name || rawHost.displayName || summary.name || summary.displayName,
    displayName: rawHost.displayName || rawHost.name || summary.displayName || summary.name,
    avatar: rawHost.avatar || rawHost.photoURL || summary.avatar,
    photoURL: rawHost.photoURL || rawHost.avatar || summary.photoURL,
    coverURL: rawHost.coverURL || rawHost.cover || summary.coverURL,
    cover: rawHost.cover || rawHost.coverURL || summary.cover,
    bio: rawHost.bio || rawHost.description || summary.bio,
    description: rawHost.description || rawHost.bio || summary.description,
    followers: Number(
      rawHost.followers ??
        rawHost.followersCount ??
        summary.followers ??
        summary.followersCount ??
        0,
    ),
    followersCount: Number(
      rawHost.followersCount ??
        rawHost.followers ??
        summary.followersCount ??
        summary.followers ??
        0,
    ),
  };
}

export function projectVenueDetail(rawVenue = {}, summary = {}, menuDoc = null) {
  const menu = menuDoc?.menu || menuDoc?.items || rawVenue.menu || null;
  return {
    ...pickAllowed(rawVenue, [
      'id',
      'slug',
      'name',
      'displayName',
      'photoURL',
      'logo',
      'image',
      'coverURL',
      'coverImage',
      'bannerImage',
      'venueType',
      'category',
      'type',
      'area',
      'neighborhood',
      'city',
      'address',
      'contact',
      'phone',
      'email',
      'whatsapp',
      'website',
      'socialLinks',
      'coordinates',
      'location',
      'timings',
      'openingHours',
      'costForTwo',
      'averageCost',
      'priceBand',
      'genres',
      'musicGenres',
      'dressCode',
      'entryRules',
      'rules',
      'ageLimit',
      'minimumAge',
      'facilities',
      'amenities',
      'photos',
      'gallery',
      'menuImages',
      'menu',
      'presenceConfig',
      'tablesAvailable',
      'hasReservation',
      'hasTickets',
      'primaryCta',
      'followers',
      'followersCount',
      'verified',
      'isVerified',
      'tags',
      'vibes',
      'bio',
      'description',
      'publicProfileEnabled',
    ]),
    ...summary,
    id: summary.id,
    name: rawVenue.name || summary.name,
    photoURL: rawVenue.photoURL || rawVenue.logo || summary.photoURL,
    image: rawVenue.image || rawVenue.coverURL || rawVenue.coverImage || summary.image,
    coverURL: rawVenue.coverURL || rawVenue.coverImage || rawVenue.image || summary.coverURL,
    coverImage: rawVenue.coverImage || rawVenue.coverURL || rawVenue.image || summary.coverImage,
    area: rawVenue.area || rawVenue.neighborhood || summary.area,
    neighborhood: rawVenue.neighborhood || rawVenue.area || summary.neighborhood,
    followers: Number(
      rawVenue.followers ??
        rawVenue.followersCount ??
        summary.followers ??
        summary.followersCount ??
        0,
    ),
    followersCount: Number(
      rawVenue.followersCount ??
        rawVenue.followers ??
        summary.followersCount ??
        summary.followers ??
        0,
    ),
    verified: Boolean(rawVenue.verified ?? rawVenue.isVerified ?? summary.verified),
    isVerified: Boolean(rawVenue.isVerified ?? rawVenue.verified ?? summary.isVerified),
    menu,
    menuDoc,
  };
}

export function buildGuestDiscoveryEnvelope(
  items = [],
  { nextCursor = null, hasMore = false, appliedFilters = {} } = {},
) {
  return {
    items,
    nextCursor,
    hasMore: Boolean(hasMore),
    appliedFilters,
  };
}

export function filterGuestEventCards(rawItems = [], query = {}) {
  const limit = normalizeGuestDiscoveryLimit(query.limit, 12, 24);
  const cursor = query.cursor || query.lastId || null;
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const statusKey = query.statusKey || query.status || null;
  const eventType = query.eventType || query.type || query.category || null;
  const eventTypeKey = normalizeFilterKey(eventType);
  const curatedCategoryKey = normalizeFilterKey(query.curatedCategory || null);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  const host = String(query.host || query.hostId || query.hostSlug || '')
    .trim()
    .toLowerCase();
  const venue = String(query.venue || query.venueId || query.venueSlug || '')
    .trim()
    .toLowerCase();
  const datePreset = String(query.datePreset || query.date || '')
    .trim()
    .toLowerCase();
  const normalizedDatePreset = datePreset === 'tonight' ? 'today' : datePreset;
  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(String(query.endDate))
          ? `${query.endDate}T23:59:59.999Z`
          : query.endDate,
      )
    : null;
  let items = dedupeById(rawItems).filter((item) => item.visibility === 'public');
  if (!statusKey) items = items.filter((item) => isGuestDiscoveryVisible(item));
  if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
  if (statusKey)
    items = items.filter(
      (item) =>
        item.statusKey === statusKey ||
        String(item.lifecycle || '').toLowerCase() === String(statusKey).toLowerCase(),
    );
  if (eventTypeKey)
    items = items.filter((item) =>
      [item.eventType, item.category, item.curatedCategory].some(
        (value) => normalizeFilterKey(value) === eventTypeKey,
      ),
    );
  if (curatedCategoryKey)
    items = items.filter((item) => normalizeFilterKey(item.curatedCategory) === curatedCategoryKey);
  const priceType = String(query.priceType || '').toLowerCase();
  if (priceType === 'free') items = items.filter((item) => item.isFree);
  if (priceType === 'paid') items = items.filter((item) => !item.isFree);
  if (query.dayKey) items = items.filter((item) => item.dayKey === query.dayKey);
  if (host) {
    items = items.filter(
      (item) =>
        [item.hostId, item.hostSlug, item.hostName, item.host].some(
          (value) => String(value || '').toLowerCase() === host,
        ) ||
        String(item.hostName || item.host || '')
          .toLowerCase()
          .includes(host),
    );
  }
  if (venue) {
    items = items.filter(
      (item) =>
        [item.venueId, item.venueSlug, item.venueName, item.venue].some(
          (value) => String(value || '').toLowerCase() === venue,
        ) ||
        String(item.venueName || item.venue || '')
          .toLowerCase()
          .includes(venue),
    );
  }
  if (normalizedDatePreset || startDate || endDate) {
    items = items.filter((item) => {
      const startAt = new Date(item.startAt || item.startDate || item.startDateTime || 0);
      if (Number.isNaN(startAt.getTime())) return false;

      if (normalizedDatePreset === 'weekend') {
        const day = startAt.getUTCDay();
        if (day !== 0 && day !== 6) return false;
      }
      if (normalizedDatePreset === 'today') {
        const now = new Date();
        if (
          startAt.getUTCFullYear() !== now.getUTCFullYear() ||
          startAt.getUTCMonth() !== now.getUTCMonth() ||
          startAt.getUTCDate() !== now.getUTCDate()
        ) {
          return false;
        }
      }
      if (normalizedDatePreset === 'tomorrow') {
        const now = new Date();
        const tomorrowUTC = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
        );
        if (
          startAt.getUTCFullYear() !== tomorrowUTC.getUTCFullYear() ||
          startAt.getUTCMonth() !== tomorrowUTC.getUTCMonth() ||
          startAt.getUTCDate() !== tomorrowUTC.getUTCDate()
        ) {
          return false;
        }
      }
      if (startDate && !Number.isNaN(startDate.getTime()) && startAt < startDate) return false;
      if (endDate && !Number.isNaN(endDate.getTime()) && startAt > endDate) return false;
      return true;
    });
  }
  if (search) {
    items = items.filter((item) =>
      String(item.searchText || '')
        .toLowerCase()
        .includes(search),
    );
  }
  const sort = normalizeEventSort(query.sort);
  items.sort((a, b) => {
    if (sort === 'heatScore') return Number(b.heatScore || 0) - Number(a.heatScore || 0);
    if (sort === 'publishedAt')
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    if (sort === 'priceMin') return Number(a.priceMin || 0) - Number(b.priceMin || 0);
    return String(a.startAt || '').localeCompare(String(b.startAt || ''));
  });
  const page = paginateItems(items, limit, cursor);
  return buildGuestDiscoveryEnvelope(page.items, {
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    appliedFilters: {
      cityKey: cityKey || null,
      statusKey: statusKey || null,
      eventType: eventType || null,
      category: query.category || null,
      curatedCategory: query.curatedCategory || null,
      priceType: priceType || null,
      dayKey: query.dayKey || null,
      datePreset: datePreset || null,
      startDate: query.startDate || null,
      endDate: query.endDate || null,
      search: search || null,
      host: host || null,
      venue: venue || null,
      sort,
    },
  });
}

export function filterGuestHostSummaries(rawItems = [], query = {}) {
  const limit = normalizeGuestDiscoveryLimit(query.limit, 12, 24);
  const cursor = query.cursor || query.lastId || null;
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  const status = String(query.status || '')
    .trim()
    .toLowerCase();
  let items = rawItems.filter((item) => item.visibility === 'public');
  if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
  if (query.role)
    items = items.filter(
      (item) => String(item.role || '').toLowerCase() === String(query.role).toLowerCase(),
    );
  if (query.vibe)
    items = items.filter(
      (item) =>
        Array.isArray(item.vibes) &&
        item.vibes.some((v) => String(v).toLowerCase() === String(query.vibe).toLowerCase()),
    );
  if (search)
    items = items.filter((item) =>
      String(item.searchText || '')
        .toLowerCase()
        .includes(search),
    );
  if (normalizeBoolean(query.verified) || status === 'verified')
    items = items.filter((item) => item.verified);
  if (normalizeBoolean(query.trending) || status === 'trending')
    items = items.filter((item) => item.trending);
  if (status === 'popular')
    items = items.filter(
      (item) => item.popular || Number(item.followersCount || item.followers || 0) > 0,
    );
  const sort = normalizeDiscoverySort(query.sort);
  items.sort((a, b) => {
    if (sort === 'nextEventAt')
      return String(a.nextEventAt || '').localeCompare(String(b.nextEventAt || ''));
    if (sort === 'updatedAt')
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    return Number(b.followersCount || 0) - Number(a.followersCount || 0);
  });
  const page = paginateItems(items, limit, cursor);
  return buildGuestDiscoveryEnvelope(page.items, {
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    appliedFilters: {
      cityKey: cityKey || null,
      role: query.role || null,
      vibe: query.vibe || null,
      verified: query.verified ?? null,
      trending: query.trending ?? null,
      status: query.status || null,
      search: search || null,
      sort,
    },
  });
}

export function filterGuestVenueSummaries(rawItems = [], query = {}) {
  const limit = normalizeGuestDiscoveryLimit(query.limit, 12, 24);
  const cursor = query.cursor || query.lastId || null;
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const areaKey = query.areaKey || (query.area ? normalizeFilterKey(query.area) : null);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  let items = rawItems.filter((item) => item.visibility === 'public');
  if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
  if (areaKey) items = items.filter((item) => item.areaKey === areaKey);
  if (query.vibe) {
    const vibe = String(query.vibe).toLowerCase();
    items = items.filter((item) =>
      [item.tags, item.vibes, item.genres].some(
        (values) => Array.isArray(values) && values.some((v) => String(v).toLowerCase() === vibe),
      ),
    );
  }
  if (search)
    items = items.filter((item) =>
      String(item.searchText || '')
        .toLowerCase()
        .includes(search),
    );
  if (normalizeBoolean(query.tablesAvailable) || normalizeBoolean(query.tablesOnly))
    items = items.filter((item) => item.tablesAvailable);
  if (normalizeBoolean(query.verified)) items = items.filter((item) => item.verified);
  const sort = normalizeDiscoverySort(query.sort);
  items.sort((a, b) => {
    if (sort === 'nextEventAt')
      return String(a.nextEventAt || '').localeCompare(String(b.nextEventAt || ''));
    if (sort === 'updatedAt')
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    return Number(b.followersCount || 0) - Number(a.followersCount || 0);
  });
  const page = paginateItems(items, limit, cursor);
  return buildGuestDiscoveryEnvelope(page.items, {
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    appliedFilters: {
      cityKey: cityKey || null,
      areaKey: areaKey || null,
      tablesAvailable: query.tablesAvailable ?? query.tablesOnly ?? null,
      verified: query.verified ?? null,
      vibe: query.vibe || null,
      search: search || null,
      sort,
    },
  });
}

export function rankGuestSearchGroups(
  { events = [], hosts = [], venues = [] } = {},
  query = '',
  limit = 6,
) {
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) return { events: [], hosts: [], venues: [] };
  const max = normalizeGuestDiscoveryLimit(limit, 6, 50);
  const score = (haystack, secondary = 0) => {
    const text = String(haystack || '').toLowerCase();
    if (!text) return -1;
    if (text === needle) return 1000 + secondary;
    if (text.startsWith(needle)) return 800 + secondary;
    if (text.includes(needle)) return 500 + secondary;
    return -1;
  };
  const rank = (items, text, secondary) =>
    items
      .map((item) => ({ item, score: score(text(item), secondary(item)) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((entry) => entry.item);

  return {
    events: rank(
      events.filter((item) => item.visibility === 'public'),
      (item) => item.searchText || '',
      (item) => Number(item.heatScore || 0),
    ),
    hosts: rank(
      hosts.filter((item) => item.visibility === 'public'),
      (item) => item.searchText || '',
      (item) => Number(item.followersCount || 0),
    ),
    venues: rank(
      venues.filter((item) => item.visibility === 'public'),
      (item) => item.searchText || '',
      (item) => Number(item.followersCount || 0),
    ),
  };
}

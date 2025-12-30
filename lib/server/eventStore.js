import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { events as seedEvents } from "../../data/events";

const EVENT_COLLECTION = "events";
const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Pune";

const fallbackCategories = [
  "Parties",
  "Fitness",
  "Art",
  "Fashion",
  "Tech",
  "Popups",
  "Campus",
  "Afters",
  "Community",
  "Culinary",
  "Health & Wellness",
  "Music",
  "Events",
  "Connections"
];

const cityKeywords = [
  { city: "Pune", matchers: ["pune", "kp", "koregaon", "baner", "fc road", "viman", "yerawada", "mula", "kalyani", "magarpatta"], fallback: true },
  { city: "Mumbai", matchers: ["mumbai", "bandra", "andheri", "juhu", "lower parel", "powai", "colaba"] },
  { city: "Bengaluru", matchers: ["bangalore", "bengaluru", "blr", "koramangala", "indiranagar", "hsr"], label: "Bengaluru" },
  { city: "Goa", matchers: ["goa", "anjuna", "morjim", "panaji", "panjim"] }
];

const duplicateEvent = (event) => ({
  ...event,
  guests: Array.isArray(event.guests) ? [...event.guests] : [],
  gallery: Array.isArray(event.gallery) ? [...event.gallery] : [],
  tickets: Array.isArray(event.tickets) ? event.tickets.map((ticket, index) => ({ id: `ticket-${index}`, ...ticket })) : []
});

// Use a function to get fresh fallback events to avoid state pollution/memory leaks
// Fix: Memory Leak / State Pollution (Issue #8)
const getFallbackEvents = () => seedEvents.map(duplicateEvent);

const findFallbackEvent = (identifier) => {
  const events = getFallbackEvents();
  return events.find((event) => event.id === identifier || event.slug === identifier);
};

const resolveStartingPrice = (event) => {
  if (typeof event.startingPrice === "number") return event.startingPrice;
  if (typeof event.priceRange?.min === "number") return event.priceRange.min;
  if (Array.isArray(event.tickets) && event.tickets.length) {
    return event.tickets.reduce((min, ticket) => Math.min(min, Number(ticket.price) || 0), Number.MAX_SAFE_INTEGER);
  }
  return Number.MAX_SAFE_INTEGER;
};

const fallbackSorters = {
  heat: (a, b) => (b.heatScore ?? b.stats?.heatScore ?? 0) - (a.heatScore ?? a.stats?.heatScore ?? 0),
  new: (a, b) => new Date(b.createdAt || b.stats?.createdAt || 0) - new Date(a.createdAt || a.stats?.createdAt || 0),
  soonest: (a, b) => new Date(a.startDateTime || a.startDate || 0) - new Date(b.startDateTime || b.startDate || 0),
  price: (a, b) => resolveStartingPrice(a) - resolveStartingPrice(b)
};

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry.trim() : entry)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const formatDateRange = (start, end) => {
  if (!start) return "";
  const formatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", month: "short", day: "numeric" });
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const safeFormat = (date, fallback) => {
    if (!(date instanceof Date) || Number.isNaN(date)) return fallback;
    return formatter.format(date);
  };
  const startLabel = safeFormat(startDate, start);
  if (!end) return startLabel;
  const endLabel = safeFormat(endDate, end);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} - ${endLabel}`;
};

const formatTimeRange = (start, end) => {
  if (!start && !end) return "";
  const formatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
  const safeFormat = (value) => {
    if (!value) return "";
    const date = new Date(`1970-01-01T${value}`);
    if (Number.isNaN(date)) return value;
    return formatter.format(date);
  };
  const startLabel = safeFormat(start);
  const endLabel = safeFormat(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel;
};

const getGradient = ({ gradientStart, gradientEnd }) => {
  if (gradientStart && gradientEnd) {
    return [gradientStart, gradientEnd];
  }
  return ["#0b0b0b", "#050505"];
};

const getAccent = (value) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "#ffffff";
};

const toIsoDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return new Date(value).toISOString();
};

const formatTickets = (tickets, fallbackName, fallbackPrice, startDate) => {
  const normalize = (ticket, index) => {
    const quantity = Number(ticket.quantity) || 0;
    const price = Number(ticket.price) || 0;
    return {
      id: ticket.id || `ticket-${index + 1}`,
      name: ticket.name?.trim() || `Ticket Tier ${index + 1}`,
      description: ticket.description?.trim() || "",
      price,
      quantity,
      isFree: price === 0,
      salesStart: ticket.salesStart || startDate || "",
      salesEnd: ticket.salesEnd || "",
      minPerOrder: Number(ticket.minPerOrder) || 1,
      maxPerOrder: Number(ticket.maxPerOrder) || Math.max(quantity, 1),
      rsvpOnly: Boolean(ticket.rsvpOnly)
    };
  };

  if (Array.isArray(tickets) && tickets.length) {
    return tickets.map(normalize);
  }

  return [
    normalize(
      {
        id: "default-ticket",
        name: fallbackName || "Default Ticket",
        price: Number(fallbackPrice) || 0,
        quantity: 0
      },
      0
    )
  ];
};

const derivePriceRange = (tickets) => {
  const prices = tickets.map((ticket) => Number(ticket.price) || 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    min,
    max,
    currency: "INR"
  };
};

const determineStatus = (start, end) => {
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : now;
  const endMs = end ? new Date(end).getTime() : startMs;
  if (now < startMs) return "upcoming";
  if (now >= startMs && now <= endMs) return "live";
  return "past";
};

const normalizeCityLabel = (value) => {
  if (!value) return "";
  return value.trim().toLowerCase();
};

const inferCity = (providedCity, location = "") => {
  if (providedCity) return providedCity;
  const combined = `${providedCity || ""} ${location}`.toLowerCase();
  for (const entry of cityKeywords) {
    if (entry.matchers.some((keyword) => combined.includes(keyword))) {
      return entry.city;
    }
  }
  const fallback = cityKeywords.find((entry) => entry.fallback);
  return fallback?.city || DEFAULT_CITY;
};

const calculateHeatScore = (event) => {
  const stats = event.stats || {};
  const guestsCount = Array.isArray(event.guests) ? event.guests.length : 0;
  const now = Date.now();
  const startMs = event.startDate ? new Date(event.startDate).getTime() : now;
  const hoursUntil = Math.max((startMs - now) / 36e5, 0);
  const recencyBoost = Math.max(168 - hoursUntil, 0); // 7 day window
  const guestBoost = guestsCount * 4;
  const rsvpBoost = (stats.rsvps || guestsCount) * 3;
  const viewsBoost = (stats.views || 0) * 0.1;
  const saveBoost = (stats.saves || 0) * 0.4;
  const shareBoost = (stats.shares || 0) * 0.8;
  return Math.round(recencyBoost + guestBoost + rsvpBoost + viewsBoost + saveBoost + shareBoost);
};

const listFallbackEvents = ({ city, limit = 12, sort = "heat", host } = {}) => {
  let events = getFallbackEvents();
  if (city) {
    const normalized = normalizeCityLabel(city);
    const cityMatches = events.filter((event) => normalizeCityLabel(event.city) === normalized);
    if (cityMatches.length) {
      events = cityMatches;
    }
  }

  if (host) {
    events = events.filter(e => e.host === host);
  }

  const comparator = fallbackSorters[sort] || fallbackSorters.heat;
  events.sort(comparator);
  return limit ? events.slice(0, limit) : events;
};

const buildEvent = (payload = {}) => {
  const required = ["title", "startDate", "location", "host"];
  const missing = required.filter((field) => !payload[field]);
  if (missing.length) {
    const error = new Error(`Missing fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const nowIso = new Date().toISOString();
  const startDate = toIsoDate(payload.startDate);
  const endDate = payload.endDate ? toIsoDate(payload.endDate) : startDate;
  const gallery = parseList(payload.gallery);
  const guests = parseList(payload.guests);
  const tags = parseList(payload.tags || payload.features);
  const gradient = getGradient(payload);
  const accentColor = getAccent(payload.accentColor);
  const tickets = formatTickets(payload.tickets, payload.ticketName, payload.ticketPrice, startDate);
  const priceRange = derivePriceRange(tickets);
  const stats = {
    rsvps: Number(payload.stats?.rsvps) || guests.length * 3,
    views: Number(payload.stats?.views) || 0,
    saves: Number(payload.stats?.saves) || 0,
    shares: Number(payload.stats?.shares) || 0
  };
  const settings = {
    showExplore: payload.settings?.showExplore ?? true,
    password: payload.settings?.password ?? false,
    passwordCode: payload.settings?.passwordCode || payload.settings?.password_value || "",
    activity: payload.settings?.activity ?? true,
    recurring: payload.settings?.recurring ?? false,
    showGuestlist: payload.settings?.showGuestlist ?? false
  };

  const event = {
    id: payload.id?.trim() || randomUUID(),
    slug: payload.slug?.trim() || payload.id?.trim() || randomUUID(),
    title: payload.title.trim(),
    summary: payload.summary?.trim() || "",
    description: payload.description?.trim() || payload.summary?.trim() || "",
    category: payload.category?.trim() || "Trending",
    tags,
    host: payload.host.trim(),
    location: payload.location.trim(),
    venue: payload.venue?.trim() || "",
    city: inferCity(payload.city, payload.location),
    country: payload.country?.trim() || "India",
    date: formatDateRange(startDate, endDate),
    time: formatTimeRange(payload.startTime, payload.endTime),
    startDate,
    endDate,
    startTime: payload.startTime || "",
    endTime: payload.endTime || "",
    timezone: payload.timezone || payload.timeZone || "Asia/Kolkata",
    image: payload.image?.trim() || "/events/holi-edit.svg",
    gradient,
    accentColor,
    spotifyTrack: payload.spotifyTrack || "",
    guests: guests.length ? guests : ["New", "Guests"],
    gallery: gallery.length ? gallery : [payload.image?.trim() || "/events/holi-edit.svg"],
    tickets,
    priceRange,
    isFree: tickets.every((ticket) => ticket.isFree),
    settings: {
      ...settings,
      visibility: settings.password ? "password" : settings.showExplore ? "public" : "link"
    },
    stats,
    createdAt: payload.createdAt || nowIso,
    updatedAt: payload.updatedAt || nowIso
  };

  // Generate search keywords
  const searchString = `${event.title} ${event.category} ${event.tags.join(" ")} ${event.host} ${event.location} ${event.venue}`.toLowerCase();
  // Create unique keywords array (simple tokenization)
  event.keywords = Array.from(new Set(searchString.split(/[\s,]+/).filter(k => k.length > 2)));

  event.status = determineStatus(event.startDate, event.endDate);
  event.heatScore = calculateHeatScore(event);
  return event;
};

const createFallbackEvent = (payload) => {
  // Fix: "Toy Mode". Removed 'true || ' from global scope, here we just return the object for dev.
  const event = buildEvent(payload);
  return event;
};

const mapEventDocument = (doc) => {
  const data = doc.data();
  // Fix: Security: Clean sensitive data (Issue #1 Security: Critical Data Leak)
  const safeSettings = data.settings ? { ...data.settings } : {};
  if (safeSettings.passwordCode) delete safeSettings.passwordCode;

  return {
    id: doc.id,
    ...data,
    settings: safeSettings,
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt)
  };
};

const seedEventPayload = (seed, index) => {
  const now = Date.now();
  const start = new Date(now + index * 36e5 * 24).toISOString();
  const end = new Date(now + index * 36e5 * 24 + 4 * 36e5).toISOString();
  return {
    ...seed,
    startDate: start,
    endDate: end,
    startTime: "19:00",
    endTime: "23:59",
    summary: seed.description?.slice(0, 140) || "",
    tickets: seed.tickets || [
      {
        id: "seed-ga",
        name: "General Admission",
        price: 0,
        quantity: 150
      }
    ]
  };
};

const ensureSeedEvents = async () => {
  if (!isFirebaseConfigured()) return;
  const db = getAdminDb();
  // We should NOT assume seeding on every request for performance.
  // This function is kept for explicit initialization but removed from read path (Issue #6 The "Seed Check" Performance Tax)
  const snapshot = await db.collection(EVENT_COLLECTION).limit(1).get();
  if (!snapshot.empty) return;

  const batch = db.batch();
  seedEvents.map(duplicateEvent).forEach((seed, index) => {
    const event = buildEvent(seedEventPayload(seed, index));
    const ref = db.collection(EVENT_COLLECTION).doc(event.id);
    batch.set(ref, event);
  });
  await batch.commit();
};

export async function listEvents({ city, limit = 12, sort = "heat", search, host } = {}) {
  // Fix: Hardcoded "Toy Mode" check (Issue #2 The App is Hardcoded to "Toy Mode")
  if (!isFirebaseConfigured()) {
    let results = listFallbackEvents({ city, limit: 1000, sort, host });
    if (search) {
      const lowerSearch = search.toLowerCase();
      results = results.filter(e =>
        e.title.toLowerCase().includes(lowerSearch) ||
        e.location.toLowerCase().includes(lowerSearch) ||
        e.host.toLowerCase().includes(lowerSearch)
      );
    }
    return limit ? results.slice(0, limit) : results;
  }

  const db = getAdminDb();
  // Fix: Removed ensureSeedEvents() call from read path (Issue #6)

  let query = db.collection(EVENT_COLLECTION);

  // Fix: Broken Data Visibility (Issue #1) - Address "Silent Failure" by filtering at DB level
  if (host) {
    query = query.where("host", "==", host);
  }

  // Apply City Filter
  if (city) {
    // Note: This requires composite index [host, city] if both used
    query = query.where("city", "==", inferCity(city));
  }

  // Apply search filter if present (Note: Firestore limitations apply)
  if (search) {
    const searchTerms = search.toLowerCase().split(" ").filter(t => t.length > 0);
    if (searchTerms.length > 0) {
      // Use array-contains for the first term (Issue #9 Missing Search Indexing - partial fix, real fix needs Typesense)
      query = query.where("keywords", "array-contains", searchTerms[0]);
    }
  } else {
    // Only apply sort if we are NOT searching (or have indexes).
    const ordering = {
      heat: { field: "heatScore", direction: "desc" },
      new: { field: "createdAt", direction: "desc" },
      soonest: { field: "startDate", direction: "asc" },
      price: { field: "priceRange.min", direction: "asc" }
    };
    const order = ordering[sort] || ordering.heat;
    query = query.orderBy(order.field, order.direction);
  }

  const baseLimit = Math.max(limit || 12, 12);
  const snapshot = await query.limit(baseLimit).get();
  let events = snapshot.docs.map(mapEventDocument);

  // Post-filter for city (safety net if index missing or case mismatch)
  if (city) {
    const normalized = normalizeCityLabel(city);
    events = events.filter((event) => normalizeCityLabel(event.city) === normalized);
  }

  // Additional in-memory search refinement if multiple terms
  if (search) {
    const lowerSearch = search.toLowerCase();
    events = events.filter(e =>
      e.title.toLowerCase().includes(lowerSearch) ||
      e.keywords?.some(k => lowerSearch.includes(k))
    );
  }

  return limit ? events.slice(0, limit) : events;
}

export async function createEvent(payload) {
  if (!isFirebaseConfigured()) {
    return createFallbackEvent(payload);
  }
  const db = getAdminDb();
  const event = buildEvent(payload);
  await db.collection(EVENT_COLLECTION).doc(event.id).set(event);
  return event;
}

export function getCategoryFilters(events = []) {
  const unique = Array.from(
    new Set(
      events
        .map((event) => event.category)
        .filter(Boolean)
        .map((category) => category.trim())
    )
  );

  if (unique.length) return unique;
  return [...fallbackCategories];
}

export { DEFAULT_CITY, fallbackCategories };

export async function getEvent(identifier) {
  if (!identifier) return null;
  if (!isFirebaseConfigured()) {
    return findFallbackEvent(identifier);
  }
  const db = getAdminDb();
  // Fix: Removed ensureSeedEvents() call from read path

  const directDoc = await db.collection(EVENT_COLLECTION).doc(identifier).get();
  if (directDoc.exists) {
    return mapEventDocument(directDoc);
  }
  const slugSnapshot = await db
    .collection(EVENT_COLLECTION)
    .where("slug", "==", identifier)
    .limit(1)
    .get();
  if (!slugSnapshot.empty) {
    return mapEventDocument(slugSnapshot.docs[0]);
  }
  return findFallbackEvent(identifier);
}

export async function getEventInterested(eventId, limit = 20) {
  if (!eventId) return { count: 0, users: [] };

  if (!isFirebaseConfigured()) {
    const mockUsers = [
      { id: "u1", name: "Ari", handle: "@ari", color: "#FDE047", initials: "AR" },
      { id: "u2", name: "Dev", handle: "@dev", color: "#F43F5E", initials: "DV" },
      { id: "u3", name: "Ira", handle: "@ira", color: "#A855F7", initials: "IR" },
      { id: "u4", name: "Nia", handle: "@nia", color: "#38BDF8", initials: "NI" },
      { id: "u5", name: "Vik", handle: "@vik", color: "#34D399", initials: "VK" }
    ];
    return { count: 622, users: mockUsers };
  }

  const db = getAdminDb();
  const eventDoc = await db.collection(EVENT_COLLECTION).doc(eventId).get();
  const eventData = eventDoc.exists ? eventDoc.data() : {};
  const count = eventData.stats?.saves || 0;

  const likesSnapshot = await db.collection("likes")
    .where("eventId", "==", eventId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const userIds = likesSnapshot.docs.map(doc => doc.data().userId);
  if (userIds.length === 0) return { count, users: [] };

  // Fetch user details
  const usersSnapshot = await Promise.all(userIds.map(uid => db.collection("users").doc(uid).get()));
  const users = usersSnapshot
    .filter(s => s.exists)
    .map(s => {
      const d = s.data();
      return {
        id: s.id,
        name: d.displayName || "C1RCLE Member",
        handle: d.handle || `@${(d.displayName || "guest").toLowerCase().replace(/\s/g, "")}`,
        photoURL: d.photoURL || null,
        initials: (d.displayName || "G").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      };
    });

  return { count, users };
}

export async function getEventGuestlist(eventId, limit = 50) {
  if (!eventId) return [];

  if (!isFirebaseConfigured()) {
    return [
      { id: "g1", name: "Luna", handle: "@luna", stats: "12 events", color: "#FDE047", initials: "LU" },
      { id: "g2", name: "Taj", handle: "@taj", stats: "8 events", color: "#F43F5E", initials: "TA" }
    ];
  }

  const db = getAdminDb();

  // 1. Get Ticket Buyers (Orders)
  const ordersSnapshot = await db.collection("orders")
    .where("eventId", "==", eventId)
    .where("status", "==", "confirmed")
    .limit(limit)
    .get();

  const buyerIds = Array.from(new Set(ordersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean)));

  // 2. Get RSVPs (Users)
  const usersSnapshot = await db.collection("users")
    .where("attendedEvents", "array-contains", eventId)
    .limit(limit)
    .get();

  const rsvpUsers = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Combine and deduplicate
  const combinedUserIds = Array.from(new Set([
    ...buyerIds,
    ...rsvpUsers.map(u => u.id)
  ])).slice(0, limit);

  // Fetch full profiles
  const profiles = await Promise.all(combinedUserIds.map(async (uid) => {
    const existing = rsvpUsers.find(u => u.id === uid);
    if (existing) return existing;
    const fresh = await db.collection("users").doc(uid).get();
    return fresh.exists ? { id: fresh.id, ...fresh.data() } : null;
  }));

  return profiles.filter(Boolean).map(p => ({
    id: p.id,
    name: p.displayName || "C1RCLE Member",
    handle: p.handle || `@${(p.displayName || "guest").toLowerCase().replace(/\s/g, "")}`,
    photoURL: p.photoURL || null,
    initials: (p.displayName || "G").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
    stats: `${(p.attendedEvents?.length || 0)} events attended`
  }));
}

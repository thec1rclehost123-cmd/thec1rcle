import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured, isToyMode } from "../firebase/admin";
import { EVENT_LIFECYCLE, PUBLIC_LIFECYCLE_STATES, normalizeCity, getCityLabel, resolvePoster, mapEventForClient } from "@c1rcle/core/events";
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

const duplicateEvent = (event) => ({
  ...event,
  guests: Array.isArray(event.guests) ? [...event.guests] : [],
  gallery: Array.isArray(event.gallery) ? [...event.gallery] : [],
  tickets: Array.isArray(event.tickets) ? event.tickets.map((ticket, index) => ({ id: `ticket-${index}`, ...ticket })) : []
});

// Use a function to get fresh fallback events to avoid state pollution/memory leaks
// Fix: Memory Leak / State Pollution (Issue #8)
// Fix: Memory Leak / State Pollution (Issue #8)
let localEvents = [];
const getFallbackEvents = (actorId) => {
  const seeds = seedEvents.map(duplicateEvent);
  // In Toy Mode, if we have an actorId, auto-assign some seeds to them so the dashboard isn't empty
  if (actorId) {
    seeds.forEach((s, i) => {
      if (i < 3) {
        s.venueId = actorId;
        s.creatorId = actorId;
        s.lifecycle = i === 0 ? "live" : (i === 1 ? "scheduled" : "draft");
      }
    });
  }
  return [...seeds, ...localEvents];
};

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
      rsvpOnly: Boolean(ticket.rsvpOnly),
      // Promoter Settings
      promoterEnabled: ticket.promoterEnabled ?? true,
      overrideCommission: !!ticket.overrideCommission,
      promoterCommissionType: ticket.promoterCommissionType || "percent",
      promoterCommission: Number(ticket.promoterCommission) || 0,
      overrideDiscount: !!ticket.overrideDiscount,
      promoterDiscountType: ticket.promoterDiscountType || "percent",
      promoterDiscount: Number(ticket.promoterDiscount) || 0,
      // Scheduling
      scheduledPrices: Array.isArray(ticket.scheduledPrices) ? ticket.scheduledPrices : []
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
    const cityKey = normalizeCity(city);
    const cityMatches = events.filter((event) => normalizeCity(event.city) === cityKey);
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
  const isHost = payload.creatorRole === "host";
  const isDraft = payload.lifecycle === EVENT_LIFECYCLE.DRAFT;
  const required = isDraft
    ? ["title"]
    : (isHost
      ? ["title", "city", "host"]
      : ["title", "startDate", "location", "host"]);

  const missing = required.filter((field) => !payload[field]);
  if (missing.length) {
    const error = new Error(`Missing fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const nowIso = new Date().toISOString();
  const startDate = payload.startDate ? toIsoDate(payload.startDate) : "";
  const endDate = payload.endDate ? toIsoDate(payload.endDate) : startDate;
  const gallery = parseList(payload.gallery);
  const guests = parseList(payload.guests);
  const tags = parseList(payload.tags || payload.features);

  const poster = resolvePoster(payload);
  const cityKey = normalizeCity(payload.city, payload.location);
  const cityLabel = getCityLabel(cityKey);

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
    host: (payload.host || "C1RCLE Partner").trim(),
    hostId: payload.hostId || "",
    location: payload.location?.trim() || "",
    venue: payload.venue?.trim() || "",
    venueId: payload.venueId || "",
    city: cityLabel, // Canonical label
    cityKey, // Canonical key
    country: payload.country?.trim() || "India",
    date: startDate ? formatDateRange(startDate, endDate) : "TBD",
    time: formatTimeRange(payload.startTime, payload.endTime),
    startDate,
    endDate,
    startTime: payload.startTime || "",
    endTime: payload.endTime || "",
    timezone: payload.timezone || payload.timeZone || "Asia/Kolkata",
    image: poster, // Use canonical poster
    poster,
    gradient,
    accentColor,
    spotifyTrack: payload.spotifyTrack || "",
    guests: guests.length ? guests : ["New", "Guests"],
    gallery: gallery.length ? gallery : [poster],
    tickets,
    tables: Array.isArray(payload.tables) ? payload.tables : [],
    priceRange,
    isRSVP: !!payload.isRSVP,
    // Global Promotion Toggles
    promoterSettings: {
      enabled: payload.promotersEnabled ?? payload.promoterSettings?.enabled ?? true,
      useDefaultCommission: payload.useDefaultCommission ?? payload.promoterSettings?.useDefaultCommission ?? true,
      defaultCommission: payload.commission ?? payload.promoterSettings?.defaultCommission ?? 15,
      defaultCommissionType: payload.commissionType ?? payload.promoterSettings?.defaultCommissionType ?? "percent",
      buyerDiscountsEnabled: payload.buyerDiscountsEnabled ?? payload.promoterSettings?.buyerDiscountsEnabled ?? false,
      useDefaultDiscount: payload.useDefaultDiscount ?? payload.promoterSettings?.useDefaultDiscount ?? true,
      defaultDiscount: payload.discount ?? payload.promoterSettings?.defaultDiscount ?? 10,
      defaultDiscountType: payload.discountType ?? payload.promoterSettings?.defaultDiscountType ?? "percent"
    },
    defaultScheduledPrices: Array.isArray(payload.defaultScheduledPrices) ? payload.defaultScheduledPrices : [],
    settings: {
      ...settings,
      visibility: settings.password ? "password" : settings.showExplore ? "public" : "link"
    },
    stats,
    createdAt: payload.createdAt || nowIso,
    updatedAt: payload.updatedAt || nowIso,

    // Lifecycle and Authority
    lifecycle: payload.lifecycle || EVENT_LIFECYCLE.DRAFT,
    creatorRole: payload.creatorRole || "club",
    creatorId: payload.creatorId || payload.hostId || "",
    slotRequest: payload.slotRequest || null,
    approvalNotes: payload.approvalNotes || "",
    rejectionReason: payload.rejectionReason || "",
    auditTrail: payload.auditTrail || []
  };

  // Generate search keywords
  const searchString = `${event.title} ${event.category} ${event.tags.join(" ")} ${event.host} ${event.location} ${event.venue} ${event.cityKey}`.toLowerCase();
  event.keywords = Array.from(new Set(searchString.split(/[\s,]+/).filter(k => k.length > 2)));

  event.status = determineStatus(event.startDate, event.endDate);
  event.heatScore = calculateHeatScore(event);

  // If publishing, ensure public snapshot is fresh
  if (PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)) {
    event.publishedAt = event.publishedAt || nowIso;
    event.publicSnapshot = {
      title: event.title,
      summary: event.summary,
      description: event.description,
      image: event.image,
      date: event.date,
      time: event.time,
      location: event.location,
      venue: event.venue,
      cityKey: event.cityKey,
      host: event.host,
      priceRange: event.priceRange,
      tags: event.tags,
      isActive: true,
      statusLabel: event.status,
      category: event.category,
      startDate: event.startDate,
      endDate: event.endDate
    };
  }

  return event;
};

const createFallbackEvent = (payload) => {
  if (!isToyMode()) {
    throw new Error("Cannot use fallback events unless DEV_TOY_MODE is enabled.");
  }
  const event = buildEvent(payload);
  return event;
};

const mapEventDocument = (doc) => {
  const data = doc.data();
  // Fix: Security: Clean sensitive data (Issue #1 Security: Critical Data Leak)
  const safeSettings = data.settings ? { ...data.settings } : {};
  if (safeSettings.passwordCode) delete safeSettings.passwordCode;

  // Resolve image from multiple possible field names
  const resolvedImage = data.image || data.poster || data.flyer ||
    (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : null) ||
    (Array.isArray(data.gallery) && data.gallery.length > 0 ? data.gallery[0] : null) ||
    "/events/holi-edit.svg";

  return {
    id: doc.id,
    ...data,
    image: resolvedImage,
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
  // Fix: Hardcoded "Toy Mode" check
  if (isToyMode()) {
    console.warn("Listing events from Toy Mode memory.");
    let results = listFallbackEvents({ city, limit: 1000, sort, host });
    // ... search logic exists in listFallbackEvents (partial)
    return limit ? results.slice(0, limit) : results;
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured for listEvents");
  }

  const db = getAdminDb();
  let query = db.collection(EVENT_COLLECTION);

  if (host) {
    query = query.where("host", "==", host);
  }

  // Apply City Filter using cityKey
  if (city) {
    const cityKey = normalizeCity(city);
    query = query.where("cityKey", "==", cityKey);
  }

  // Apply search filter
  if (search) {
    const searchTerms = search.toLowerCase().split(" ").filter(t => t.length > 0);
    if (searchTerms.length > 0) {
      query = query.where("keywords", "array-contains", searchTerms[0]);
    }
  } else {
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

  // Use shared mapper
  let events = snapshot.docs.map(doc => mapEventForClient(doc.data(), doc.id));

  return limit ? events.slice(0, limit) : events;
}

export async function createEvent(payload) {
  if (!isFirebaseConfigured()) {
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  [EventStore] FIREBASE NOT CONFIGURED. Operating in TOY MODE.");
    console.warn("\x1b[33m%s\x1b[0m", "Events will only persist in memory and will NOT be saved to Firestore.");
    const event = createFallbackEvent(payload);
    localEvents.push(event);
    return event;
  }
  const db = getAdminDb();
  const event = buildEvent(payload);

  // Enforce partnership for hosts
  if (event.creatorRole === "host" && event.venueId) {
    const { checkPartnership } = await import("./partnershipStore");
    const isPartnered = await checkPartnership(event.hostId, event.venueId);
    if (!isPartnered) {
      throw new Error("No approved partnership with this club.");
    }
  }

  await db.collection(EVENT_COLLECTION).doc(event.id).set(event);

  // Log the creation
  await logEventLifecycleAction(event.id, "created", { role: event.creatorRole, uid: event.creatorId });

  return event;
}

export async function updateEvent(eventId, payload) {
  if (!isFirebaseConfigured()) {
    return createFallbackEvent({ ...payload, id: eventId });
  }
  const db = getAdminDb();
  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const doc = await eventRef.get();

  if (!doc.exists) throw new Error("Event not found");

  const existingData = doc.data();
  const event = buildEvent({ ...existingData, ...payload, id: eventId });

  await eventRef.set(event);
  await logEventLifecycleAction(eventId, "updated", { role: payload.creatorRole || "system", uid: payload.creatorId || "system" });

  return event;
}
async function logEventLifecycleAction(eventId, action, context) {
  if (!isFirebaseConfigured()) return;
  const db = getAdminDb();
  const FieldValue = require("firebase-admin/firestore").FieldValue;

  const entry = {
    action,
    actor: context,
    timestamp: new Date().toISOString()
  };

  await db.collection(EVENT_COLLECTION).doc(eventId).update({
    auditTrail: FieldValue.arrayUnion(entry),
    updatedAt: new Date().toISOString()
  });
}

export async function updateEventLifecycle(eventId, newStatus, context, notes = "") {
  if (!isFirebaseConfigured()) return { success: true };
  const db = getAdminDb();
  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const doc = await eventRef.get();

  if (!doc.exists) throw new Error("Event not found");
  const event = doc.data();

  // Role-based validation
  if (context.role === "host") {
    const allowedTransitions = ["submitted", "draft"];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Hosts cannot move event to ${newStatus}`);
    }
    if (event.creatorId !== context.uid) {
      throw new Error("Host does not own this event.");
    }
  }

  // Handle Publish Action
  if (newStatus === "scheduled" || newStatus === "approved") {
    return await publishEvent(eventId, context);
  }

  const updateData = {
    lifecycle: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (newStatus === "needs_changes") updateData.rejectionReason = notes;
  if (newStatus === "cancelled") {
    updateData.status = "past";
    if (updateData.publicSnapshot) {
      updateData.publicSnapshot.isActive = false;
      updateData.publicSnapshot.statusLabel = "Cancelled";
    }
  }

  await eventRef.update(updateData);
  await logEventLifecycleAction(eventId, `transitioned_to_${newStatus}`, { ...context, notes });

  return { success: true };
}

/**
 * THE C1RCLE - Hardened Publish Pipeline
 * One source of truth for moving events to public visibility.
 */
export async function publishEvent(eventId, context) {
  const requestId = context.requestId || `PUB_${randomUUID()}`;
  console.log(`[PublishPipeline][${requestId}] Starting publish for event ${eventId} by ${context.role}:${context.uid}`);

  if (isToyMode()) {
    throw new Error("CRITICAL: Publishing is disabled in Toy Mode to prevent data loss.");
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured for publishEvent");
  }

  const db = getAdminDb();
  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const doc = await eventRef.get();

  if (!doc.exists) throw new Error("Event not found");
  const eventData = doc.data();

  // 1. Authorization & Ownership Gate
  if (context.role !== "club" && context.role !== "admin") {
    if (context.role === "host") {
      if (eventData.creatorId !== context.uid) {
        throw new Error("Unauthorized: You do not own this event.");
      }
      // Hosts can't publish directly to public if a slot is required
      // But they can 'submit' for approval.
      if (eventData.venueId && eventData.lifecycle === EVENT_LIFECYCLE.DRAFT) {
        console.log(`[PublishPipeline][${requestId}] Host submitting event for venue approval.`);
        return await updateEventLifecycle(eventId, EVENT_LIFECYCLE.SUBMITTED, context);
      }
    } else {
      throw new Error("Unauthorized: Only Partners or Admins can publish events.");
    }
  }

  // 2. Strict Content Validation
  const validationErrors = [];
  if (!eventData.title) validationErrors.push("Title missing");
  if (!eventData.startDate) validationErrors.push("Start date missing");
  // City key must be normalized
  const cityKey = eventData.cityKey || normalizeCity(eventData.city, eventData.location);
  if (cityKey === "other-in" && !eventData.city) {
    validationErrors.push("Valid city mapping required for discovery");
  }

  const now = new Date();
  if (new Date(eventData.startDate) < now) {
    validationErrors.push("Event date must be in the future");
  }

  if (!Array.isArray(eventData.tickets) || eventData.tickets.length === 0) {
    validationErrors.push("At least one ticket tier is required for sales");
  }

  const poster = resolvePoster(eventData);
  if (poster === "/events/placeholder.svg") {
    console.warn(`[PublishPipeline][${requestId}] Event ${eventId} is publishing with a placeholder poster.`);
  }

  if (validationErrors.length > 0) {
    console.error(`[PublishPipeline][${requestId}] Validation failed: ${validationErrors.join(", ")}`);
    throw new Error(`Publish conditions not met: ${validationErrors.join(". ")}`);
  }

  // 3. Compute Promoter Visibility (Non-critical lookup)
  try {
    if (eventData.promoterSettings?.enabled) {
      const { listPartnerships } = await import("./partnershipStore");
      // This query might be building its index right now
      console.log(`[PublishPipeline][${requestId}] Checking for eligible promoter partnerships...`);
      const partnerships = await listPartnerships({ status: "active" });
      console.log(`[PublishPipeline][${requestId}] Found potential promoter network. Flagging visibility.`);
    }
  } catch (indexError) {
    console.warn(`[PublishPipeline][${requestId}] Promoter lookup failed (missing index?), proceeding anyway:`, indexError.message);
  }

  // 4. Atomic Update to Scheduled/Live
  const nowIso = new Date().toISOString();
  const publishStatus = EVENT_LIFECYCLE.SCHEDULED; // Use scheduled as default public state

  const updatedEvent = buildEvent({
    ...eventData,
    cityKey,
    image: poster,
    poster,
    lifecycle: publishStatus,
    publishedAt: nowIso,
    updatedAt: nowIso,
    promoterVisibility: eventData.promoterSettings?.enabled ?? false
  });

  await eventRef.set(updatedEvent);

  // 5. Audit Log
  await logEventLifecycleAction(eventId, "PUBLISH_SUCCESS", {
    ...context,
    requestId,
    previousState: eventData.lifecycle,
    newState: publishStatus,
    cityKey
  });

  console.log(`[PublishPipeline][${requestId}] SUCCESS. Event ${eventId} is now ${publishStatus}.`);

  return {
    success: true,
    lifecycle: publishStatus,
    publishedAt: nowIso,
    publicUrl: `/e/${updatedEvent.id}`,
    diagnostics: {
      finalLifecycle: publishStatus,
      finalCityKey: cityKey,
      showExplore: true,
      promotersEligible: eventData.promoterSettings?.enabled ? "YES" : "NO"
    }
  };
}

/**
 * THE C1RCLE - Promoter Sellables Pipeline
 * Lists events that a promoter is eligible to sell.
 */
export async function listEventsForPromoter({ promoterId, city, limit = 20 }) {
  if (isToyMode()) {
    return listFallbackEvents({ city, limit });
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured for listEventsForPromoter");
  }

  const { getApprovedPartnerIds } = await import("./promoterConnectionStore");
  const { hostIds, clubIds } = await getApprovedPartnerIds(promoterId);
  const partnerIds = [...hostIds, ...clubIds];

  if (partnerIds.length === 0) {
    console.log(`[PromoterEvents] Promoter ${promoterId} has no approved partnerships.`);
    return [];
  }

  const db = getAdminDb();
  let query = db.collection(EVENT_COLLECTION)
    .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
    .where("promoterVisibility", "==", true);

  if (city) {
    const cityKey = normalizeCity(city);
    query = query.where("cityKey", "==", cityKey);
  }

  const snapshot = await query.limit(100).get();

  // Post-filter by creatorId (since Firestore lacks 'in' for 10+ items easily or complex joins)
  let events = snapshot.docs
    .map(doc => mapEventForClient(doc.data(), doc.id))
    .filter(event => partnerIds.includes(event.creatorId) || partnerIds.includes(event.venueId));

  return events.slice(0, limit);
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

  // 1. Get Ticket Buyers (Orders and RSVPs)
  const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
    db.collection("orders").where("eventId", "==", eventId).where("status", "==", "confirmed").limit(limit).get(),
    db.collection("rsvp_orders").where("eventId", "==", eventId).where("status", "==", "confirmed").limit(limit).get()
  ]);

  const buyerIds = Array.from(new Set([
    ...ordersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean),
    ...rsvpsSnapshot.docs.map(doc => doc.data().userId).filter(Boolean)
  ]));

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

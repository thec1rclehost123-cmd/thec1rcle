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
      // Gender Entry Enforcement
      genderRequirement: ticket.genderRequirement || "any", // any, male, female, couple
      requiredGender: ticket.requiredGender || null, // male, female (for single slots)
      isCouple: ticket.isCouple || (ticket.genderRequirement === "couple") || false,
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
    : ((isHost || payload.creatorRole === 'club')
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
    location: (payload.location || payload.venueName || payload.venue || "").trim(),
    venue: (payload.venue || payload.venueName || payload.location || "").trim(),
    venueId: payload.venueId || "",
    promoterVisibility: payload.promotersEnabled ?? payload.promoterSettings?.enabled ?? true, // Top-level for indexing
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
    promoCodes: Array.isArray(payload.promoCodes) ? payload.promoCodes : [],
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
    isDeleted: payload.isDeleted ?? false,
    deletedAt: payload.deletedAt || null,
    deletedBy: payload.deletedBy || null,
    createdAt: payload.createdAt || nowIso,
    updatedAt: payload.updatedAt || nowIso,

    // Lifecycle and Authority
    lifecycle: payload.lifecycle || EVENT_LIFECYCLE.DRAFT,
    creatorRole: (payload.creatorRole === 'club' ? 'venue' : payload.creatorRole) || "venue",
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
      // Removed redundant description and image to stay under Firestore 1MB limit
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
  return mapEventForClient(doc.data(), doc.id);
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

export async function listEvents({ city, limit = 12, sort = "heat", search, host, venueId, creatorId, lifecycle, creatorRole } = {}) {
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
  let query = db.collection(EVENT_COLLECTION).where("isDeleted", "==", false);

  if (host) {
    query = query.where("host", "==", host);
  }

  if (creatorId) {
    query = query.where("creatorId", "==", creatorId);
  }

  // Apply City Filter using cityKey
  if (city) {
    const cityKey = normalizeCity(city);
    query = query.where("cityKey", "==", cityKey);
  }

  if (venueId) {
    query = query.where("venueId", "==", venueId);
  }

  if (lifecycle) {
    if (Array.isArray(lifecycle)) {
      query = query.where("lifecycle", "in", lifecycle);
    } else {
      query = query.where("lifecycle", "==", lifecycle);
    }
  }

  if (creatorRole) {
    query = query.where("creatorRole", "==", creatorRole);
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
      throw new Error("No approved partnership with this venue.");
    }
  }

  await db.collection(EVENT_COLLECTION).doc(event.id).set(event);

  // Sync promo codes to dedicated collection
  await syncPromoCodes(event.id, event.promoCodes, { uid: event.creatorId, role: event.creatorRole });

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

  // RBAC Enforcement
  const actorRole = (['club', 'venue', 'OWNER', 'MANAGER', 'OPS'].includes(payload.creatorRole) ? 'venue' : payload.creatorRole);
  const isCreatorDirect = existingData.creatorId === payload.creatorId;
  // Fallback: If creatorId was saved as partnerId, and we receive uid, or vice-versa
  const isCreatorIdMatch = isCreatorDirect || (payload.partnerId && existingData.creatorId === payload.partnerId);
  const isAdmin = actorRole === 'admin';
  const isVenue = actorRole === 'venue';
  const isSubmitted = existingData.lifecycle === 'submitted';

  // Ownership Check: Venue can edit anything belonging to them
  const isVenueOwner = isVenue && existingData.venueId === payload.partnerId;

  if (!isCreatorIdMatch && !isAdmin && !isVenueOwner) {
    // If not creator, admin, or venue owner, must be a venue member reviewing a submitted event
    // (This path is for a venue reviewing a SUBMITTED host event)
    if (!isVenue || !isSubmitted) {
      throw new Error(`Unauthorized: You do not have permission to edit this event. (Role: ${actorRole}, Status: ${existingData.lifecycle})`);
    }
  }

  // Enforce locking: Host cannot edit if submitted
  if (existingData.creatorRole === "host" && isSubmitted && !isVenue && !isAdmin) {
    throw new Error("Event is locked for club review. Cannot edit while submitted.");
  }

  const sanitizedPayload = {
    ...payload,
    creatorRole: actorRole // Ensure normalized role is saved
  };

  const event = buildEvent({ ...existingData, ...sanitizedPayload, id: eventId });

  await eventRef.set(event);

  // Sync promo codes to dedicated collection
  await syncPromoCodes(eventId, event.promoCodes, { uid: payload.creatorId || event.creatorId, role: payload.creatorRole || event.creatorRole });

  await logEventLifecycleAction(eventId, "updated", { role: payload.creatorRole || "system", uid: payload.creatorId || "system" });

  return event;
}

/**
 * Soft delete an event
 */
export async function deleteEvent(eventId, actor) {
  if (!isFirebaseConfigured()) {
    const idx = localEvents.findIndex(e => e.id === eventId);
    if (idx !== -1) localEvents.splice(idx, 1);
    return { success: true };
  }
  const db = getAdminDb();
  const eventRef = db.collection(EVENT_COLLECTION).doc(eventId);
  const doc = await eventRef.get();

  if (!doc.exists) throw new Error("Event not found");
  const data = doc.data();

  // Authorization: Only creator or admin can delete
  if (data.creatorId !== actor.uid && actor.role !== 'admin') {
    throw new Error("Unauthorized to delete this event");
  }

  const now = new Date().toISOString();
  await eventRef.update({
    isDeleted: true,
    lifecycle: 'deleted',
    deletedAt: now,
    deletedBy: actor.uid,
    updatedAt: now
  });

  await logEventLifecycleAction(eventId, "deleted", actor);

  return { success: true };
}

/**
 * Sync promo codes from event to dedicated collections
 */
async function syncPromoCodes(eventId, promoCodes, context) {
  if (!Array.isArray(promoCodes) || !promoCodes.length) return;

  try {
    const { upsertPromoCode } = await import("@c1rcle/core/promo-service");

    for (const codeData of promoCodes) {
      if (!codeData.code) continue;

      await upsertPromoCode(eventId, codeData, {
        uid: context?.uid || "system",
        name: context?.name || "System",
        role: context?.role || "admin"
      });
    }
  } catch (err) {
    console.error("Failed to sync promo codes:", err);
  }
}

async function logEventLifecycleAction(eventId, action, context) {
  if (!isFirebaseConfigured()) return;
  const db = getAdminDb();
  const FieldValue = require("firebase-admin/firestore").FieldValue;

  const { uid, role, email, name, notes, ...details } = context;
  const actor = { uid, role, email, name };

  const entry = {
    action,
    actor,
    notes: notes || "",
    details: details || {},
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

  const actorRole = (['club', 'venue', 'OWNER', 'MANAGER', 'OPS'].includes(context.role) ? 'venue' : context.role);

  // Role-based validation
  if (actorRole === "host") {
    // Hosts can only submit or move back to draft
    const allowedTransitions = ["submitted", "draft"];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Hosts cannot move event to ${newStatus}`);
    }
    if (event.creatorId !== context.uid) {
      throw new Error("Host does not own this event.");
    }
    // Prevent edits if already submitted
    if (event.lifecycle === "submitted" && newStatus === "submitted") {
      return { success: true, alreadySubmitted: true };
    }
  }

  // Venue-specific rules: Venue events never need approval
  if (event.creatorRole === "venue" || event.creatorRole === "club") {
    if (newStatus === "submitted" || newStatus === "approved" || newStatus === "denied") {
      // If a club event is "approved" or "submitted", it just goes to scheduled/live
      console.log(`[Lifecycle] Venue event ${eventId} bypassing approval state. Moving to publish pipeline.`);
      return await publishEvent(eventId, context);
    }
  }

  // Handle Publish/Approval Action (Venue/Admin only)
  if (newStatus === "scheduled" || newStatus === "approved") {
    if (actorRole !== "venue" && actorRole !== "admin") {
      throw new Error(`Unauthorized: Only venues or admins can approve/publish events. (Current role: ${actorRole})`);
    }
    // Hard fail if trying to approve a club event using host-style approval
    if ((event.creatorRole === "venue" || event.creatorRole === "club") && newStatus === "approved") {
      return await publishEvent(eventId, context);
    }
    return await publishEvent(eventId, context);
  }

  const updateData = {
    lifecycle: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (newStatus === "needs_changes" || newStatus === "denied") {
    updateData.rejectionReason = notes;
    // updateData.lifecycle already has newStatus from line 712
  }

  if (newStatus === "submitted") {
    updateData.submittedAt = new Date().toISOString();

    // Ensure host events have a slot request on submission
    if (event.creatorRole === "host" && event.venueId && !event.slotRequest) {
      try {
        const { createSlotRequest } = await import("./slotStore");
        const slot = await createSlotRequest({
          eventId: eventId,
          hostId: event.creatorId,
          hostName: event.host,
          venueId: event.venueId,
          venueName: event.venue,
          requestedDate: event.startDate,
          requestedStartTime: event.startTime,
          requestedEndTime: event.endTime,
          notes: `Auto-generated on submission of event: ${event.title}`
        });
        updateData.slotRequest = { id: slot.id, status: slot.status };
      } catch (e) {
        console.error("Failed to create slot request during submission:", e);
      }
    }
  }

  if (newStatus === "cancelled") {
    updateData.status = "past";
    if (updateData.publicSnapshot) {
      updateData.publicSnapshot.isActive = false;
      updateData.publicSnapshot.statusLabel = "Cancelled";
    }

    // Release calendar slot if it exists
    if (event.venueId && event.startDate) {
      try {
        const { releaseCalendarSlot } = await import("./slotStore");
        const slotId = event.slotRequest?.id || event.slotRequestId;
        if (slotId) {
          await releaseCalendarSlot(event.venueId, event.startDate, slotId);
        }
      } catch (e) {
        console.error("Failed to release calendar slot during cancellation:", e);
      }
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

  const actorRole = (['club', 'venue', 'OWNER', 'MANAGER', 'OPS'].includes(context.role) ? 'venue' : context.role);

  // 1. Authorization & Ownership Gate
  if (actorRole !== "venue" && actorRole !== "admin") {
    if (actorRole === "host") {
      if (eventData.creatorId !== context.uid) {
        throw new Error("Unauthorized: You do not own this event.");
      }

      // Verification of Partnership
      const { checkPartnership } = await import("./partnershipStore");
      const isPartnered = await checkPartnership(eventData.creatorId, eventData.venueId);
      if (!isPartnered) {
        throw new Error("No active partnership with this club. Cannot publish event.");
      }

      // Hosts can't publish directly to public if it's for a venue
      if (eventData.venueId && eventData.lifecycle !== EVENT_LIFECYCLE.SUBMITTED) {
        // Special case: if it was already approved, allow re-publish
        if (eventData.lifecycle !== EVENT_LIFECYCLE.APPROVED && eventData.lifecycle !== EVENT_LIFECYCLE.SCHEDULED) {
          console.log(`[PublishPipeline][${requestId}] Host submitting event for venue approval.`);
          return await updateEventLifecycle(eventId, EVENT_LIFECYCLE.SUBMITTED, context);
        }
      }
    } else {
      throw new Error("Unauthorized: Only Partners or Admins can publish events.");
    }
  } else if (actorRole === "venue") {
    // Venue publishing a host event is actually an approval
    if (eventData.creatorRole === "host" && eventData.lifecycle !== EVENT_LIFECYCLE.SUBMITTED) {
      // if club tries to publish a host draft that wasn't submitted, maybe block it?
      // For now, allow it if they really want to, but normally it should be submitted.
    }
  }

  // 2. Strict Content Validation
  const validationErrors = [];

  if (!eventData.title || eventData.title.trim().length < 3) {
    validationErrors.push("Title must be at least 3 characters");
  } else if (eventData.title.toLowerCase().includes("untitled") || eventData.title.toLowerCase().includes("test event")) {
    validationErrors.push("Event title must be descriptive (cannot be 'Untitled' or 'Test Event')");
  }

  if (!eventData.startDate) {
    validationErrors.push("Event date is required for publication");
  }

  const location = (eventData.location || eventData.venue || eventData.venueName || "").trim();
  if (!location || location.toLowerCase() === "tbd" || location.length < 3) {
    validationErrors.push("A specific location or venue is required for publication");
  }

  if (!eventData.host || eventData.host.trim().length < 2) {
    validationErrors.push("Host name is required for publication");
  }

  // City key must be normalized
  const cityKey = eventData.cityKey || normalizeCity(eventData.city, eventData.location);
  if (cityKey === "other-in" && !eventData.city) {
    validationErrors.push("Valid city mapping required for discovery");
  }

  const now = new Date();
  if (eventData.startDate && new Date(eventData.startDate) < now) {
    validationErrors.push("Event date must be in the future");
  }

  if (!Array.isArray(eventData.tickets) || eventData.tickets.length === 0) {
    validationErrors.push("At least one ticket tier is required for sales");
  }

  const poster = resolvePoster(eventData);
  if (poster === "/events/placeholder.svg") {
    console.warn(`[PublishPipeline][${requestId}] Event ${eventId} is publishing with a placeholder poster.`);
  }

  // 3. Slot Request & Hold Verification (New Hardening)
  if (eventData.creatorRole === "host" && eventData.venueId) {
    console.log(`[PublishPipeline][${requestId}] Verifying slot hold for host event...`);
    const { getSlotRequest } = await import("./slotStore");

    // Find if there's an associated slot request
    // If not in eventData, we assume it's mandatory unless it's a legacy event
    let slotRequest = eventData.slotRequest;

    // If we don't have it explicitly, try to find one for this venue/date/host
    if (!slotRequest) {
      const slotSnap = await db.collection("slot_requests")
        .where("hostId", "==", eventData.creatorId)
        .where("venueId", "==", eventData.venueId)
        .where("requestedDate", "==", eventData.startDate)
        .where("status", "==", "approved")
        .limit(1)
        .get();

      if (!slotSnap.empty) {
        slotRequest = { id: slotSnap.docs[0].id, ...slotSnap.docs[0].data() };
      }
    } else if (typeof slotRequest === 'string') {
      slotRequest = await getSlotRequest(slotRequest);
    }

    if (!slotRequest || slotRequest.status !== 'approved') {
      // Hardening: If club is approving, we can auto-block the calendar to satisfy the system integrity
      if (context.role === 'venue' || context.role === 'admin') {
        console.log(`[PublishPipeline][${requestId}] Venue overrides missing hold. Checking for pending requests to resolve...`);
        const { updateCalendarSlot, listSlotRequests, approveSlotRequest } = await import("./slotStore");

        // Try to find a pending one to close the loop
        const pendings = await listSlotRequests({
          venueId: eventData.venueId,
          hostId: eventData.creatorId,
          status: 'pending'
        });
        const match = pendings.find(p => p.requestedDate === eventData.startDate);

        if (match) {
          console.log(`[PublishPipeline][${requestId}] Found matching pending slot request ${match.id}. Approving it...`);
          await approveSlotRequest(match.id, context, "Auto-approved via event dashboard", { skipLifecycleUpdate: true });
          slotRequest = match;
        } else {
          console.log(`[PublishPipeline][${requestId}] No pending request found. Creating direct calendar block.`);
          await updateCalendarSlot(eventData.venueId, eventData.startDate, {
            status: "booked",
            eventId: eventId,
            hostId: eventData.creatorId,
            startTime: eventData.startTime || "21:00",
            endTime: eventData.endTime || "03:00"
          });
          // Mocking slotRequest for the time-match check below
          slotRequest = {
            requestedStartTime: eventData.startTime,
            requestedEndTime: eventData.endTime,
            status: 'approved'
          };
        }
      } else {
        throw new Error("No approved hold found for this venue and date. Please request a slot first.");
      }
    }

    // Verify time matches
    if (slotRequest.requestedStartTime !== eventData.startTime || slotRequest.requestedEndTime !== eventData.endTime) {
      throw new Error(`Event time (${eventData.startTime}-${eventData.endTime}) must match the approved slot hold (${slotRequest.requestedStartTime}-${slotRequest.requestedEndTime}).`);
    }

    // Check expiry
    if (slotRequest.expiresAt && new Date(slotRequest.expiresAt) < new Date()) {
      throw new Error(`The approved hold for this slot has expired on ${new Date(slotRequest.expiresAt).toLocaleString()}. Please request another slot.`);
    }

    console.log(`[PublishPipeline][${requestId}] Slot hold verified successfully.`);
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
  const { hostIds, venueIds } = await getApprovedPartnerIds(promoterId);
  const partnerIds = [...hostIds, ...venueIds];

  if (partnerIds.length === 0) {
    console.log(`[PromoterEvents] Promoter ${promoterId} has no approved partnerships.`);
    return [];
  }

  const db = getAdminDb();
  let query = db.collection(EVENT_COLLECTION)
    .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
    .where("promoterVisibility", "==", true)
    .where("isDeleted", "==", false);

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
  const eventRef = db.collection(EVENT_COLLECTION).doc(identifier);

  const directDoc = await eventRef.get();
  if (directDoc.exists) {
    const data = directDoc.data();
    if (data.isDeleted) return null;
    return mapEventDocument(directDoc);
  }
  const slugSnapshot = await db
    .collection(EVENT_COLLECTION)
    .where("slug", "==", identifier)
    .where("isDeleted", "==", false)
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

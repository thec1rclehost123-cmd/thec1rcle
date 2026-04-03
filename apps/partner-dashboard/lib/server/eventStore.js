/**
 * Event Store — Direct Firebase Admin (no API gateway required)
 *
 * Previously delegated all calls to C1rcleApiClient → Fastify gateway at :4000.
 * Rewritten to use Firebase Admin + @c1rcle/core/event-engine directly so the
 * partner-dashboard works without the gateway running in dev.
 */

import { getAdminDb } from "../firebase/admin";
import { buildEvent, filterAndSortEvents } from "@c1rcle/core/event-engine";
import { mapEventForClient, buildPartnerSnapshot, resolvePartnerSnapshots } from "@c1rcle/core/events";

export const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Pune";

const EVENT_COLLECTION = "events";

function canPromoterAccessEvent(event = {}, promoterId) {
    const globallyEnabled = event.promotersEnabled === true || event.promoterSettings?.enabled === true;
    if (!globallyEnabled) return false;
    if (!promoterId) return true;

    const allowedPromoterIds = Array.isArray(event.promoterSettings?.allowedPromoterIds)
        ? event.promoterSettings.allowedPromoterIds.map((id) => String(id))
        : [];

    return allowedPromoterIds.length === 0 || allowedPromoterIds.includes(String(promoterId));
}

function normalizeTicketTier(tier = {}) {
    const entryType = String(tier.entryType || "general").toLowerCase();
    const explicitRequirement = String(
        tier.genderRequirement ||
        tier.requiredGender ||
        tier.gender ||
        ""
    ).toLowerCase();

    let genderRequirement = "any";
    if (explicitRequirement === "female" || explicitRequirement === "male" || explicitRequirement === "couple") {
        genderRequirement = explicitRequirement;
    } else if (entryType === "female") {
        genderRequirement = "female";
    } else if (entryType === "stag" || entryType === "male") {
        genderRequirement = "male";
    }

    return {
        ...tier,
        entryType,
        genderRequirement,
    };
}

function normalizeTicketCollections(payload = {}, built = {}) {
    const rawTiers = Array.isArray(payload.ticketTiers)
        ? payload.ticketTiers
        : (Array.isArray(payload.tickets) ? payload.tickets : null);
    const normalizedTiers = Array.isArray(rawTiers)
        ? rawTiers.map(normalizeTicketTier)
        : null;
    const normalizedCatalogTiers = Array.isArray(payload.ticketCatalog?.tiers)
        ? payload.ticketCatalog.tiers.map(normalizeTicketTier)
        : (normalizedTiers || null);

    return {
        ticketTiers: normalizedTiers || (Array.isArray(built.ticketTiers) ? built.ticketTiers.map(normalizeTicketTier) : undefined),
        tickets: normalizedTiers || (Array.isArray(built.tickets) ? built.tickets.map(normalizeTicketTier) : undefined),
        ticketCatalog: normalizedCatalogTiers
            ? {
                ...(built.ticketCatalog || payload.ticketCatalog || {}),
                tiers: normalizedCatalogTiers,
            }
            : undefined,
    };
}


/**
 * List events for the partner dashboard.
 * Queries Firestore directly; secondary filters applied client-side to avoid
 * composite index requirements.
 */
export async function listEvents({ city, limit, sort, search, host, venueId, lifecycle, creatorId, creatorRole } = {}, token) {
    const db = getAdminDb();
    let ref = db.collection(EVENT_COLLECTION);

    // Use a single equality filter as the primary Firestore predicate.
    // For host queries, also query by hostId to catch events created before the
    // creatorId bug fix (those have hostId=partnerId but creatorId=firebaseUid).
    let events;
    if (creatorId) {
        const [byCreator, byHost] = await Promise.all([
            ref.where("creatorId", "==", creatorId).limit(300).get(),
            ref.where("hostId", "==", creatorId).limit(300).get(),
        ]);
        const seen = new Set();
        events = [...byCreator.docs, ...byHost.docs]
            .filter(d => !seen.has(d.id) && seen.add(d.id))
            .map(d => ({ id: d.id, ...d.data() }));
    } else if (venueId) {
        const snapshot = await ref.where("venueId", "==", venueId).limit(300).get();
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (host) {
        const snapshot = await ref.where("host", "==", host).limit(300).get();
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
        const snapshot = await ref.limit(300).get();
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }


    // 2. Apply shared filtering and sorting
    const results = filterAndSortEvents(events, { city, sort, search, host });
    
    // 3. Final map for client (normalization)
    const mapped = results.map(e => mapEventForClient(e));

    if (limit) return { events: mapped.slice(0, limit), hasMore: false };
    return { events: mapped, hasMore: false, nextCursor: null };
}

/**
 * Get a single event by ID.
 */
export async function getEvent(eventId, token) {
    if (!eventId) return null;
    const db = getAdminDb();
    try {
        const doc = await db.collection(EVENT_COLLECTION).doc(eventId).get();
        if (!doc.exists) return null;
        return mapEventForClient(doc.data(), doc.id);
    } catch (error) {
        console.error("[EventStore] getEvent failed:", error.message);
        return null;
    }
}

/**
 * Create a new event.
 * Uses buildEvent() from @c1rcle/core/event-engine then writes to Firestore.
 * Preserves all partner-dashboard wizard fields not covered by buildEvent.
 */
export async function createEvent(payload, token) {
    const db = getAdminDb();

    const built = buildEvent(payload);
    const snapshots = await resolvePartnerSnapshots(db, payload);
    const normalizedTickets = normalizeTicketCollections(payload, built);
    const normalizedPoster =
        payload.coverImage ||
        payload.coverPhoto ||
        payload.poster ||
        payload.image ||
        payload.images?.[0] ||
        built.poster ||
        "";

    // Merge partner-dashboard wizard fields that buildEvent doesn't map
    const event = {
        ...built,
        startTime: payload.startTime || "",
        endTime: payload.endTime || "",
        doorsOpen: payload.doorsOpen || "",
        lastEntry: payload.lastEntry || "",
        artists: payload.artists || [],
        genres: payload.genres || [],
        dressCode: payload.dressCode || "",
        ageRestriction: payload.ageRestriction || payload.ageLimit || "",
        capacity: Number(payload.capacity) || 0,
        address: payload.address || "",
        pincode: payload.pincode || "",
        mapsLink: payload.mapsLink || "",
        arrivalInstructions: payload.arrivalInstructions || "",
        subtitle: payload.subtitle || "",
        venueName: payload.venueName || built.venue || "",
        promotersEnabled: payload.promotersEnabled ?? false,
        coverImage: normalizedPoster,
        coverPhoto: normalizedPoster,
        // Denormalized snapshots for guest-portal display (no extra reads)
        hostData: payload.hostData || snapshots.hostData || null,
        venueData: payload.venueData || snapshots.venueData || null,
        ...(normalizedTickets.ticketTiers ? { ticketTiers: normalizedTickets.ticketTiers } : {}),
        ...(normalizedTickets.tickets ? { tickets: normalizedTickets.tickets } : {}),
        ...(normalizedTickets.ticketCatalog ? { ticketCatalog: normalizedTickets.ticketCatalog } : {}),
        // Ensure endDate has a time component so guest-portal date range comparisons work correctly
        endDate: built.endDate && built.endDate.length === 10
            ? built.endDate + "T23:59:59.999Z"
            : built.endDate,
    };

    console.log("[debug] createEvent event.id:", event.id);
    if (!event.id || typeof event.id !== "string") {
        console.error("[Firestore] Invalid event.id in createEvent — using addDoc:", event.id);
        const docRef = await db.collection(EVENT_COLLECTION).add(event);
        event.id = docRef.id;
        // Patch the stored doc so data.id matches the actual document path
        await docRef.update({ id: docRef.id, slug: event.slug || docRef.id });
    } else {
        await db.collection(EVENT_COLLECTION).doc(event.id).set(event);
    }
    return mapEventForClient(event);
}

/**
 * Update an existing event.
 */
export async function updateEvent(eventId, payload, token) {
    console.log("[debug] updateEvent eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in updateEvent:", eventId);
        throw new Error("Invalid event ID — documentPath must be a non-empty string");
    }
    const db = getAdminDb();
    const snapshots = await resolvePartnerSnapshots(db, payload);
    const normalizedTickets = normalizeTicketCollections(payload, payload);
    const normalizedPoster =
        payload.coverImage ||
        payload.coverPhoto ||
        payload.poster ||
        payload.image ||
        payload.images?.[0] ||
        "";
    const updates = {
        ...payload,
        ...(normalizedPoster ? {
            coverImage: payload.coverImage || normalizedPoster,
            coverPhoto: payload.coverPhoto || normalizedPoster,
            poster: payload.poster || normalizedPoster,
            image: payload.image || normalizedPoster,
        } : {}),
        ...(normalizedTickets.ticketTiers ? { ticketTiers: normalizedTickets.ticketTiers } : {}),
        ...(normalizedTickets.tickets ? { tickets: normalizedTickets.tickets } : {}),
        ...(normalizedTickets.ticketCatalog ? { ticketCatalog: normalizedTickets.ticketCatalog } : {}),
        updatedAt: new Date().toISOString()
    };

    if (payload.hostData !== undefined || snapshots.hostData) {
        updates.hostData = payload.hostData || snapshots.hostData || null;
    }

    if (payload.venueData !== undefined || snapshots.venueData) {
        updates.venueData = payload.venueData || snapshots.venueData || null;
    }

    await db.collection(EVENT_COLLECTION).doc(eventId).update(updates);
    return mapEventForClient({ id: eventId, ...updates });
}

/**
 * Soft delete an event.
 */
export async function deleteEvent(eventId, token) {
    console.log("[debug] deleteEvent eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in deleteEvent:", eventId);
        throw new Error("Invalid event ID — documentPath must be a non-empty string");
    }
    const db = getAdminDb();
    await db.collection(EVENT_COLLECTION).doc(eventId).update({
        lifecycle: "deleted",
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return { success: true };
}

/**
 * Transition an event lifecycle (publish, unpublish, cancel, etc.)
 */
export async function updateEventLifecycle(eventId, status, context = {}, notes = "") {
    console.log("[debug] updateEventLifecycle eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in updateEventLifecycle:", eventId);
        throw new Error("Invalid event ID — documentPath must be a non-empty string");
    }
    const db = getAdminDb();
    const updates = {
        lifecycle: status,
        updatedAt: new Date().toISOString(),
    };
    if (notes) updates.approvalNotes = notes;
    await db.collection(EVENT_COLLECTION).doc(eventId).update(updates);
    return { success: true, lifecycle: status };
}

/**
 * Get users interested in an event (saved/liked).
 */
export async function getEventInterested(eventId, limit = 20, token) {
    const db = getAdminDb();
    try {
        const snapshot = await db.collection("likes")
            .where("eventId", "==", eventId)
            .limit(limit)
            .get();
        const users = snapshot.docs.map(doc => {
            const d = doc.data();
            return { id: d.userId, name: d.displayName || "Member", photoURL: d.photoURL || null };
        });
        return { count: users.length, users };
    } catch {
        return { count: 0, users: [] };
    }
}

/**
 * Get the confirmed guestlist (orders) for an event.
 * @param {string} eventId
 * @param {number} [limit=50]
 * @param {string} [token]
 */
export async function getEventGuestlist(eventId, limit = 50, token) {
    const db = getAdminDb();
    try {
        const snapshot = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed")
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
        return [];
    }
}

/**
 * List events available for promoters.
 * @param {{ promoterId?: string, city?: string, limit?: number }} params
 * @param {string} [token]
 */
export async function listEventsForPromoter({ promoterId, city, limit = 20 } = {}, token) {
    const db = getAdminDb();
    try {
        // Fetch events and approved partner IDs in parallel
        const [snapshot, connectionsSnap] = await Promise.all([
            db.collection(EVENT_COLLECTION)
                .where("lifecycle", "in", ["scheduled", "live"])
                .limit(Math.max(limit * 10, 300))
                .get(),
            promoterId
                ? db.collection("promoter_connections")
                    .where("promoterId", "==", promoterId)
                    .where("status", "in", ["approved", "active"])
                    .get()
                : Promise.resolve({ docs: [] })
        ]);

        // Build a set of approved partner IDs (hostId or venueId)
        const approvedTargetIds = new Set(
            connectionsSnap.docs.map(d => d.data().targetId)
        );

        let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Gate: only show events from approved partners
        if (promoterId && approvedTargetIds.size > 0) {
            events = events.filter(e =>
                (
                    approvedTargetIds.has(String(e.hostId || "")) ||
                    approvedTargetIds.has(String(e.venueId || "")) ||
                    approvedTargetIds.has(String(e.creatorId || ""))
                ) &&
                canPromoterAccessEvent(e, promoterId)
            );
        } else if (promoterId) {
            // Promoter has no approved connections — show nothing
            events = [];
        }

        if (city) {
            const c = city.toLowerCase();
            events = events.filter(e =>
                e.city?.toLowerCase().includes(c) || e.cityKey === c
            );
        }
        events.sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
            const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
            return dateA - dateB;
        });
        return events.slice(0, limit).map(e => mapEventForClient(e));
    } catch (error) {
        console.error("[EventStore] listEventsForPromoter failed:", error.message);
        return [];
    }
}

export default {
    listEvents, getEvent, createEvent, updateEvent, deleteEvent,
    updateEventLifecycle, getEventInterested, getEventGuestlist, listEventsForPromoter,
};

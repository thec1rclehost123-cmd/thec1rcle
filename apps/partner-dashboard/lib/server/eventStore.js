/**
 * Event Store — Direct Firebase Admin (no API gateway required)
 *
 * Previously delegated all calls to C1rcleApiClient → Fastify gateway at :4000.
 * Rewritten to use Firebase Admin + @c1rcle/core/event-engine directly so the
 * partner-dashboard works without the gateway running in dev.
 */

import { getAdminDb } from "../firebase/admin";
import { buildEvent } from "@c1rcle/core/event-engine";

export const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Pune";

const EVENT_COLLECTION = "events";

const serialize = (obj) => {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === "object" && value.seconds !== undefined && value.nanoseconds !== undefined) {
            return new Date(value.seconds * 1000).toISOString();
        }
        return value;
    }));
};

/**
 * List events for the partner dashboard.
 * Queries Firestore directly; secondary filters applied client-side to avoid
 * composite index requirements.
 */
export async function listEvents({ city, limit, sort, search, host, venueId, lifecycle, creatorId, creatorRole } = {}, token) {
    const db = getAdminDb();
    let ref = db.collection(EVENT_COLLECTION);

    // Use a single equality filter as the primary Firestore predicate
    if (creatorId) {
        ref = ref.where("creatorId", "==", creatorId);
    } else if (venueId) {
        ref = ref.where("venueId", "==", venueId);
    } else if (host) {
        ref = ref.where("host", "==", host);
    }

    const snapshot = await ref.limit(300).get();
    let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Secondary filters applied client-side
    if (lifecycle && lifecycle !== "all") {
        if (lifecycle === "approved") {
            events = events.filter(e => e.lifecycle === "approved" || e.lifecycle === "scheduled");
        } else {
            events = events.filter(e => e.lifecycle === lifecycle);
        }
    }
    if (city) {
        const c = city.toLowerCase();
        events = events.filter(e =>
            e.city?.toLowerCase().includes(c) || e.cityKey?.toLowerCase() === c
        );
    }
    if (search) {
        const q = search.toLowerCase();
        events = events.filter(e =>
            e.title?.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q) ||
            e.venue?.toLowerCase().includes(q)
        );
    }

    const now = new Date();
    events.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : null;
        const dateB = b.startDate ? new Date(b.startDate) : null;

        const isFutureA = dateA && dateA > now && a.lifecycle !== 'draft';
        const isFutureB = dateB && dateB > now && b.lifecycle !== 'draft';

        // 1. Future events first
        if (isFutureA && !isFutureB) return -1;
        if (!isFutureA && isFutureB) return 1;

        // 2. Both are future: sort by date ascending (soonest first)
        if (isFutureA && isFutureB) {
            return dateA - dateB;
        }

        // 3. Both are past or drafts: sort by createdAt descending (newest first)
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    if (limit) events = events.slice(0, limit);

    return { events: serialize(events), hasMore: false, nextCursor: null };
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
        return serialize({ id: doc.id, ...doc.data() });
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
        // Denormalized snapshots for guest-portal display (no extra reads)
        hostData: payload.hostData || null,
        venueData: payload.venueData || null,
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
    } else {
        await db.collection(EVENT_COLLECTION).doc(event.id).set(event);
    }
    return serialize(event);
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
    const updates = { ...payload, updatedAt: new Date().toISOString() };
    await db.collection(EVENT_COLLECTION).doc(eventId).update(updates);
    return serialize({ id: eventId, ...updates });
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
        return serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
                .where("promotersEnabled", "==", true)
                .where("lifecycle", "in", ["scheduled", "live"])
                .limit(limit * 5) // Fetch extra before filtering by partnership
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
                approvedTargetIds.has(e.hostId) ||
                approvedTargetIds.has(e.venueId) ||
                approvedTargetIds.has(e.creatorId)
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
        return serialize(events.slice(0, limit));
    } catch (error) {
        console.error("[EventStore] listEventsForPromoter failed:", error.message);
        return [];
    }
}

export default {
    listEvents, getEvent, createEvent, updateEvent, deleteEvent,
    updateEventLifecycle, getEventInterested, getEventGuestlist, listEventsForPromoter,
};

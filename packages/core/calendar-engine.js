/**
 * THE C1RCLE - Calendar Engine
 * Manages venue availability and host slot requests.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./admin.js";

const CALENDAR_COLLECTION = "venue_calendar";
const SLOTS_COLLECTION = "slot_requests";

/**
 * Gets venue availability for a date range
 */
export async function getVenueAvailability(venueId, startDate, endDate) {
    const db = getAdminDb();
    const snapshot = await db.collection(CALENDAR_COLLECTION)
        .where("venueId", "==", venueId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Blocks a date for a venue
 */
export async function blockDate(venueId, date, reason, blockedBy, startTime = "16:00", endTime = "04:00") {
    const db = getAdminDb();
    const id = `${venueId}_${date}`;

    const block = {
        venueId,
        date,
        status: "blocked",
        reason,
        startTime,
        endTime,
        blockedBy: {
            uid: blockedBy.uid,
            name: blockedBy.name || "",
            role: blockedBy.role
        },
        updatedAt: new Date().toISOString()
    };

    await db.collection(CALENDAR_COLLECTION).doc(id).set(block, { merge: true });
    return block;
}

/**
 * Unblocks a date
 */
export async function unblockDate(venueId, date) {
    const db = getAdminDb();
    const id = `${venueId}_${date}`;
    await db.collection(CALENDAR_COLLECTION).doc(id).delete();
    return { success: true };
}

/**
 * Creates a slot request (Host to Venue).
 * All requests go through pending → venue manual approval flow.
 *
 * @param {object} data   - Request payload (must include hostId and venueId)
 * @param {object} [actor] - Decoded Firebase user from req.user (for audit trail)
 */
export async function createSlotRequest(data, actor) {
    const db = getAdminDb();
    const id = `slot_${randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    const request = {
        ...data,
        id,
        status: "pending",
        createdAt: now,
        updatedAt: now
    };

    await db.collection(SLOTS_COLLECTION).doc(id).set(request);

    // Update calendar as tentative until venue manually approves
    const calendarId = `${data.venueId}_${data.requestedDate}`;
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).set({
        venueId: data.venueId,
        date: data.requestedDate,
        status: "tentative",
        slotRequestId: id
    }, { merge: true });

    return request;
}

/**
 * Responds to a slot request (Approve/Reject/Counter)
 */
export async function respondToSlotRequest(id, action, responseData, actor) {
    const db = getAdminDb();
    const ref = db.collection(SLOTS_COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists) throw new Error("Slot request not found");
    const request = doc.data();

    const now = new Date().toISOString();
    const updates = {
        status: action === "approve" ? "approved" : (action === "counter" ? "counter_proposed" : "rejected"),
        respondedAt: now,
        updatedAt: now,
        respondedBy: { uid: actor.uid, name: actor.name || "" },
        notes: responseData.notes || ""
    };

    if (action === "counter") {
        updates.alternativeDate = responseData.alternativeDate;
        updates.alternativeStartTime = responseData.alternativeStartTime;
        updates.alternativeEndTime = responseData.alternativeEndTime;
    }

    await ref.update(updates);

    // Sync with calendar
    const calendarId = `${request.venueId}_${request.requestedDate}`;
    if (action === "approve") {
        await db.collection(CALENDAR_COLLECTION).doc(calendarId).update({ status: "booked" });

        // Fix: Promote the underlying event from 'submitted' to 'scheduled'
        if (request.eventId) {
            await db.collection("events").doc(request.eventId).update({
                lifecycle: "scheduled",
                updatedAt: now
            });
        }
    } else {
        await db.collection(CALENDAR_COLLECTION).doc(calendarId).delete(); // Remove tentative
    }

    return { ...request, ...updates };
}

/**
 * Gets the operating calendar for a partner (venue or host).
 * Combines calendar entries (blocks, bookings) with scheduled events
 * to provide a unified view for the partner dashboard.
 * 
 * @param {object} db       - Firestore database instance (passed from API gateway)
 * @param {string} partnerId - The venue or host ID
 * @param {string} role      - "venue" or "host"
 * @param {string} startDate - Start of date range (YYYY-MM-DD)
 * @param {string} endDate   - End of date range (YYYY-MM-DD)
 */
export async function getOperatingCalendar(db, partnerId, role, startDate, endDate) {
    // If db is not passed, fall back to admin db (for direct usage)
    const firestore = db || getAdminDb();

    // 1. Fetch calendar entries (blocks, tentative bookings, booked slots)
    const calendarEntries = [];
    if (role === "venue") {
        const calSnap = await firestore.collection(CALENDAR_COLLECTION)
            .where("venueId", "==", partnerId)
            .get();

        calendarEntries.push(...calSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), entryType: "calendar" }))
            .filter(entry => entry.date >= startDate && entry.date <= endDate)
        );
    }

    // 2. Fetch events linked to this partner in the date range
    let eventsQuery;
    if (role === "venue") {
        eventsQuery = firestore.collection("events")
            .where("venueId", "==", partnerId);
    } else {
        // Host: fetch events created by this host
        eventsQuery = firestore.collection("events")
            .where("hostId", "==", partnerId);
    }

    const eventsSnap = await eventsQuery.get();
    const events = eventsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data(), entryType: "event" }))
        .filter(event => {
            const dateStr = event.startDate ? event.startDate.substring(0, 10) : "";
            return dateStr >= startDate && dateStr <= endDate;
        });

    // 3. Fetch pending slot requests for this partner
    const slotsQuery = role === "venue"
        ? firestore.collection(SLOTS_COLLECTION).where("venueId", "==", partnerId)
        : firestore.collection(SLOTS_COLLECTION).where("hostId", "==", partnerId);

    const slotsSnap = await slotsQuery.get();
    const slots = slotsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data(), entryType: "slot_request" }))
        .filter(slot => {
            const requestedDate = slot.requestedDate || slot.date;
            return requestedDate >= startDate && requestedDate <= endDate;
        });

    // 4. Merge and return all entries
    return [...calendarEntries, ...events, ...slots];
}

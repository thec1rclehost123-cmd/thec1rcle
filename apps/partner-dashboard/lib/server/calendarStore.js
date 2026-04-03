/**
 * Venue Calendar Store (Refactored for API Governance)
 * 
 * Rewritten to use @c1rcle/core/calendar-engine directly 
 * so the partner-dashboard works without the gateway running in dev.
 */

import { getAdminDb } from "../firebase/admin";
import {
    getOperatingCalendar as directGetOperatingCalendar,
    blockDate as directBlockDate,
    unblockDate as directUnblockDate,
    respondToSlotRequest as directRespondToSlotRequest,
    createSlotRequest as directCreateSlotRequest,
} from "@c1rcle/core/calendar-engine";
import { mapEventForClient } from "@c1rcle/core/events";
import { getApiClient } from "./apiClient";

function enumerateDates(startDate, endDate) {
    const dates = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
}

function toExtendedMinutes(time) {
    if (!time) return null;
    const [hour, minute] = time.split(":").map(Number);
    let total = hour * 60 + minute;
    if (hour < 12) total += 24 * 60;
    return total;
}

function rangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return true;

    const aStart = toExtendedMinutes(startA);
    const aEnd = toExtendedMinutes(endA);
    const bStart = toExtendedMinutes(startB);
    const bEnd = toExtendedMinutes(endB);

    if ([aStart, aEnd, bStart, bEnd].some(value => value === null)) return true;
    return aStart < bEnd && bStart < aEnd;
}

function buildDayStatus(slots) {
    if (!slots.length) return "available";
    if (slots.some(slot => slot.status === "blocked")) return "blocked";
    if (slots.some(slot => !slot.startTime || !slot.endTime)) return "booked";
    return "partial";
}

async function fetchCalendarEntriesWithRequests(venueId, startDate, endDate) {
    const db = getAdminDb();
    const [calendarSnap, eventsSnap] = await Promise.all([
        db.collection("venue_calendar")
            .where("venueId", "==", venueId)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .get(),
        db.collection("events")
            .where("venueId", "==", venueId)
            .get()
    ]);

    const entries = calendarSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const events = eventsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(event => {
            const date = String(event.startDate || "").slice(0, 10);
            const lifecycle = String(event.lifecycle || event.status || "draft").toLowerCase();
            return date >= startDate &&
                date <= endDate &&
                !["draft", "deleted", "cancelled", "denied"].includes(lifecycle);
        });
    const requestIds = [...new Set(entries.map(entry => entry.slotRequestId).filter(Boolean))];
    const requestDocs = await Promise.all(
        requestIds.map(id => db.collection("slot_requests").doc(id).get())
    );

    const requestsById = new Map();
    requestDocs.forEach(doc => {
        if (doc.exists) requestsById.set(doc.id, { id: doc.id, ...doc.data() });
    });

    return { entries, requestsById, events };
}

function normalizeVenueCalendarDays(entries, requestsById, events, startDate, endDate) {
    const entriesByDate = new Map();

    for (const entry of entries) {
        const request = entry.slotRequestId ? requestsById.get(entry.slotRequestId) : null;
        const slots = entriesByDate.get(entry.date) || [];
        const normalizedStatus = entry.status === "tentative" ? "tentative" : entry.status;

        slots.push({
            id: entry.id,
            status: normalizedStatus,
            startTime: entry.startTime || request?.requestedStartTime || null,
            endTime: entry.endTime || request?.requestedEndTime || null,
            reason: entry.reason || "",
            slotRequestId: entry.slotRequestId || null,
        });

        entriesByDate.set(entry.date, slots);
    }

    for (const event of events) {
        const date = String(event.startDate || "").slice(0, 10);
        const slots = entriesByDate.get(date) || [];
        slots.push({
            id: event.id,
            status: "booked",
            startTime: event.startTime || null,
            endTime: event.endTime || null,
            reason: "",
            slotRequestId: null,
            source: "event",
        });
        entriesByDate.set(date, slots);
    }

    return enumerateDates(startDate, endDate).map(date => {
        const slots = entriesByDate.get(date) || [];
        return {
            date,
            status: buildDayStatus(slots),
            slots,
            reason: slots.find(slot => slot.reason)?.reason || "",
            isAvailable: slots.length === 0,
        };
    });
}

async function getNormalizedVenueCalendar(venueId, startDate, endDate) {
    const { entries, requestsById, events } = await fetchCalendarEntriesWithRequests(venueId, startDate, endDate);
    return normalizeVenueCalendarDays(entries, requestsById, events, startDate, endDate);
}

/**
 * Get operating calendar for partner dashboard (rich view)
 * Returns daily aggregated data for the internal calendar component.
 */
export async function getOperatingCalendar(partnerId, role, startDate, endDate, token) {
    const db = getAdminDb();
    try {
        const data = await directGetOperatingCalendar(db, partnerId, role, startDate, endDate);

        // Map events to ensure posterUrl and other standardized fields are present
        return (data || []).map(day => ({
            ...day,
            events: (day.events || []).map(event => mapEventForClient(event, event.id))
        }));
    } catch (error) {
        console.error("[CalendarStore] getOperatingCalendar failed:", error.message);
        return [];
    }
}

/**
 * Block a date or time range (venue action)
 */
export async function blockDate(venueId, date, reason = "", actor, startTime = "16:00", endTime = "04:00") {
    return directBlockDate(venueId, date, reason, actor || { uid: "system", role: "venue" }, startTime, endTime);
}

/**
 * Unblock a date (venue action)
 */
export async function unblockDate(venueId, date, _token) {
    return directUnblockDate(venueId, date);
}

/**
 * Request a slot (host action)
 */
export async function requestSlot(data, actor) {
    return directCreateSlotRequest(data, actor || { uid: "system", role: "host" });
}

/**
 * Respond to a slot request (venue action)
 */
export async function respondToSlotRequest(id, action, responseData = {}, actor) {
    return directRespondToSlotRequest(id, action, responseData, actor || { uid: "system", role: "venue" });
}

/**
 * Get venue availability for a specific range (consumer/host view)
 */
export async function getVenueCalendar(venueId, startDate, endDate, _hostId, _token) {
    try {
        return await getNormalizedVenueCalendar(venueId, startDate, endDate);
    } catch (error) {
        console.error("[CalendarStore] getVenueCalendar failed:", error.message);
        return [];
    }
}

/**
 * Get host-perspective view of a venue's calendar.
 *
 * Merges two Firestore sources into a unified slot list with proper `state` fields:
 *   1. venue_calendar docs — blocked / tentative / booked entries set by the venue
 *   2. slot_requests docs  — this host's own pending / approved requests at the venue
 *
 * Returned items always carry a `state` field that the host calendar frontend
 * reads first, so the correct colour/icon is shown for each date.
 *
 * Only dates with a non-open state are included; the frontend treats absent
 * dates as open (clicking them shows "Available" detail panel).
 *
 * @param {string} venueId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @param {string|null} hostId
 * @returns {Promise<Array<{date:string, state:string, [key:string]:any}>>}
 */
export async function getHostVenueCalendar(venueId, startDate, endDate, hostId) {
    try {
        const db = getAdminDb();

        // ── 1. Venue-side blocks / tentative / booked entries + scheduled events ──
        const [calSnap, eventsSnap] = await Promise.all([
            db.collection("venue_calendar")
                .where("venueId", "==", venueId)
                .where("date", ">=", startDate)
                .where("date", "<=", endDate)
                .get(),
            db.collection("events")
                .where("venueId", "==", venueId)
                .get(),
        ]);

        const calByDate = {};
        for (const doc of calSnap.docs) {
            const entry = { id: doc.id, ...doc.data() };
            calByDate[entry.date] = entry;
        }

        const eventsByDate = {};
        for (const doc of eventsSnap.docs) {
            const event = { id: doc.id, ...doc.data() };
            const date = String(event.startDate || event.date || event.eventDate || "").slice(0, 10);
            const lifecycle = String(event.lifecycle || event.status || "draft").toLowerCase();

            if (
                !date ||
                date < startDate ||
                date > endDate ||
                ["draft", "deleted", "cancelled", "denied"].includes(lifecycle)
            ) {
                continue;
            }

            if (!eventsByDate[date]) {
                eventsByDate[date] = [];
            }

            eventsByDate[date].push(event);
        }

        // ── 2. This host's own slot requests at this venue ────────────────────
        const myRequestByDate = {};
        if (hostId) {
            const reqSnap = await db.collection("slot_requests")
                .where("venueId", "==", venueId)
                .where("hostId", "==", hostId)
                .get();

            for (const doc of reqSnap.docs) {
                const req = { id: doc.id, ...doc.data() };
                const date = req.requestedDate || req.date;
                if (date && date >= startDate && date <= endDate) {
                    // Latest request wins if multiple exist for same date
                    if (!myRequestByDate[date] || req.updatedAt > myRequestByDate[date].updatedAt) {
                        myRequestByDate[date] = req;
                    }
                }
            }
        }

        // ── 3. Build slot list — only emit non-open dates ─────────────────────
        const allDates = new Set([
            ...Object.keys(calByDate),
            ...Object.keys(myRequestByDate),
            ...Object.keys(eventsByDate),
        ]);

        const slots = [];
        for (const date of allDates) {
            const myReq = myRequestByDate[date];
            const calEntry = calByDate[date];
            const events = eventsByDate[date] || [];

            let state = "open";
            const slotData = { date };

            if (myReq) {
                // Host's own request — takes priority over venue-side calendar state
                state = myReq.status === "approved" ? "approved_mine" : "pending_mine";
                slotData.state = state;
                slotData.status = myReq.status === "approved" ? "booked" : "tentative";
                slotData.slotId = myReq.id;
                slotData.eventId = myReq.eventId;
                slotData.eventTitle = myReq.eventTitle || myReq.eventName;
                slotData.lifecycle = myReq.status;
                slotData.startTime = myReq.requestedStartTime || myReq.startTime;
                slotData.endTime = myReq.requestedEndTime || myReq.endTime;
                slotData.slots = [{
                    status: slotData.status,
                    startTime: slotData.startTime || null,
                    endTime: slotData.endTime || null,
                }];
            } else if (events.length > 0) {
                const event = events[0];
                state = "occupied_other";
                slotData.state = state;
                slotData.status = event.startTime || event.endTime ? "partial" : "booked";
                slotData.eventId = event.id;
                slotData.eventTitle = event.title || event.eventTitle || event.name;
                slotData.lifecycle = event.lifecycle || event.status || "scheduled";
                slotData.startTime = event.startTime || null;
                slotData.endTime = event.endTime || null;
                slotData.slots = events.map((scheduledEvent) => ({
                    status: "booked",
                    startTime: scheduledEvent.startTime || null,
                    endTime: scheduledEvent.endTime || null,
                }));
            } else if (calEntry) {
                const cs = calEntry.status;
                if (cs === "blocked") {
                    state = "blocked";
                } else if (cs === "booked" || cs === "tentative") {
                    state = "occupied_other";
                }
                slotData.state = state;
                slotData.status = cs === "blocked" ? "blocked" : (calEntry.startTime || calEntry.endTime ? "partial" : "booked");
                slotData.startTime = calEntry.startTime || null;
                slotData.endTime = calEntry.endTime || null;
                slotData.slots = [{
                    status: cs,
                    startTime: slotData.startTime,
                    endTime: slotData.endTime,
                }];
            }

            if (state !== "open") {
                slots.push(slotData);
            }
        }

        return slots;
    } catch (error) {
        console.error("[CalendarStore] getHostVenueCalendar failed:", error.message);
        return [];
    }
}

/**
 * Get availability for a specific single date
 */
export async function getDateAvailability(venueId, date, _token) {
    try {
        const [day] = await getNormalizedVenueCalendar(venueId, date, date);
        return day || {
            date,
            status: "available",
            slots: [],
            reason: "",
            isAvailable: true,
        };
    } catch (error) {
        console.error("[CalendarStore] getDateAvailability failed:", error.message);
        return null;
    }
}

/**
 * Get unified venue calendar (combines operating slots and blocks)
 */
export async function getUnifiedVenueCalendar(venueId, startDate, endDate, _token) {
    try {
        return await getNormalizedVenueCalendar(venueId, startDate, endDate);
    } catch (error) {
        console.error("[CalendarStore] getUnifiedVenueCalendar failed:", error.message);
        return [];
    }
}

/**
 * Check if a slot is available
 */
export async function isSlotAvailable(venueId, date, startTime, endTime, _token) {
    try {
        const day = await getDateAvailability(venueId, date);
        if (!day) return false;
        if (day.status === "blocked" || day.status === "booked") return false;
        if (!startTime || !endTime) return day.status === "available";

        return !(day.slots || []).some(slot => {
            if (!slot || slot.status === "available") return false;
            return rangesOverlap(slot.startTime, slot.endTime, startTime, endTime);
        });
    } catch (error) {
        console.error("[CalendarStore] isSlotAvailable failed:", error.message);
        return false;
    }
}

export default {
    getOperatingCalendar,
    getVenueCalendar,
    getHostVenueCalendar,
    getUnifiedVenueCalendar,
    getDateAvailability,
    isSlotAvailable,
    blockDate,
    unblockDate,
    requestSlot,
    respondToSlotRequest
};

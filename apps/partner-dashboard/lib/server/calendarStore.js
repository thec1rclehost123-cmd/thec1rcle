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
    getVenueAvailability
} from "@c1rcle/core/calendar-engine";
import { mapEventForClient } from "@c1rcle/core/events";
import { getApiClient } from "./apiClient";

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
        return await getVenueAvailability(venueId, startDate, endDate);
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

        // ── 1. Venue-side blocks / tentative / booked entries ─────────────────
        const calSnap = await db.collection("venue_calendar")
            .where("venueId", "==", venueId)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .get();

        const calByDate = {};
        for (const doc of calSnap.docs) {
            const entry = { id: doc.id, ...doc.data() };
            calByDate[entry.date] = entry;
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
        ]);

        const slots = [];
        for (const date of allDates) {
            const myReq = myRequestByDate[date];
            const calEntry = calByDate[date];

            let state = "open";
            const slotData = { date };

            if (myReq) {
                // Host's own request — takes priority over venue-side calendar state
                state = myReq.status === "approved" ? "approved_mine" : "pending_mine";
                slotData.state = state;
                slotData.slotId = myReq.id;
                slotData.eventId = myReq.eventId;
                slotData.eventTitle = myReq.eventTitle || myReq.eventName;
                slotData.lifecycle = myReq.status;
                slotData.startTime = myReq.requestedStartTime || myReq.startTime;
                slotData.endTime = myReq.requestedEndTime || myReq.endTime;
            } else if (calEntry) {
                const cs = calEntry.status;
                if (cs === "blocked") {
                    state = "blocked";
                } else if (cs === "booked" || cs === "tentative") {
                    state = "occupied_other";
                }
                slotData.state = state;
                slotData.startTime = calEntry.startTime;
                slotData.endTime = calEntry.endTime;
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
        return await getVenueAvailability(venueId, date, date);
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
        return await getVenueAvailability(venueId, startDate, endDate);
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
        const slots = await getVenueAvailability(venueId, date, date);
        // Basic check: find a slot that is available and contains the requested range
        return (slots || []).some(slot =>
            slot.isAvailable &&
            slot.startTime <= startTime &&
            slot.endTime >= endTime
        );
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

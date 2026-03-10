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
import { getApiClient } from "./apiClient";

/**
 * Get operating calendar for partner dashboard (rich view)
 * Returns daily aggregated data for the internal calendar component.
 */
export async function getOperatingCalendar(partnerId, role, startDate, endDate, token) {
    const db = getAdminDb();
    try {
        return await directGetOperatingCalendar(db, partnerId, role, startDate, endDate);
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
    getUnifiedVenueCalendar,
    getDateAvailability,
    isSlotAvailable,
    blockDate,
    unblockDate,
    requestSlot,
    respondToSlotRequest
};

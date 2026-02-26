/**
 * Venue Calendar Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage venue availability and slots.
 * All scheduling logic and DB access moved to @c1rcle/core/calendar-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get operating calendar for partner dashboard (rich view)
 */
export async function getOperatingCalendar(partnerId, role, startDate, endDate, token) {
    const client = getApiClient(token);
    try {
        return await client.getOperatingCalendar(partnerId, role, startDate, endDate);
    } catch (error) {
        console.error("[CalendarStore] getOperatingCalendar failed:", error.message);
        return [];
    }
}

/**
 * Block a date or time range (venue action)
 */
export async function blockDate(venueId, date, reason = "", token, startTime = "16:00", endTime = "04:00") {
    const client = getApiClient(token);
    return client.blockVenueDate(venueId, date, reason, startTime, endTime);
}

/**
 * Unblock a date (venue action)
 */
export async function unblockDate(venueId, date, token) {
    const client = getApiClient(token);
    return client.request('/calendar/block', {
        method: 'DELETE',
        body: JSON.stringify({ venueId, date })
    });
}

/**
 * Request a slot (host action)
 */
export async function requestSlot(data, token) {
    const client = getApiClient(token);
    return client.requestSlot(data);
}

/**
 * Respond to a slot request (venue action)
 */
export async function respondToSlotRequest(id, action, responseData = {}, token) {
    const client = getApiClient(token);
    return client.respondToSlot(id, action, responseData);
}

export default {
    getOperatingCalendar,
    blockDate,
    unblockDate,
    requestSlot,
    respondToSlotRequest
};

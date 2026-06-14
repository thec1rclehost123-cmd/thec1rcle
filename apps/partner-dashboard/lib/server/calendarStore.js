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
export async function blockDate(
  venueId,
  date,
  reason = "",
  token,
  startTime = "16:00",
  endTime = "04:00",
) {
  const client = getApiClient(token);
  return client.blockVenueDate(venueId, date, reason, startTime, endTime);
}

/**
 * Unblock a date (venue action)
 */
export async function unblockDate(venueId, date, token) {
  const client = getApiClient(token);
  return client.request("/calendar/block", {
    method: "DELETE",
    body: JSON.stringify({ venueId, date }),
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

/**
 * Get venue availability for a specific range (consumer/host view)
 */
export async function getVenueCalendar(venueId, startDate, endDate, hostId, token) {
  const client = getApiClient(token);
  try {
    // hostId can be used for host-specific logic if needed in the future
    return await client.getVenueAvailability(venueId, startDate, endDate);
  } catch (error) {
    console.error("[CalendarStore] getVenueCalendar failed:", error.message);
    return [];
  }
}

/**
 * Get availability for a specific single date
 */
export async function getDateAvailability(venueId, date, token) {
  const client = getApiClient(token);
  try {
    return await client.getVenueAvailability(venueId, date, date);
  } catch (error) {
    console.error("[CalendarStore] getDateAvailability failed:", error.message);
    return null;
  }
}

/**
 * Get unified venue calendar (combines operating slots and blocks)
 */
export async function getUnifiedVenueCalendar(venueId, startDate, endDate, token) {
  const client = getApiClient(token);
  try {
    return await client.getVenueAvailability(venueId, startDate, endDate);
  } catch (error) {
    console.error("[CalendarStore] getUnifiedVenueCalendar failed:", error.message);
    return [];
  }
}

/**
 * Check if a slot is available
 */
export async function isSlotAvailable(venueId, date, startTime, endTime, token) {
  const client = getApiClient(token);
  try {
    const slots = await client.getVenueAvailability(venueId, date, date);
    // Basic check: find a slot that contains the requested range and is available
    return (slots || []).some(
      (slot) => slot.isAvailable && slot.startTime <= startTime && slot.endTime >= endTime,
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
  respondToSlotRequest,
};

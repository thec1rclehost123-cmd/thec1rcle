/**
 * Event Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage Events.
 * Legacy transformation logic removed; now handled by core/event-engine.
 */

import { getApiClient } from "./apiClient";

export const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Pune";

/**
 * List events for the partner dashboard.
 */
export async function listEvents(params, token) {
  const client = getApiClient(token);
  try {
    const data = await client.getEvents(params);
    return data.events || [];
  } catch (error) {
    console.error("[EventStore] listEvents failed:", error.message);
    throw error;
  }
}

/**
 * Get a single event by ID or slug.
 */
export async function getEvent(eventId, token) {
  const client = getApiClient(token);
  try {
    const data = await client.getEvent(eventId);
    return data.event || null;
  } catch (error) {
    console.error("[EventStore] getEvent failed:", error.message);
    return null;
  }
}

/**
 * Create a new event.
 */
export async function createEvent(payload, token) {
  const client = getApiClient(token);
  return client.createEvent(payload);
}

/**
 * Update an existing event.
 */
export async function updateEvent(eventId, payload, token) {
  const client = getApiClient(token);
  return client.updateEvent(eventId, payload);
}

/**
 * Soft delete an event.
 */
export async function deleteEvent(eventId, token) {
  const client = getApiClient(token);
  return client.deleteEvent(eventId);
}

/**
 * Update event lifecycle (Publish, Unpublish, Cancel).
 */
export async function updateEventLifecycle(eventId, status, context, notes = "") {
  // Pass everything through to updateEvent as it handles lifecycle in the Gateway
  const client = getApiClient(context.token);
  return client.updateEvent(eventId, { lifecycle: status, approvalNotes: notes });
}

/**
 * Get users interested in an event. (Used for Guestlist tabs)
 */
export async function getEventInterested(eventId, limit = 20, token) {
  const client = getApiClient(token);
  const data = await client.request(`/events/${eventId}/interested?limit=${limit}`);
  return data || { count: 0, users: [] };
}

/**
 * Get the full guestlist for an event. (Confirmed buyers/RSVPs)
 */
export async function getEventGuestlist(eventId, limit = 50, token) {
  const client = getApiClient(token);
  const data = await client.request(`/events/${eventId}/guestlist?limit=${limit}`);
  return data || [];
}

/**
 * List events enabled for promoters
 */
export async function listEventsForPromoter({ promoterId, city, limit = 20 }, token) {
  const client = getApiClient(token);
  try {
    const params = {
      promotersEnabled: "true",
      limit: String(limit)
    };
    if (city) params.city = city;

    // We pass promoterId to the gateway to ensure it only returns events 
    // from hosts the promoter is connected to (logic handled centraly)
    if (promoterId) params.promoterId = promoterId;

    const data = await client.getEvents(params);
    return data.events || [];
  } catch (error) {
    console.error("[EventStore] listEventsForPromoter failed:", error.message);
    return [];
  }
}

export default {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventLifecycle,
  getEventInterested,
  getEventGuestlist,
  listEventsForPromoter
};

/**
 * Inventory Service (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage inventory.
 * Heavy lifting moved to @c1rcle/core/inventory-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get inventory summary for an event
 */
export async function getInventorySummary(eventId, token) {
  const client = getApiClient(token);
  try {
    const data = await client.getEventInventory(eventId);
    return data.summary || null;
  } catch (error) {
    console.error("[InventoryService] getInventorySummary failed:", error.message);
    throw error;
  }
}

/**
 * Check availability (Proxy to API Gateway)
 */
export async function checkAvailability(eventId, items, token) {
  const client = getApiClient(token);
  return client.request(`/inventory/${eventId}/check`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

/**
 * Release a reservation (Proxy to API Gateway)
 */
export async function releaseReservation(reservationId, token) {
  const client = getApiClient(token);
  return client.request(`/inventory/reservations/${reservationId}`, {
    method: "DELETE",
  });
}

export default {
  getInventorySummary,
  checkAvailability,
  releaseReservation,
};

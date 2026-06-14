/**
 * Slot Request Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage venue slot requests.
 * All slot logic delegated to @c1rcle/core/calendar-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

export async function createSlotRequest(data, token) {
  const client = getApiClient(token);
  return client.requestSlot(data);
}

export async function listSlotRequests(partnerId, role, status = null, token) {
  const client = getApiClient(token);
  try {
    const params = new URLSearchParams({ partnerId, role });
    if (status) params.append("status", status);
    return await client.request(`/calendar/slots?${params}`);
  } catch (error) {
    console.error("[SlotStore] listSlotRequests failed:", error.message);
    return [];
  }
}

export async function rejectSlotRequest(id, actor, reason = "", token) {
  const client = getApiClient(token);
  return client.respondToSlot(id, "reject", { reason });
}

export async function counterProposeSlot(id, actor, suggestion, token) {
  const client = getApiClient(token);
  return client.respondToSlot(id, "counter", { suggestion });
}

export async function getSlotRequest(id, token) {
  const client = getApiClient(token);
  try {
    return await client.request(`/calendar/slots/${id}`);
  } catch (error) {
    console.error("[SlotStore] getSlotRequest failed:", error.message);
    return null;
  }
}

export async function approveSlotRequest(id, actor, data = {}, token) {
  const client = getApiClient(token);
  return client.respondToSlot(id, "approve", data);
}

export default {
  createSlotRequest,
  respondToSlotRequest,
  listSlotRequests,
  rejectSlotRequest,
  counterProposeSlot,
  getSlotRequest,
  approveSlotRequest,
};

/**
 * Partnership Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage host-venue partnerships.
 * All logic moved to API Gateway's /partnerships routes.
 */

import { getApiClient } from "./apiClient";

export async function requestPartnership(hostId, venueId, hostName, venueName, token) {
  const client = getApiClient(token);
  return client.requestPartnership(hostId, venueId, hostName, venueName);
}

export async function approvePartnership(partnershipId, token) {
  const client = getApiClient(token);
  return client.respondToPartnership(partnershipId, "approve");
}

export async function rejectPartnership(partnershipId, reason = "", token) {
  const client = getApiClient(token);
  return client.respondToPartnership(partnershipId, "reject", reason);
}

export async function blockPartnership(partnershipId, reason = "", token) {
  const client = getApiClient(token);
  return client.respondToPartnership(partnershipId, "block", reason);
}

export async function listPartnerships(filters = {}, token) {
  const client = getApiClient(token);
  try {
    return await client.listPartnerships(filters);
  } catch (error) {
    console.error("[PartnershipStore] listPartnerships failed:", error.message);
    return [];
  }
}

export async function checkPartnership(hostId, venueId, token) {
  const client = getApiClient(token);
  try {
    const result = await client.checkPartnership(hostId, venueId);
    return result.isPartner ?? false;
  } catch (error) {
    console.error("[PartnershipStore] checkPartnership failed:", error.message);
    return false;
  }
}

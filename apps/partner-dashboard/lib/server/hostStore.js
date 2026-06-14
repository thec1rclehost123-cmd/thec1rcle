/**
 * Host Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage host profiles.
 * All DB access moved to API Gateway's /profiles routes.
 */

import { getApiClient } from "./apiClient";

/**
 * Get a host profile by their handle (e.g. @after_dark_india)
 */
export async function getHostByHandle(handle, token) {
  const client = getApiClient(token);
  try {
    // Normalize: handles are prefixed with @
    const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;
    return await client.request(
      `/profiles/by-handle/${encodeURIComponent(normalizedHandle)}?type=host`,
    );
  } catch (error) {
    console.error("[HostStore] getHostByHandle failed:", error.message);
    return null;
  }
}

/**
 * Create or update a host profile
 */
export async function upsertHostProfile(userId, profileData, token) {
  const client = getApiClient(token);
  return client.updateProfile("host", profileData, userId);
}

export default {
  getHostByHandle,
  upsertHostProfile,
};

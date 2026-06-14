import { C1rcleApiClient } from "@c1rcle/core/api-client";

/**
 * Get a pre-configured API Client for server-side use in the Dashboard.
 * @param {string} token - The user's Firebase ID token
 */
export function getApiClient(token) {
    return new C1rcleApiClient({
        baseUrl: process.env.PUBLIC_API_URL || "http://localhost:4000/api/v1",
        getAuthToken: async () => token
    });
}

/**
 * System-level API Client for background tasks or administrative overrides.
 * Uses a system service token (to be configured).
 */
export function getSystemApiClient() {
    return new C1rcleApiClient({
        baseUrl: process.env.PUBLIC_API_URL || "http://localhost:4000/api/v1",
        getAuthToken: async () => process.env.INTERNAL_API_KEY
    });
}

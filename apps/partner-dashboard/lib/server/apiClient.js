import { C1rcleApiClient } from "@c1rcle/core/api-client";

/**
 * Get a pre-configured API Client for server-side use in the Dashboard.
 * @param {string} token - The user's Firebase ID token
 */
export function getApiClient(token) {
    const baseUrl = process.env.NEXT_PUBLIC_GATEWAY_URL
        ? process.env.NEXT_PUBLIC_GATEWAY_URL + "/api/v1"
        : process.env.PUBLIC_API_URL;
    if (!baseUrl) throw new Error('API gateway URL is not configured. Set NEXT_PUBLIC_GATEWAY_URL or PUBLIC_API_URL.');
    return new C1rcleApiClient({
        baseUrl,
        getAuthToken: async () => token
    });
}

/**
 * System-level API Client for background tasks or administrative overrides.
 * Uses a system service token (to be configured).
 */
export function getSystemApiClient() {
    const baseUrl = process.env.PUBLIC_API_URL;
    if (!baseUrl) throw new Error('PUBLIC_API_URL is not configured.');
    return new C1rcleApiClient({
        baseUrl,
        getAuthToken: async () => process.env.INTERNAL_API_KEY
    });
}

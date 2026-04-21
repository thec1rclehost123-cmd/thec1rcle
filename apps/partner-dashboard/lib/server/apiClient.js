import { C1rcleApiClient } from "@c1rcle/core/api-client";

function normalizeGatewayBaseUrl(value) {
    if (!value) return value;
    const trimmed = value.replace(/\/+$/, "");
    return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Get a pre-configured API Client for server-side use in the Dashboard.
 * @param {string} token - The user's Firebase ID token
 */
export function getApiClient(token) {
    let baseUrl = normalizeGatewayBaseUrl(
        process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.PUBLIC_API_URL
    );

    if (!baseUrl && process.env.NODE_ENV === "development") {
        console.warn("[API Client] NEXT_PUBLIC_GATEWAY_URL is missing. Falling back to localhost:4000.");
        baseUrl = "http://localhost:4000/api/v1";
    }

    if (!baseUrl) {
        throw new Error('API gateway URL is not configured. Set NEXT_PUBLIC_GATEWAY_URL or PUBLIC_API_URL.');
    }

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
    const baseUrl = normalizeGatewayBaseUrl(
        process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.PUBLIC_API_URL
    );
    if (!baseUrl) throw new Error('PUBLIC_API_URL is not configured.');
    return new C1rcleApiClient({
        baseUrl,
        getAuthToken: async () => process.env.INTERNAL_API_KEY
    });
}

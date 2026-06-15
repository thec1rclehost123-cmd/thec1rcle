import { C1rcleApiClient } from '@c1rcle/core/api-client';

function normalizeGatewayBaseUrl(value) {
  if (!value) return value;
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Get a pre-configured API Client for server-side use in the Dashboard.
 * @param {string} token - The user's Firebase ID token
 */
export function getApiClient(token) {
  const baseUrl = normalizeGatewayBaseUrl(process.env.GATEWAY_URL || process.env.PUBLIC_API_URL);

  if (!baseUrl) {
    throw new Error('API gateway URL is not configured. Set GATEWAY_URL.');
  }

  return new C1rcleApiClient({
    baseUrl,
    getAuthToken: async () => token,
  });
}

/**
 * System-level API Client for background tasks or administrative overrides.
 * Uses a system service token (to be configured).
 */
export function getSystemApiClient() {
  const baseUrl = normalizeGatewayBaseUrl(process.env.GATEWAY_URL || process.env.PUBLIC_API_URL);
  if (!baseUrl) throw new Error('GATEWAY_URL is not configured.');
  return new C1rcleApiClient({
    baseUrl,
    getAuthToken: async () => process.env.INTERNAL_API_KEY,
  });
}

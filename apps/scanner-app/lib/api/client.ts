/**
 * THE C1RCLE - Scanner App API Client
 */

import { C1rcleApiClient } from "@c1rcle/core/api-client";

// Gateway URL fallback
const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL || "http://localhost:3000/api/v1";

export const apiClient = new C1rcleApiClient({
  baseUrl: GATEWAY_URL,
  getAuthToken: async () => {
    // In a real app, this would get the token from Secure Store or similar
    // For the scanner, it might use a static event token or device token
    return process.env.EXPO_PUBLIC_SCANNER_TOKEN || null;
  },
  onUnauthorized: () => {
    console.error("Scanner session expired or invalid token");
  },
});

/**
 * THE C1RCLE Mobile — Environment Configuration
 * 
 * Single source of truth for all environment-specific values.
 * Reads from EXPO_PUBLIC_* environment variables.
 */

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

export type MobileEnv = "dev" | "staging" | "prod";

const ENV_VALUE = process.env.EXPO_PUBLIC_MOBILE_ENV || "dev";

export const MOBILE_ENV: MobileEnv =
    ENV_VALUE === "prod" ? "prod" :
        ENV_VALUE === "staging" ? "staging" :
            "dev";

export const IS_DEV = MOBILE_ENV === "dev";
export const IS_STAGING = MOBILE_ENV === "staging";
export const IS_PROD = MOBILE_ENV === "prod";

// ============================================================================
// API CONFIGURATION
// ============================================================================

import Constants from "expo-constants";

// Helper to determine the local API URL dynamically
// This allows physical devices to connect to the laptop's IP address automatically
const getLocalApiUrl = () => {
    // 1. Explicit override from env
    if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;

    // 2. Derive from Expo Go host URI (e.g. 192.168.1.x)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const ip = hostUri.split(':')[0];
        // Assume Guest Portal is running on port 3000
        return `http://${ip}:3000`;
    }

    // 3. Fallback for Simulators
    return "http://localhost:3000";
};

const PRODUCTION_URL = "https://thec1rcle.com";

const API_URLS: Record<MobileEnv, string> = {
    dev: getLocalApiUrl(),
    staging: "https://staging.thec1rcle.com",
    prod: PRODUCTION_URL,
};

// API_BASE_URL: Default to environment-specific URL
export const API_BASE_URL = API_URLS[MOBILE_ENV];

// ============================================================================
// PAYMENT CONFIGURATION (Razorpay)
// ============================================================================

const RAZORPAY_KEYS: Record<MobileEnv, string> = {
    dev: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
    staging: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
    prod: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_live_placeholder",
};

export const RAZORPAY_KEY_ID = RAZORPAY_KEYS[MOBILE_ENV];

// ============================================================================
// ALGOLIA CONFIGURATION (Search & Discovery)
// ============================================================================

export const ALGOLIA_APP_ID = process.env.EXPO_PUBLIC_ALGOLIA_APP_ID || "";
export const ALGOLIA_SEARCH_KEY = process.env.EXPO_PUBLIC_ALGOLIA_SEARCH_KEY || "";
export const ALGOLIA_INDEX_NAME = process.env.EXPO_PUBLIC_ALGOLIA_INDEX_NAME || "events";

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

// Firebase config is read from individual EXPO_PUBLIC_ vars in lib/firebase/client.ts
// This is just a reference for which project is active
export const FIREBASE_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "c1rcle-dev";

// ============================================================================
// DEEP LINK CONFIGURATION
// ============================================================================

const DEEP_LINK_SCHEMES: Record<MobileEnv, string> = {
    dev: "c1rcle-dev",
    staging: "c1rcle-staging",
    prod: "c1rcle",
};

export const DEEP_LINK_SCHEME = DEEP_LINK_SCHEMES[MOBILE_ENV];
export const DEEP_LINK_PREFIX = `${DEEP_LINK_SCHEME}://`;

// Web fallback URLs
const FALLBACK_WEB_URL = "https://thec1rcle.com";
export const WEB_BASE_URL = API_BASE_URL || FALLBACK_WEB_URL;

// Content URL for Images - always default to production to ensure assets are visible
// Local Dev often lacks the full asset library
export const CONTENT_URL = "https://thec1rcle.com";

// Universal link patterns
export const DEEP_LINK_PATTERNS = {
    event: `${DEEP_LINK_PREFIX}event/:id`,
    ticket: `${DEEP_LINK_PREFIX}ticket/:orderId`,
    transfer: `${DEEP_LINK_PREFIX}transfer/:code`,
    chat: `${DEEP_LINK_PREFIX}chat/:eventId`,
    safety: `${DEEP_LINK_PREFIX}safety`,
    promoter: `${DEEP_LINK_PREFIX}p/:code`,
};

// ============================================================================
// PUSH NOTIFICATION CONFIGURATION
// ============================================================================

// Channel prefixes to avoid cross-env notifications
export const PUSH_CHANNEL_PREFIX = MOBILE_ENV === "prod" ? "" : `${MOBILE_ENV}_`;

export const PUSH_CHANNELS = {
    tickets: `${PUSH_CHANNEL_PREFIX}tickets`,
    social: `${PUSH_CHANNEL_PREFIX}social`,
    safety: `${PUSH_CHANNEL_PREFIX}safety`,
    marketing: `${PUSH_CHANNEL_PREFIX}marketing`,
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = {
    // Enable Sentry error tracking (only in prod/staging)
    sentryEnabled: !IS_DEV,

    // Enable analytics tracking
    analyticsEnabled: !IS_DEV,

    // Show debug UI elements
    debugMode: IS_DEV,

    // Enable offline ticket caching
    offlineTickets: true,

    // Enable chat features
    socialChat: true,

    // Enable safety features
    safetyFeatures: true,

    // Mock payment gateway - DISABLED for production parity
    // All environments use the real payment gateway
    mockPayments: false,
};

// ============================================================================
// TIMEOUTS & LIMITS
// ============================================================================

export const LIMITS = {
    // Cart reservation timeout (10 minutes)
    cartReservationMs: 10 * 60 * 1000,

    // API request timeout
    apiTimeoutMs: 15000,

    // Max DMs per day (rate limiting)
    maxNewDMsPerDay: 10,

    // Max checkout retries
    maxCheckoutRetries: 3,

    // Event cache duration
    eventCacheMs: 5 * 60 * 1000, // 5 minutes

    // Ticket cache duration (longer since tickets don't change often)
    ticketCacheMs: 30 * 60 * 1000, // 30 minutes
};

// ============================================================================
// LOGGING
// ============================================================================

export function logConfig() {
    if (IS_DEV) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📱 THE C1RCLE Mobile Configuration");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Environment: ${MOBILE_ENV.toUpperCase()}`);
        console.log(`API URL: ${API_BASE_URL}`);
        console.log(`Deep Link: ${DEEP_LINK_PREFIX}`);
        console.log(`Firebase: ${FIREBASE_PROJECT_ID}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}

// Export a convenience object for quick access
export const config = {
    env: MOBILE_ENV,
    isDev: IS_DEV,
    isStaging: IS_STAGING,
    isProd: IS_PROD,
    api: {
        baseUrl: API_BASE_URL,
        timeout: LIMITS.apiTimeoutMs,
    },
    razorpay: {
        keyId: RAZORPAY_KEY_ID,
    },
    deepLinks: {
        scheme: DEEP_LINK_SCHEME,
        prefix: DEEP_LINK_PREFIX,
        patterns: DEEP_LINK_PATTERNS,
    },
    push: {
        channels: PUSH_CHANNELS,
    },
    algolia: {
        appId: ALGOLIA_APP_ID,
        searchKey: ALGOLIA_SEARCH_KEY,
        indexName: ALGOLIA_INDEX_NAME,
    },
    features: FEATURES,
    limits: LIMITS,
};

export default config;

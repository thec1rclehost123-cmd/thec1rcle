/**
 * Analytics & Event Tracking Module
 * Multi-provider analytics with Firebase Analytics, Mixpanel, and Amplitude support
 */

// Optional Firebase Analytics import - gracefully handle if not installed
let FirebaseAnalytics: any = null;
try {
    FirebaseAnalytics = require("expo-firebase-analytics");
} catch {
    console.log("[Analytics] expo-firebase-analytics not installed, using console only");
}

type AnalyticsEvent = {
    name: string;
    properties?: Record<string, any>;
    timestamp: Date;
};

type AnalyticsProvider = "firebase" | "mixpanel" | "amplitude" | "console";

// Event queue for batching
const eventQueue: AnalyticsEvent[] = [];

// Configuration
const config = {
    debugMode: __DEV__,
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    enabledProviders: ["firebase", "console"] as AnalyticsProvider[], // Configure active providers
};

// Provider-specific initializations
let mixpanelClient: any = null;
let amplitudeClient: any = null;

/**
 * Initialize analytics providers
 */
export async function initAnalytics(): Promise<void> {
    try {
        // Firebase Analytics is auto-initialized via Expo

        // Mixpanel initialization (if enabled)
        if (config.enabledProviders.includes("mixpanel")) {
            // const Mixpanel = require("mixpanel-react-native").Mixpanel;
            // mixpanelClient = new Mixpanel("YOUR_MIXPANEL_TOKEN");
            // await mixpanelClient.init();
            console.log("[Analytics] Mixpanel: Add token to enable");
        }

        // Amplitude initialization (if enabled)
        if (config.enabledProviders.includes("amplitude")) {
            // const Amplitude = require("@amplitude/analytics-react-native");
            // amplitudeClient = Amplitude.createInstance();
            // await amplitudeClient.init("YOUR_AMPLITUDE_API_KEY");
            console.log("[Analytics] Amplitude: Add API key to enable");
        }

        console.log("[Analytics] Initialized with providers:", config.enabledProviders);
    } catch (error) {
        console.error("[Analytics] Init error:", error);
    }
}

/**
 * Set user identity across all providers
 */
export function identify(userId: string, userProperties?: Record<string, any>): void {
    if (config.debugMode) {
        console.log("[Analytics] Identify:", userId, userProperties);
    }

    // Firebase
    if (config.enabledProviders.includes("firebase") && FirebaseAnalytics) {
        FirebaseAnalytics.setUserId(userId);
        if (userProperties) {
            Object.entries(userProperties).forEach(([key, value]) => {
                FirebaseAnalytics.setUserProperty(key, String(value));
            });
        }
    }

    // Mixpanel
    if (mixpanelClient) {
        mixpanelClient.identify(userId);
        if (userProperties) {
            mixpanelClient.getPeople().set(userProperties);
        }
    }

    // Amplitude
    if (amplitudeClient) {
        amplitudeClient.setUserId(userId);
        if (userProperties) {
            amplitudeClient.identify(userProperties);
        }
    }
}

/**
 * Reset user identity (on logout)
 */
export function resetIdentity(): void {
    if (config.debugMode) {
        console.log("[Analytics] Reset identity");
    }

    if (config.enabledProviders.includes("firebase") && FirebaseAnalytics) {
        FirebaseAnalytics.setUserId(null);
    }

    if (mixpanelClient) {
        mixpanelClient.reset();
    }

    if (amplitudeClient) {
        amplitudeClient.reset();
    }
}

/**
 * Core tracking function - sends to all enabled providers
 */
export function track(eventName: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
        name: eventName,
        properties: {
            ...properties,
            platform: "mobile",
            appVersion: "1.0.0",
        },
        timestamp: new Date(),
    };

    // Console logging (dev mode)
    if (config.debugMode || config.enabledProviders.includes("console")) {
        console.log("[Analytics]", eventName, properties);
    }

    // Firebase Analytics (immediate)
    if (config.enabledProviders.includes("firebase") && FirebaseAnalytics) {
        try {
            FirebaseAnalytics.logEvent(eventName.replace(/[^a-zA-Z0-9_]/g, "_"), {
                ...properties,
                timestamp: event.timestamp.toISOString(),
            });
        } catch (error) {
            console.error("[Analytics] Firebase error:", error);
        }
    }

    // Mixpanel (immediate)
    if (mixpanelClient) {
        try {
            mixpanelClient.track(eventName, properties);
        } catch (error) {
            console.error("[Analytics] Mixpanel error:", error);
        }
    }

    // Amplitude (immediate)
    if (amplitudeClient) {
        try {
            amplitudeClient.track(eventName, properties);
        } catch (error) {
            console.error("[Analytics] Amplitude error:", error);
        }
    }

    // Also add to queue for batch processing
    eventQueue.push(event);

    // Auto-flush when batch size reached
    if (eventQueue.length >= config.batchSize) {
        flush();
    }
}

/**
 * Track screen views
 */
export function trackScreen(screenName: string, properties?: Record<string, any>): void {
    track("screen_view", {
        screen_name: screenName,
        ...properties,
    });

    // Firebase-specific screen logging
    if (config.enabledProviders.includes("firebase") && FirebaseAnalytics) {
        FirebaseAnalytics.setCurrentScreen(screenName);
    }
}

/**
 * Flush events to analytics provider (for batch processing)
 */
export async function flush(): Promise<void> {
    if (eventQueue.length === 0) return;

    const eventsToSend = [...eventQueue];
    eventQueue.length = 0;

    if (config.debugMode) {
        console.log("[Analytics] Flushed", eventsToSend.length, "events");
    }

    // Events already sent immediately to providers
    // This flush is for any secondary batch processing
}

// ============================================
// Pre-defined Event Helpers
// ============================================

// Navigation Events
export const AnalyticsEvents = {
    // Screen Views
    SCREEN_EXPLORE: "screen_explore",
    SCREEN_TICKETS: "screen_tickets",
    SCREEN_INBOX: "screen_inbox",
    SCREEN_PROFILE: "screen_profile",
    SCREEN_EVENT_DETAIL: "screen_event_detail",
    SCREEN_CHECKOUT: "screen_checkout",
    SCREEN_SEARCH: "screen_search",
    SCREEN_NOTIFICATIONS: "screen_notifications",
    SCREEN_SETTINGS: "screen_settings",
    SCREEN_EDIT_PROFILE: "screen_edit_profile",
    SCREEN_CHAT: "screen_chat",

    // Ticket Actions
    TICKET_VIEW: "ticket_view",
    TICKET_PURCHASE_START: "ticket_purchase_start",
    TICKET_PURCHASE_COMPLETE: "ticket_purchase_complete",
    TICKET_PURCHASE_FAILED: "ticket_purchase_failed",
    TICKET_QR_OPENED: "ticket_qr_opened",
    TICKET_TRANSFER_INITIATED: "ticket_transfer_initiated",
    TICKET_TRANSFER_COMPLETE: "ticket_transfer_complete",
    TICKET_ADD_TO_WALLET: "ticket_add_to_wallet",

    // Event Interactions
    EVENT_VIEW: "event_view",
    EVENT_SHARE: "event_share",
    EVENT_SAVE: "event_save",
    EVENT_UNSAVE: "event_unsave",

    // Social Actions
    CHAT_JOIN: "chat_join",
    CHAT_MESSAGE_SENT: "chat_message_sent",
    DM_REQUEST_SENT: "dm_request_sent",
    DM_REQUEST_ACCEPTED: "dm_request_accepted",
    CONTACT_SAVED: "contact_saved",
    GALLERY_PHOTO_VIEWED: "gallery_photo_viewed",

    // Safety Actions
    SOS_TRIGGERED: "sos_triggered",
    LOCATION_SHARED: "location_shared",
    EMERGENCY_CONTACT_ADDED: "emergency_contact_added",

    // Search
    SEARCH_PERFORMED: "search_performed",
    SEARCH_RESULT_TAPPED: "search_result_tapped",

    // Settings
    NOTIFICATION_TOGGLE: "notification_toggle",
    THEME_CHANGED: "theme_changed",
    PRIVACY_SETTING_CHANGED: "privacy_setting_changed",

    // Auth
    LOGIN_START: "login_start",
    LOGIN_SUCCESS: "login_success",
    LOGIN_FAILED: "login_failed",
    SIGNUP_START: "signup_start",
    SIGNUP_COMPLETE: "signup_complete",
    SIGNUP_FAILED: "signup_failed",
    LOGOUT: "logout",

    // Onboarding
    ONBOARDING_START: "onboarding_start",
    ONBOARDING_STEP: "onboarding_step",
    ONBOARDING_COMPLETE: "onboarding_complete",
    ONBOARDING_SKIP: "onboarding_skip",

    // Errors
    ERROR_NETWORK: "error_network",
    ERROR_PAYMENT: "error_payment",
    ERROR_DEEP_LINK: "error_deep_link",
    ERROR_CHAT_SEND: "error_chat_send",
    ERROR_IMAGE_UPLOAD: "error_image_upload",
};

// ============================================
// Convenience tracking functions
// ============================================

export function trackTicketPurchase(
    eventId: string,
    tierName: string,
    amount: number,
    quantity: number = 1
): void {
    track(AnalyticsEvents.TICKET_PURCHASE_COMPLETE, {
        event_id: eventId,
        tier_name: tierName,
        amount,
        quantity,
        currency: "INR",
    });

    // Revenue tracking
    if (config.enabledProviders.includes("firebase") && FirebaseAnalytics) {
        FirebaseAnalytics.logEvent("purchase", {
            value: amount,
            currency: "INR",
            items: [{ item_id: eventId, item_name: tierName, quantity }],
        });
    }
}

export function trackSearch(query: string, resultCount: number, filters?: Record<string, any>): void {
    track(AnalyticsEvents.SEARCH_PERFORMED, {
        query,
        result_count: resultCount,
        ...filters,
    });
}

export function trackError(type: string, message: string, context?: Record<string, any>): void {
    track(`error_${type}`, {
        error_message: message,
        ...context,
    });
}

export function trackSOS(eventId?: string, location?: { lat: number; lng: number }): void {
    track(AnalyticsEvents.SOS_TRIGGERED, {
        event_id: eventId,
        has_location: !!location,
    });
}

export function trackEventView(eventId: string, eventTitle: string, source?: string): void {
    track(AnalyticsEvents.EVENT_VIEW, {
        event_id: eventId,
        event_title: eventTitle,
        source: source || "unknown",
    });
}

export function trackPurchaseFailed(eventId: string, error: string): void {
    track(AnalyticsEvents.TICKET_PURCHASE_FAILED, {
        event_id: eventId,
        error,
    });
}

// Initialize auto-flush interval
if (typeof setInterval !== "undefined") {
    setInterval(flush, config.flushInterval);
}

export default {
    initAnalytics,
    identify,
    resetIdentity,
    track,
    trackScreen,
    trackError,
    flush,
    AnalyticsEvents,
};

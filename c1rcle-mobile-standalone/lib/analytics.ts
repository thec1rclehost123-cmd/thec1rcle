/**
 * THE C1RCLE Mobile — Analytics Service
 * 
 * Centralized tracking for key user flows and business metrics.
 */

import { IS_DEV, IS_PROD } from "./config";

// List of standard event names as per integration plan
export const ANALYTICS_EVENTS = {
    EVENT_VIEWED: "event_viewed",
    TICKET_PURCHASED: "ticket_purchased",
    CHECKOUT_ABANDONED: "checkout_abandoned",
    TICKET_TRANSFERRED: "ticket_transferred",
    SOS_TRIGGERED: "sos_triggered",
    CHAT_MESSAGE_SENT: "chat_message_sent",
    APP_OPENED: "app_opened",
    USER_LOGGED_IN: "user_logged_in",
    FOLLOW_VENUE: "follow_venue",
    // "You're Going" experience events
    GOING_SCREEN_VIEWED: "going_screen_viewed",
    GOING_SHARE_OPENED: "going_share_opened",
    GOING_SHARE_LINK_COPIED: "going_share_link_copied",
    GOING_SHARE_INSTAGRAM: "going_share_instagram",
    GOING_SHARE_SYSTEM: "going_share_system",
    // Promo Code events
    PROMO_APPLIED: "promo_applied",
    PROMO_FAILED: "promo_failed",
};

/**
 * Track an event to analytics providers (e.g. Firebase Analytics, Mixpanel)
 */
export async function trackEvent(eventName: string, properties: Record<string, any> = {}) {
    if (IS_DEV) {
        console.log(`📊 [Analytics] Event: ${eventName}`, properties);
        return;
    }

    try {
        // In a real app, this would integrate with Firebase Analytics or similar
        // Example: await analytics().logEvent(eventName, properties);

        if (IS_PROD) {
            // Mock production logging
            console.log(`[PROD ANALYTICS] ${eventName}`, properties);
        }
    } catch (error) {
        // Fail silently but log to console
        console.warn(`[Analytics] Failed to track event ${eventName}`, error);
    }
}

/**
 * Track screen transitions
 */
export function trackScreen(screenName: string) {
    if (IS_DEV) {
        console.log(`📱 [Analytics] Screen: ${screenName}`);
        return;
    }

    try {
        // Example: await analytics().logScreenView({ screen_name: screenName });
    } catch (error) {
        console.warn(`[Analytics] Failed to track screen ${screenName}`, error);
    }
}

/**
 * Identify user to analytics providers
 */
export async function identifyUser(userId: string, traits: Record<string, any> = {}) {
    if (IS_DEV) {
        console.log(`📊 [Analytics] Identify: ${userId}`, traits);
        return;
    }

    try {
        // Example: await analytics().setUserId(userId);
        // Example: await analytics().setUserProperties(traits);
    } catch (error) {
        console.warn(`[Analytics] Failed to identify user ${userId}`, error);
    }
}

/**
 * Reset analytics state on logout
 */
export async function resetAnalytics() {
    try {
        // Example: await analytics().resetAnalyticsData();
    } catch (error) {
        console.warn("[Analytics] Failed to reset analytics", error);
    }
}

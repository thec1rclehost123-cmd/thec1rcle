"use client";

/**
 * Analytics Utility for THE C1RCLE
 * Tracks user interactions and gating events.
 */

export const trackEvent = (eventName, properties = {}) => {
    if (typeof window === "undefined") return;

    console.log(`[Analytics] ${eventName}:`, properties);

    // If a real analytics provider (like Segment, PostHog, or GA4) is added later, 
    // it can be initialized and called here.
    // Example: window.posthog?.capture(eventName, properties);
};

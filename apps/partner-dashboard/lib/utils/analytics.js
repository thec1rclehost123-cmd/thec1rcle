"use client";

/**
 * Analytics Utility for THE C1RCLE
 * Tracks user interactions and gating events.
 */

export const trackEvent = (eventName, properties = {}) => {
    if (typeof window === "undefined") return;

    // TODO: wire real analytics provider (Segment, PostHog, GA4)
    // Example: window.posthog?.capture(eventName, properties);
};

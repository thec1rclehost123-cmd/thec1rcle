'use client';

/**
 * Analytics Utility for THE C1RCLE
 * Tracks user interactions and gating events.
 *
 * Provider priority: PostHog → Segment → dev console
 * Wire a provider by setting NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_SEGMENT_WRITE_KEY.
 */

export const trackEvent = (eventName, properties = {}) => {
  if (typeof window === 'undefined') return;

  // PostHog
  if (window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
    return;
  }

  // Segment
  if (window.analytics?.track) {
    window.analytics.track(eventName, properties);
    return;
  }

  // Development fallback — makes events visible without a provider
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', eventName, properties);
  }
};

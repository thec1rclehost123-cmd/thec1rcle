/**
 * THE C1RCLE - Real-time Analytics Service
 *
 * Handles high-frequency events like "people viewing" and
 * real-time dashboard notifications.
 */
/**
 * Track a page view for an event (Live Counter)
 * Uses a Redis Set with TTL per user/IP to avoid double counting.
 */
export function trackEventView(eventId: any, viewerId: any): Promise<boolean | undefined>;
/**
 * Get live viewer count for an event
 */
export function getLiveViewerCount(eventId: any): Promise<any>;
/**
 * Real-time Sales Notification (Pub/Sub)
 */
export function notifySale(venueId: any, saleData: any): Promise<void>;
/**
 * Track user interaction (swipe, click, view)
 */
export function trackInteraction(
  userId: any,
  targetId: any,
  type: any,
  metadata?: {},
): Promise<void>;

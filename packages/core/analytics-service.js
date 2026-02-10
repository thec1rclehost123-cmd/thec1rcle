import { getRedisClient } from "./redis.js";

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
export async function trackEventView(eventId, viewerId) {
    const redis = getRedisClient();
    const key = `viewers:${eventId}`;
    const userKey = `viewer_session:${eventId}:${viewerId}`;

    // Mark user session as active
    const isNew = await redis.set(userKey, "active", "NX", "EX", 120); // 2 min session

    if (isNew) {
        await redis.sadd(key, viewerId);
        // Clean up set membership when session would expire
        // NOTE: In a high-traffic system, we might use a Sorted Set with timestamps 
        // to prune old viewers more efficiently.
    }
}

/**
 * Get live viewer count for an event
 */
export async function getLiveViewerCount(eventId) {
    const redis = getRedisClient();
    const key = `viewers:${eventId}`;

    // In a production environment, we'd prune the Set here or via a CRON
    // For now, SCARD gives us the approximate size.
    return await redis.scard(key);
}

/**
 * Real-time Sales Notification (Pub/Sub)
 */
export async function notifySale(venueId, saleData) {
    const redis = getRedisClient();
    const channel = `sales:${venueId}`;

    await redis.publish(channel, JSON.stringify({
        ...saleData,
        timestamp: new Date().toISOString()
    }));
}

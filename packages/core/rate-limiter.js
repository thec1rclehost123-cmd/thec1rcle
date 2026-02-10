import { getRedisClient } from "./redis.js";

/**
 * THE C1RCLE - Distributed Rate Limiter (Redis-backed)
 * 
 * @param {string} key - Unique key for the rate limit (e.g., IP address, user ID)
 * @param {number} limit - Max number of requests allowed in the window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{success: boolean, limit: number, remaining: number, reset: number}>}
 */
export async function checkRateLimit(key, limit = 20, windowSeconds = 60) {
    const redis = getRedisClient();
    const fullKey = `ratelimit:${key}`;

    try {
        // Multi-exec for atomic increment and expire
        const pipeline = redis.pipeline();
        pipeline.incr(fullKey);
        pipeline.ttl(fullKey);

        const results = await pipeline.exec();
        const count = results[0][1];
        const ttl = results[1][1];

        // Set expiry if it's a new key
        if (ttl === -1) {
            await redis.expire(fullKey, windowSeconds);
        }

        const success = count <= limit;
        const remaining = Math.max(0, limit - count);

        return {
            success,
            limit,
            remaining,
            reset: ttl > 0 ? ttl : windowSeconds
        };
    } catch (error) {
        console.error("Rate Limit Error (Redis):", error);
        // Fallback to allow if Redis is down (fail-open)
        return { success: true, limit, remaining: 1, reset: windowSeconds };
    }
}

/**
 * Cleanup helper (optional)
 */
export async function clearRateLimit(key) {
    const redis = getRedisClient();
    await redis.del(`ratelimit:${key}`);
}

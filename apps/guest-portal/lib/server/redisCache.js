/**
 * Lightweight Redis read-through cache helpers for server-side store functions.
 * All functions fail open — a Redis outage never breaks data fetching.
 */

import { getRedisClient } from "@c1rcle/core/redis";

/**
 * Read a cached value. Returns null on miss or Redis error.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
    try {
        const redis = getRedisClient();
        if (!redis) return null;
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
}

/**
 * Write a value to cache. Silently no-ops on Redis error.
 * @param {string} key
 * @param {any} data
 * @param {number} ttlSeconds
 */
export async function cacheSet(key, data, ttlSeconds = 300) {
    try {
        const redis = getRedisClient();
        if (!redis) return;
        await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
        // non-fatal
    }
}

/**
 * Delete a cache key (call on writes/updates to invalidate stale data).
 * @param {string} key
 */
export async function cacheDel(key) {
    try {
        const redis = getRedisClient();
        if (!redis) return;
        await redis.del(key);
    } catch {
        // non-fatal
    }
}

/**
 * Build a stable cache key from an object of filter params.
 * @param {string} prefix
 * @param {Record<string, any>} params
 * @returns {string}
 */
export function buildCacheKey(prefix, params = {}) {
    const sorted = Object.keys(params)
        .sort()
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== "")
        .map(k => `${k}=${params[k]}`)
        .join(":");
    return sorted ? `${prefix}:${sorted}` : prefix;
}

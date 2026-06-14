/**
 * @c1rcle/core — Distributed Rate Limiter (Redis-backed)
 *
 * Two modes:
 *   checkRateLimit(key, limit, windowSeconds)
 *     → Standard rate limit, fails open on Redis error.
 *
 *   checkAdaptiveRateLimit(key, baseLimit, windowSeconds, reputationType, reputationId)
 *     → Automatically adjusts `limit` based on the entity's reputation score.
 *       High-risk entities get lower limits. Fails open on Redis/reputation error.
 *
 * Adaptive limit tiers (from reputation.js):
 *   normal    (score 0–10)   → 100% of baseLimit
 *   elevated  (score 10–25)  → 50% of baseLimit
 *   high      (score 25–50)  → 25% of baseLimit
 *   critical  (score 50+)    → 10% of baseLimit (effectively deny)
 */

import { getRedisClient } from "./redis.js";

// Module-level cache for high-risk mode status.
// Refreshed at most once every 5 seconds — avoids an extra Redis read on every rate-limit check
// while still propagating mode activation within 5 seconds of the threshold being crossed.
let _highRiskCache = { active: false, expiresAt: 0 };
const HIGH_RISK_CACHE_TTL_MS = 5_000;

// ── Core rate limit ───────────────────────────────────────────────────────────

/**
 * @param {string} key           - unique identifier (uid, IP, etc.)
 * @param {number} [limit=20]
 * @param {number} [windowSeconds=60]
 * @param {boolean} [failClosed=false]
 * @returns {Promise<{ success: boolean, limit: number, remaining: number, reset: number }>}
 */
export async function checkRateLimit(key, limit = 20, windowSeconds = 60, failClosed = false) {
    const redis   = getRedisClient();
    const fullKey = `ratelimit:${key}`;

    try {
        if (!redis || (redis.status !== "ready" && redis.status !== "connecting")) {
            console.warn(`[Redis] Client not ready, ${failClosed ? "FAILING CLOSED" : "failing open"} for rate limit`);
            return { success: !failClosed, limit, remaining: 0, reset: windowSeconds };
        }

        const pipeline = redis.pipeline();
        pipeline.incr(fullKey);
        pipeline.ttl(fullKey);
        const results = await pipeline.exec();

        if (!results || results.some(r => r[0])) {
            const err = results?.find(r => r[0])?.[0];
            console.warn(`[Redis] Rate limit pipeline failed (${failClosed ? "FAIL CLOSED" : "FAIL OPEN"}):`, err?.message);
            return { success: !failClosed, limit, remaining: 0, reset: windowSeconds };
        }

        const count = results[0][1];
        const ttl   = results[1][1];

        if (ttl === -1) {
            await redis.expire(fullKey, windowSeconds).catch(() => {});
        }

        return {
            success:   count <= limit,
            limit,
            remaining: Math.max(0, limit - count),
            reset:     ttl > 0 ? ttl : windowSeconds,
        };
    } catch (error) {
        console.warn(`[RateLimit] Error (${failClosed ? "FAIL CLOSED" : "FAIL OPEN"}):`, error.message);
        return { success: !failClosed, limit, remaining: 0, reset: windowSeconds };
    }
}

// ── Adaptive rate limit ───────────────────────────────────────────────────────

/**
 * Rate limit with automatic limit adjustment based on reputation score.
 * Lower-trust entities get smaller allowances. Fails open on any error.
 *
 * @param {string}                  key              - rate limit identifier
 * @param {number}                  baseLimit        - full allowance for normal-risk entities
 * @param {number}                  windowSeconds
 * @param {"ip"|"user"|"admin"}     reputationType
 * @param {string}                  reputationId     - IP / uid / adminId to score-lookup
 * @param {boolean}                 [failClosed=false]
 * @returns {Promise<{ success: boolean, limit: number, remaining: number, reset: number, tier: string }>}
 */
export async function checkAdaptiveRateLimit(key, baseLimit, windowSeconds, reputationType, reputationId, failClosed = false) {
    // Lazy import to avoid circular dependency — reputation imports redis, not rate-limiter
    let adaptiveLimit = baseLimit;
    let tier = "normal";

    try {
        const { getAdaptiveLimit } = await import("./reputation.js");
        const result = await getAdaptiveLimit(baseLimit, reputationType, reputationId);
        adaptiveLimit = result.limit;
        tier          = result.tier;
    } catch (_) {
        // Reputation system failure → fall back to base limit
    }

    // Apply 50% reduction when the system is in high-risk mode (distributed botnet detected).
    // The module-level cache means at most one Redis read per 5 seconds across all requests
    // on this instance — negligible overhead on the hot path.
    const now = Date.now();
    if (now > _highRiskCache.expiresAt) {
        try {
            const { isHighRiskMode } = await import("./security-state.js");
            _highRiskCache = { active: await isHighRiskMode(), expiresAt: now + HIGH_RISK_CACHE_TTL_MS };
        } catch (_) {
            // Keep stale value — do not block the request on a cache refresh failure
            _highRiskCache.expiresAt = now + HIGH_RISK_CACHE_TTL_MS;
        }
    }
    if (_highRiskCache.active) {
        adaptiveLimit = Math.max(1, Math.floor(adaptiveLimit / 2));
    }

    const result = await checkRateLimit(key, adaptiveLimit, windowSeconds, failClosed);
    return { ...result, tier, highRiskMode: _highRiskCache.active };
}

// ── Cleanup helper ────────────────────────────────────────────────────────────

export async function clearRateLimit(key) {
    const redis = getRedisClient();
    await redis.del(`ratelimit:${key}`);
}

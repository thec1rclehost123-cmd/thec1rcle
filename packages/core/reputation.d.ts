export function getRiskTier(score: any): {
    minScore: number;
    multiplier: number;
    label: string;
};
/**
 * Record a security event against an entity. Applies decay to existing score
 * before adding the new event weight, keeping the score accurate over time.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {string}               id     - IP address, uid, or adminId
 * @param {keyof SCORE_EVENTS}   event  - e.g. "AUTH_FAIL"
 * @returns {Promise<{ score: number, tier: string }>}
 */
export function addReputation(type: "ip" | "user" | "admin", id: string, event: keyof {
    AUTH_FAIL: number;
    RATE_LIMIT: number;
    PAYMENT_ANOMALY: number;
    ADMIN_ABUSE: number;
}): Promise<{
    score: number;
    tier: string;
}>;
/**
 * Get the current (decay-adjusted) score for an entity.
 * Returns 0 if the entity has no record or Redis is unavailable.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {string} id
 * @returns {Promise<number>}
 */
export function getReputationScore(type: "ip" | "user" | "admin", id: string): Promise<number>;
/**
 * Compute an adaptive rate limit for an entity based on its reputation score.
 * Returns the adjusted limit (always at least 1).
 *
 * @param {number} baseLimit
 * @param {"ip"|"user"|"admin"} type
 * @param {string} id
 * @returns {Promise<{ limit: number, tier: string }>}
 */
export function getAdaptiveLimit(baseLimit: number, type: "ip" | "user" | "admin", id: string): Promise<{
    limit: number;
    tier: string;
}>;
/**
 * Get the top-N riskiest entities of a given type.
 * Uses the sorted set for O(log N + N) lookup; applies decay per entity.
 * Entities whose decayed score drops below 1 are filtered out.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {number} [n=10]
 * @returns {Promise<Array<{ id: string, score: number, tier: string }>>}
 */
export function getTopRiskyEntities(type: "ip" | "user" | "admin", n?: number | undefined): Promise<Array<{
    id: string;
    score: number;
    tier: string;
}>>;
/**
 * Increment the attack trend counter for the current hour bucket.
 * Called automatically by attack-detection on every detected event.
 *
 * @param {string} eventType  - e.g. "AUTH_FAIL", "PAYMENT_ANOMALY"
 * @param {string} [endpoint] - optional endpoint label for endpoint trends
 */
export function recordAttackTrend(eventType: string, endpoint?: string | undefined): Promise<void>;
/**
 * Fetch attack trend data for the last 24 hourly buckets.
 * Returns a map of { hourKey: { AUTH_FAIL: n, PAYMENT_ANOMALY: n, ... } }
 *
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export function getAttackTrends(): Promise<Record<string, Record<string, number>>>;
export namespace SCORE_EVENTS {
    let AUTH_FAIL: number;
    let RATE_LIMIT: number;
    let PAYMENT_ANOMALY: number;
    let ADMIN_ABUSE: number;
}
export const RISK_TIERS: {
    minScore: number;
    multiplier: number;
    label: string;
}[];

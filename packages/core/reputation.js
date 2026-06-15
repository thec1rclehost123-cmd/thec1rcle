/**
 * @c1rcle/core — Reputation Scoring System
 *
 * Assigns risk scores to IPs, users, and admins based on observed events.
 * Scores decay exponentially with a 24-hour half-life — no background job needed,
 * decay is applied on read using stored (score, updatedAt).
 *
 * Redis schema:
 *   rep:score:ip:{ip}       → hash { score: number, updatedAt: ISO }
 *   rep:score:user:{uid}    → hash { score: number, updatedAt: ISO }
 *   rep:score:admin:{id}    → hash { score: number, updatedAt: ISO }
 *   rep:top:ips             → sorted set  member=ip,     score=raw_score  (top-N queries)
 *   rep:top:users           → sorted set  member=uid,    score=raw_score
 *   rep:top:admins          → sorted set  member=adminId, score=raw_score
 *   security:trends:{HH}    → hash  { AUTH_FAIL, PAYMENT_ANOMALY, RATE_LIMIT, PATTERN } (hourly)
 *
 * Score events:
 *   AUTH_FAIL        +1    (single failed token / wrong password)
 *   RATE_LIMIT       +2    (hit a rate limit window)
 *   PAYMENT_ANOMALY  +5    (signature mismatch, amount tamper, replay)
 *   ADMIN_ABUSE      +10   (burst of critical admin actions)
 *
 * Risk tiers (applied to decayed score):
 *   normal    0–10    → 100% of base limit
 *   elevated  10–25   → 50% of base limit
 *   high      25–50   → 25% of base limit
 *   critical  50+     → 10% of base limit (effectively deny)
 *
 * Usage:
 *   import { addReputation, getReputationScore, getAdaptiveLimit, getTopRiskyEntities, recordAttackTrend, getAttackTrends } from "@c1rcle/core/reputation";
 */

import { getRedisClient } from './redis.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const SCORE_EVENTS = {
  AUTH_FAIL: 1,
  RATE_LIMIT: 2,
  PAYMENT_ANOMALY: 5,
  ADMIN_ABUSE: 10,
};

// Score halves every 24 hours
const DECAY_HALF_LIFE_HOURS = 24;

// How long to keep a reputation record in Redis after it goes effectively-zero
// 7 days × 24h half-life = score reduced to 1/128 of original. Fine for cleanup.
const SCORE_TTL_SEC = 7 * 24 * 3600;

// Top-N sorted set TTL — refreshed on each write
const TOP_SET_TTL_SEC = 48 * 3600;

export const RISK_TIERS = [
  { minScore: 50, multiplier: 0.1, label: 'critical' },
  { minScore: 25, multiplier: 0.25, label: 'high' },
  { minScore: 10, multiplier: 0.5, label: 'elevated' },
  { minScore: 0, multiplier: 1.0, label: 'normal' },
];

// ── Decay math ────────────────────────────────────────────────────────────────

function applyDecay(rawScore, updatedAt) {
  if (!rawScore || !updatedAt) return 0;
  const hoursSince = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
  // Exponential decay: score × 0.5^(hours / half_life)
  return rawScore * Math.pow(0.5, hoursSince / DECAY_HALF_LIFE_HOURS);
}

export function getRiskTier(score) {
  for (const tier of RISK_TIERS) {
    if (score >= tier.minScore) return tier;
  }
  return RISK_TIERS[RISK_TIERS.length - 1];
}

// ── Core helpers ──────────────────────────────────────────────────────────────

async function safeExec(fn, fallback) {
  try {
    const redis = getRedisClient();
    return await fn(redis);
  } catch (_) {
    return fallback;
  }
}

function scoreKey(type, id) {
  return `rep:score:${type}:${id}`;
}
function topKey(type) {
  return `rep:top:${type}s`;
}

// ── Reputation write ──────────────────────────────────────────────────────────

/**
 * Record a security event against an entity. Applies decay to existing score
 * before adding the new event weight, keeping the score accurate over time.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {string}               id     - IP address, uid, or adminId
 * @param {keyof SCORE_EVENTS}   event  - e.g. "AUTH_FAIL"
 * @returns {Promise<{ score: number, tier: string }>}
 */
export async function addReputation(type, id, event) {
  if (!id || !event || !(event in SCORE_EVENTS)) return { score: 0, tier: 'normal' };

  return safeExec(
    async (redis) => {
      const key = scoreKey(type, id);
      const now = new Date().toISOString();
      const data = await redis.hgetall(key);

      // Apply decay to the base before adding new points
      const decayedBase = data?.score ? applyDecay(parseFloat(data.score), data.updatedAt) : 0;
      const newScore = decayedBase + SCORE_EVENTS[event];
      const tier = getRiskTier(newScore);

      // Persist decayed+incremented score, reset updatedAt to now
      await redis
        .pipeline()
        .hset(key, { score: newScore.toFixed(4), updatedAt: now })
        .expire(key, SCORE_TTL_SEC)
        // Update sorted set for top-N dashboard queries
        .zadd(topKey(type), newScore, id)
        .expire(topKey(type), TOP_SET_TTL_SEC)
        .exec();

      return { score: newScore, tier: tier.label };
    },
    { score: 0, tier: 'normal' },
  );
}

// ── Reputation read ───────────────────────────────────────────────────────────

/**
 * Get the current (decay-adjusted) score for an entity.
 * Returns 0 if the entity has no record or Redis is unavailable.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {string} id
 * @returns {Promise<number>}
 */
export async function getReputationScore(type, id) {
  if (!id) return 0;
  return safeExec(async (redis) => {
    const data = await redis.hgetall(scoreKey(type, id));
    if (!data?.score) return 0;
    return applyDecay(parseFloat(data.score), data.updatedAt);
  }, 0);
}

// ── Adaptive limit ────────────────────────────────────────────────────────────

/**
 * Compute an adaptive rate limit for an entity based on its reputation score.
 * Returns the adjusted limit (always at least 1).
 *
 * @param {number} baseLimit
 * @param {"ip"|"user"|"admin"} type
 * @param {string} id
 * @returns {Promise<{ limit: number, tier: string }>}
 */
export async function getAdaptiveLimit(baseLimit, type, id) {
  const score = await getReputationScore(type, id);
  const tier = getRiskTier(score);
  return {
    limit: Math.max(1, Math.floor(baseLimit * tier.multiplier)),
    tier: tier.label,
    score,
  };
}

// ── Top-N query ───────────────────────────────────────────────────────────────

/**
 * Get the top-N riskiest entities of a given type.
 * Uses the sorted set for O(log N + N) lookup; applies decay per entity.
 * Entities whose decayed score drops below 1 are filtered out.
 *
 * @param {"ip"|"user"|"admin"} type
 * @param {number} [n=10]
 * @returns {Promise<Array<{ id: string, score: number, tier: string }>>}
 */
export async function getTopRiskyEntities(type, n = 10) {
  return safeExec(async (redis) => {
    // Read top 2N candidates by raw score (some may have decayed to near-zero)
    const members = await redis.zrevrange(topKey(type), 0, n * 2 - 1);
    if (!members.length) return [];

    // Batch-fetch all score hashes in one pipeline round-trip
    const pipeline = redis.pipeline();
    members.forEach((id) => pipeline.hgetall(scoreKey(type, id)));
    const results = await pipeline.exec();

    return members
      .map((id, i) => {
        const data = results[i][1];
        if (!data?.score) return null;
        const score = applyDecay(parseFloat(data.score), data.updatedAt);
        return { id, score: parseFloat(score.toFixed(2)), tier: getRiskTier(score).label };
      })
      .filter((e) => e !== null && e.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }, []);
}

// ── Attack trends ─────────────────────────────────────────────────────────────

/**
 * Increment the attack trend counter for the current hour bucket.
 * Called automatically by attack-detection on every detected event.
 *
 * @param {string} eventType  - e.g. "AUTH_FAIL", "PAYMENT_ANOMALY"
 * @param {string} [endpoint] - optional endpoint label for endpoint trends
 */
export async function recordAttackTrend(eventType, endpoint) {
  await safeExec(async (redis) => {
    const hour = new Date().toISOString().slice(0, 13).replace('T', '-'); // "2024-01-01-14"
    const key = `security:trends:${hour}`;
    const pipeline = redis
      .pipeline()
      .hincrby(key, eventType, 1)
      .expire(key, 25 * 3600); // 25h — covers full 24h window with 1h overlap

    if (endpoint) {
      pipeline.hincrby(`security:endpoints:${hour}`, endpoint, 1);
      pipeline.expire(`security:endpoints:${hour}`, 25 * 3600);
    }
    await pipeline.exec();
  }, null);
}

/**
 * Fetch attack trend data for the last 24 hourly buckets.
 * Returns a map of { hourKey: { AUTH_FAIL: n, PAYMENT_ANOMALY: n, ... } }
 *
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export async function getAttackTrends() {
  return safeExec(
    async (redis) => {
      const buckets = Array.from({ length: 24 }, (_, i) => {
        const d = new Date(Date.now() - i * 3_600_000);
        return d.toISOString().slice(0, 13).replace('T', '-');
      });

      const pipeline = redis.pipeline();
      buckets.forEach((b) => {
        pipeline.hgetall(`security:trends:${b}`);
        pipeline.hgetall(`security:endpoints:${b}`);
      });
      const results = await pipeline.exec();

      const trends = {};
      const endpoints = {};
      buckets.forEach((b, i) => {
        const tData = results[i * 2][1];
        const eData = results[i * 2 + 1][1];
        if (tData) {
          trends[b] = Object.fromEntries(
            Object.entries(tData).map(([k, v]) => [k, parseInt(v, 10)]),
          );
        }
        if (eData) {
          Object.entries(eData).forEach(([endpoint, count]) => {
            endpoints[endpoint] = (endpoints[endpoint] || 0) + parseInt(count, 10);
          });
        }
      });

      // Sort most-targeted endpoints
      const mostTargetedEndpoints = Object.entries(endpoints)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { trends, mostTargetedEndpoints };
    },
    { trends: {}, mostTargetedEndpoints: [] },
  );
}

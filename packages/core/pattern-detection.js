/**
 * @c1rcle/core — Suspicious Pattern Detection
 *
 * Detects attack patterns that single-event counters miss:
 *   1. IP targeting multiple accounts  (credential spray across users)
 *   2. Account accessed from many IPs  (account-takeover attempt / proxy rotation)
 *   3. Activity spike for a user       (automated abuse burst)
 *
 * Uses HyperLogLog for distinct-count tracking (O(1), ~0.81% error — fine for security
 * thresholds) and a sorted-set timestamp window for spike detection.
 *
 * Redis schema:
 *   pattern:ip_targets:{ip}    → HyperLogLog of UIDs targeted by IP    (1hr TTL)
 *   pattern:uid_ips:{uid}      → HyperLogLog of IPs for this account   (30min TTL)
 *   pattern:activity:{uid}     → sorted set of epoch-ms timestamps     (5min window)
 *
 * Thresholds:
 *   IP   → >5 distinct accounts  in 1hr    = multi-account spray
 *   UID  → >3 distinct IPs       in 30min  = account under siege
 *   UID  → >30 events            in 5min   = activity spike
 *
 * Usage:
 *   import { recordAndCheckPatterns, checkActivitySpike } from "@c1rcle/core/pattern-detection";
 *
 *   const patterns = await recordAndCheckPatterns(ip, uid);
 *   // patterns: [{ type: "MULTI_ACCOUNT_SPRAY", detail: "6 accounts targeted" }, ...]
 *
 *   const spike = await checkActivitySpike(uid);
 *   if (spike.detected) { ... }
 */

import { getRedisClient } from './redis.js';
import { blockIp, flagUser } from './security-state.js';
import { addReputation } from './reputation.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  IP_DISTINCT_ACCOUNTS: { limit: 5, windowSec: 3600 }, // 1 hour
  UID_DISTINCT_IPS: { limit: 3, windowSec: 1800 }, // 30 minutes
  ACTIVITY_SPIKE: { limit: 30, windowMs: 5 * 60_000 }, // 5 minutes
};

// ── Internal helpers ──────────────────────────────────────────────────────────

async function safeExec(fn, fallback) {
  try {
    const redis = getRedisClient();
    return await fn(redis);
  } catch (_) {
    return fallback;
  }
}

// ── Core: record IP→UID and UID→IP relationships ──────────────────────────────

/**
 * Record that `ip` made a request against `uid`, and check for suspicious patterns.
 * Returns an array of detected patterns (empty if none).
 *
 * Should be called on every auth attempt (successful or failed) and payment request.
 *
 * @param {string|null} ip
 * @param {string|null} uid
 * @returns {Promise<Array<{ type: string, detail: string }>>}
 */
export async function recordAndCheckPatterns(ip, uid) {
  if (!ip && !uid) return [];

  return safeExec(async (redis) => {
    const detected = [];
    const pipeline = redis.pipeline();

    // Record IP→UID mapping (what accounts has this IP touched?)
    if (ip && uid) {
      pipeline.pfadd(`pattern:ip_targets:${ip}`, uid);
      pipeline.expire(`pattern:ip_targets:${ip}`, THRESHOLDS.IP_DISTINCT_ACCOUNTS.windowSec);
    }

    // Record UID→IP mapping (how many IPs have touched this account?)
    if (uid && ip) {
      pipeline.pfadd(`pattern:uid_ips:${uid}`, ip);
      pipeline.expire(`pattern:uid_ips:${uid}`, THRESHOLDS.UID_DISTINCT_IPS.windowSec);
    }

    await pipeline.exec();

    // Now read the cardinalities to check thresholds
    const countPipeline = redis.pipeline();
    if (ip && uid) countPipeline.pfcount(`pattern:ip_targets:${ip}`);
    else countPipeline.echo('0');

    if (uid && ip) countPipeline.pfcount(`pattern:uid_ips:${uid}`);
    else countPipeline.echo('0');

    const counts = await countPipeline.exec();
    const ipTargetCount = parseInt(counts[0][1], 10) || 0;
    const uidIpCount = parseInt(counts[1][1], 10) || 0;

    // Pattern 1: Same IP targeting many accounts → credential spray
    if (ip && ipTargetCount > THRESHOLDS.IP_DISTINCT_ACCOUNTS.limit) {
      detected.push({
        type: 'MULTI_ACCOUNT_SPRAY',
        detail: `IP ${ip} targeted ${ipTargetCount} distinct accounts in 1hr`,
      });
      // Auto-block the spray IP with extended TTL
      await blockIp(ip, `multi_account_spray:${ipTargetCount}_accounts`, 60 * 60); // 1hr
      await addReputation('ip', ip, 'AUTH_FAIL'); // push score higher
    }

    // Pattern 2: Same account accessed from many IPs → account under siege / proxy rotation
    if (uid && uidIpCount > THRESHOLDS.UID_DISTINCT_IPS.limit) {
      detected.push({
        type: 'ACCOUNT_SIEGE',
        detail: `Account ${uid} accessed from ${uidIpCount} distinct IPs in 30min`,
      });
      // Flag the account for review (don't hard-block — could be VPN users)
      await flagUser(uid, `account_siege:${uidIpCount}_distinct_ips`);
      await addReputation('user', uid, 'AUTH_FAIL');
    }

    return detected;
  }, []);
}

// ── Activity spike detection ──────────────────────────────────────────────────

/**
 * Record a user event and check for activity spikes.
 * Uses a sorted set of timestamps to count events in a rolling 5-minute window.
 *
 * @param {string} uid
 * @param {string} [eventLabel] - label for the event type (for debugging)
 * @returns {Promise<{ detected: boolean, count: number }>}
 */
export async function checkActivitySpike(uid, eventLabel = 'event') {
  if (!uid) return { detected: false, count: 0 };

  return safeExec(
    async (redis) => {
      const key = `pattern:activity:${uid}`;
      const now = Date.now();
      const cutoff = now - THRESHOLDS.ACTIVITY_SPIKE.windowMs;

      // Add current timestamp, trim old entries, count window — all atomic
      await redis
        .pipeline()
        .zadd(key, now, now.toString())
        .zremrangebyscore(key, '-inf', cutoff)
        .expire(key, 600) // 10 min max TTL
        .exec();

      const count = await redis.zcount(key, cutoff, '+inf');

      return {
        detected: count > THRESHOLDS.ACTIVITY_SPIKE.limit,
        count,
      };
    },
    { detected: false, count: 0 },
  );
}

/**
 * Read the current distinct-account count for an IP (for dashboard display).
 * Read-only — does not record anything.
 *
 * @param {string} ip
 * @returns {Promise<number>}
 */
export async function getIpTargetCount(ip) {
  return safeExec(async (redis) => {
    const val = await redis.pfcount(`pattern:ip_targets:${ip}`);
    return parseInt(val, 10) || 0;
  }, 0);
}

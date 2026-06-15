/**
 * @c1rcle/core — Security State Store
 *
 * Centralized Redis-backed security state for the active defense system.
 * All state is TTL-based — nothing is permanent. Admin override always possible.
 *
 * Key schema:
 *   blocked:ip:{ip}          → hash { reason, blockedAt, ttlSec }   — auto-expires
 *   blocked:user:{uid}       → hash { reason, blockedAt, ttlSec }   — auto-expires
 *   flagged:user:{uid}       → hash { reason, flaggedAt }           — 7 day TTL (review queue)
 *   suspicious:admin:{id}    → hash { reason, detectedAt, ttlSec }  — auto-expires
 *
 * Tracking sets (for overview — membership may lag TTL expiry by up to 1s, always re-verify):
 *   security:set:blocked:ips     → Redis set of currently-blocked IPs
 *   security:set:blocked:users   → Redis set of currently-blocked UIDs
 *   security:set:flagged:users   → Redis set of flagged UIDs
 *   security:set:suspicious:admins → Redis set of suspicious adminIds
 *
 * Recent attack log:
 *   security:attacks:log  → Redis list (capped at 200 entries, newest first)
 *
 * Usage:
 *   import { blockIp, blockUser, isIpBlocked, isUserBlocked, isUserFlagged, isAdminSuspicious } from "@c1rcle/core/security-state";
 */

import { getRedisClient } from './redis.js';
import { getAdminDb } from './admin.js';

// ── Hybrid Fail Strategy ──────────────────────────────────────────────────────
//
// When Redis is unavailable, critical endpoints should NOT fail open silently.
// Instead they apply an in-process memory rate limiter as a degraded-mode guard.
//
// Non-critical endpoints continue to fail open (return { blocked: false }).
//
// The in-memory limiter is per-process. On multi-instance deployments it is not
// distributed, but it still provides meaningful per-instance rate protection
// and is far safer than failing open entirely on a payment or auth endpoint.

/** Map<key, { count: number, resetAt: number }> */
const _memFallback = new Map();

// ── Firestore block persistence ───────────────────────────────────────────────
//
// On every block write, we mirror the record to Firestore `security_blocks`.
// This collection is the fallback read source when Redis is unavailable.
//
// Schema — document ID: `{type}:{entityId}`
//   type:       'ip' | 'user' | 'admin'
//   entityId:   IP address / uid / adminId
//   reason:     human-readable reason string
//   blockedAt:  ISO timestamp
//   expiresAt:  ISO timestamp (blockedAt + ttlSec)
//
// On block reads: when Redis is down, check Firestore and compare expiresAt to now.
// On unblock:     delete from Firestore in parallel with Redis DEL.

/**
 * Mirror a block record to Firestore. Fire-and-forget — never blocks the caller.
 * Silently no-ops when Firebase is not configured.
 */
function writeBlockToFirestore(type, entityId, reason, ttlSec) {
  try {
    const db = getAdminDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSec * 1000);
    db.collection('security_blocks')
      .doc(`${type}:${entityId}`)
      .set({
        type,
        entityId,
        reason,
        blockedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })
      .catch(() => {});
  } catch (_) {
    /* Firebase not configured — skip */
  }
}

/**
 * Delete a block record from Firestore. Fire-and-forget.
 */
function deleteBlockFromFirestore(type, entityId) {
  try {
    const db = getAdminDb();
    db.collection('security_blocks')
      .doc(`${type}:${entityId}`)
      .delete()
      .catch(() => {});
  } catch (_) {
    /* skip */
  }
}

/**
 * Check the Firestore fallback for a block record.
 * Only called when Redis is unavailable.
 *
 * @param {'ip'|'user'|'admin'} type
 * @param {string}              entityId
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
async function checkFirestoreBlock(type, entityId) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('security_blocks').doc(`${type}:${entityId}`).get();
    if (!doc.exists) return { blocked: false };

    const data = doc.data();
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    if (expiresAt && expiresAt < new Date()) {
      // TTL expired — clean up asynchronously and treat as unblocked
      doc.ref.delete().catch(() => {});
      return { blocked: false };
    }
    return { blocked: true, reason: data.reason };
  } catch (_) {
    // Firestore also unavailable — fail open as a last resort
    return { blocked: false };
  }
}

/**
 * Returns true if Redis is connected and ready for commands.
 * Synchronous — safe to call in hot paths.
 */
export function isRedisHealthy() {
  try {
    const redis = getRedisClient();
    if (!redis) return false;
    return redis.status === 'ready';
  } catch (_) {
    return false;
  }
}

/**
 * In-process rate limiter used when Redis is unavailable.
 * Cleans up its own expired entries on each write to avoid unbounded growth.
 *
 * @param {string} key
 * @param {number} limit       - max requests allowed in the window
 * @param {number} windowMs    - window length in milliseconds
 * @returns {{ allowed: boolean, count: number, remaining: number }}
 */
export function memoryRateLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  const current = _memFallback.get(key);

  if (!current || now > current.resetAt) {
    _memFallback.set(key, { count: 1, resetAt: now + windowMs });
    // Prune expired keys (cap map size) on new-window writes
    if (_memFallback.size > 5000) {
      for (const [k, v] of _memFallback) {
        if (now > v.resetAt) _memFallback.delete(k);
      }
    }
    return { allowed: true, count: 1, remaining: limit - 1 };
  }

  current.count++;
  return {
    allowed: current.count <= limit,
    count: current.count,
    remaining: Math.max(0, limit - current.count),
  };
}

/**
 * Checks a critical endpoint using the hybrid strategy:
 *   - Redis healthy  → returns { degraded: false } (caller uses normal block checks)
 *   - Redis down     → applies in-memory rate limit with tight `criticalLimit`
 *
 * CRITICAL limits (suggested):
 *   Auth:    3 req/min/IP  — typos happen, but >3/min is a bot
 *   Payment: 2 req/min/UID — legitimate users rarely retry this fast
 *   Admin:   5 req/min/IP  — human admins are slow
 *
 * @param {string} identifier  - e.g. `auth:ip:${ip}` or `payment:uid:${uid}`
 * @param {number} criticalLimit
 * @param {number} [windowMs]
 * @returns {{ allowed: boolean, degraded: boolean }}
 */
export function checkCriticalEndpoint(identifier, criticalLimit, windowMs = 60_000) {
  if (isRedisHealthy()) {
    // Redis is up — normal path, block checks handle enforcement
    return { allowed: true, degraded: false };
  }
  const result = memoryRateLimit(`degraded:${identifier}`, criticalLimit, windowMs);
  return { allowed: result.allowed, degraded: true };
}

// ── Global auth velocity + high-risk mode ────────────────────────────────────
//
// Tracks total auth failures across ALL IPs in a rolling window.
// When the global failure rate exceeds the threshold, "high-risk mode" is activated.
// All rate limits are halved while the mode is active — this catches distributed
// botnets that stay below per-IP and per-UID thresholds individually.
//
// Redis keys:
//   global:velocity:auth_failures  → INCR counter, 60-second TTL
//   global:high_risk_mode          → presence key, 5-minute TTL (refreshed on each violation)

const GLOBAL_VELOCITY = {
  threshold: 100, // total failures per minute that activate high-risk mode
  windowSec: 60, // rolling window length
  highRiskTtlSec: 300, // high-risk mode stays active 5 minutes after last violation
};

/**
 * Increment the global auth failure counter and activate high-risk mode if threshold is crossed.
 * Called on every credential stuffing detection event.
 * Fire-and-forget friendly — errors are swallowed.
 */
export async function recordGlobalAuthFailure() {
  await safeExec(async (redis) => {
    const count = await redis.incr('global:velocity:auth_failures');
    if (count === 1) {
      // First count in this window — set the expiry
      await redis.expire('global:velocity:auth_failures', GLOBAL_VELOCITY.windowSec);
    }
    if (count >= GLOBAL_VELOCITY.threshold) {
      // Activate or refresh high-risk mode TTL on each violation above threshold.
      // Using plain SET (not NX) refreshes the TTL on sustained attacks.
      await redis.set('global:high_risk_mode', String(count), 'EX', GLOBAL_VELOCITY.highRiskTtlSec);
      console.warn(
        '[SecurityState] global_high_risk_mode activated',
        JSON.stringify({ count, threshold: GLOBAL_VELOCITY.threshold }),
      );
    }
  }, null);
}

/**
 * Returns true when the system is in high-risk mode (sustained distributed attack detected).
 * Used by the adaptive rate limiter to halve all limits until the mode expires.
 */
export async function isHighRiskMode() {
  return safeExec(async (redis) => {
    const val = await redis.get('global:high_risk_mode');
    return val !== null;
  }, false); // Redis down → unknown state → don't restrict all users
}

// ── TTL constants ─────────────────────────────────────────────────────────────

export const TTL = {
  // IP block: 30 minutes — long enough to stop an attack, short enough to avoid false-positive lockouts
  IP_BLOCK: 30 * 60,
  // User block: 1 hour — prevents continued abuse while keeping account accessible
  USER_BLOCK: 60 * 60,
  // Admin suspension: 2 hours — forces re-authentication and review
  ADMIN_SUSPENSION: 2 * 60 * 60,
  // User flag: 7 days — stays in the review queue until cleared by an admin
  USER_FLAG: 7 * 24 * 60 * 60,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Safe Redis execute.
 * If Redis is unavailable, calls `fallback` if it is a function, otherwise returns it as-is.
 * Existing callers that pass a static value (null, { blocked: false }) are unaffected.
 * Block-check callers pass an async function that queries the Firestore fallback layer.
 */
async function safeExec(fn, fallback) {
  try {
    const redis = getRedisClient();
    if (!redis || (redis.status !== 'ready' && redis.status !== 'connecting')) {
      return typeof fallback === 'function' ? await fallback() : fallback;
    }
    return await fn(redis);
  } catch (_) {
    return typeof fallback === 'function' ? await fallback() : fallback;
  }
}

/**
 * Append an entry to the attack log (capped list, newest first).
 */
async function logAttack(entry) {
  await safeExec(async (redis) => {
    const item = JSON.stringify({ ...entry, ts: new Date().toISOString() });
    await redis
      .pipeline()
      .lpush('security:attacks:log', item)
      .ltrim('security:attacks:log', 0, 199)
      .exec();
  }, null);
}

// ── Block IP ──────────────────────────────────────────────────────────────────

/**
 * Block an IP address for the given TTL.
 * @param {string} ip
 * @param {string} reason - human-readable reason (logged, not exposed to client)
 * @param {number} [ttlSec]
 */
export async function blockIp(ip, reason, ttlSec = TTL.IP_BLOCK) {
  // Allow "fp:..." fingerprint identifiers — only reject null/empty
  if (!ip) return;
  await safeExec(async (redis) => {
    const key = `blocked:ip:${ip}`;
    await redis
      .pipeline()
      .hset(key, { reason, blockedAt: new Date().toISOString(), ttlSec })
      .expire(key, ttlSec)
      .sadd('security:set:blocked:ips', ip)
      .exec();
  }, null);
  // Mirror to Firestore — ensures block survives Redis outages
  writeBlockToFirestore('ip', ip, reason, ttlSec);
  await logAttack({ type: 'IP_BLOCKED', ip, reason, ttlSec });
}

/**
 * Remove an IP block (admin override).
 */
export async function unblockIp(ip) {
  await safeExec(async (redis) => {
    await redis.pipeline().del(`blocked:ip:${ip}`).srem('security:set:blocked:ips', ip).exec();
  }, null);
  deleteBlockFromFirestore('ip', ip);
}

/**
 * Check if an IP is currently blocked.
 * @param {string} ip
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export async function isIpBlocked(ip) {
  if (!ip) return { blocked: false };
  return safeExec(
    async (redis) => {
      const data = await redis.hgetall(`blocked:ip:${ip}`);
      if (!data || !data.reason) return { blocked: false };
      return { blocked: true, reason: data.reason };
    },
    async () => {
      // Redis unavailable — check Firestore persistence layer
      console.warn(
        '[SecurityState:Degraded] redis_unavailable — isIpBlocked falling back to Firestore',
        JSON.stringify({ ip }),
      );
      return checkFirestoreBlock('ip', ip);
    },
  );
}

// ── Block User ────────────────────────────────────────────────────────────────

/**
 * Block a user account for the given TTL.
 * @param {string} uid
 * @param {string} reason
 * @param {number} [ttlSec]
 */
export async function blockUser(uid, reason, ttlSec = TTL.USER_BLOCK) {
  if (!uid) return;
  await safeExec(async (redis) => {
    const key = `blocked:user:${uid}`;
    await redis
      .pipeline()
      .hset(key, { reason, blockedAt: new Date().toISOString(), ttlSec })
      .expire(key, ttlSec)
      .sadd('security:set:blocked:users', uid)
      .exec();
  }, null);
  writeBlockToFirestore('user', uid, reason, ttlSec);
  await logAttack({ type: 'USER_BLOCKED', uid, reason, ttlSec });
}

/**
 * Remove a user block (admin override).
 */
export async function unblockUser(uid) {
  await safeExec(async (redis) => {
    await redis
      .pipeline()
      .del(`blocked:user:${uid}`)
      .srem('security:set:blocked:users', uid)
      .exec();
  }, null);
  deleteBlockFromFirestore('user', uid);
}

/**
 * Check if a user is currently blocked.
 * @param {string} uid
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export async function isUserBlocked(uid) {
  if (!uid) return { blocked: false };
  return safeExec(
    async (redis) => {
      const data = await redis.hgetall(`blocked:user:${uid}`);
      if (!data || !data.reason) return { blocked: false };
      return { blocked: true, reason: data.reason };
    },
    async () => {
      console.warn(
        '[SecurityState:Degraded] redis_unavailable — isUserBlocked falling back to Firestore',
        JSON.stringify({ uid }),
      );
      return checkFirestoreBlock('user', uid);
    },
  );
}

// ── Flag User (review queue) ──────────────────────────────────────────────────

/**
 * Flag a user for manual review. Does NOT block them — just marks for ops review.
 * @param {string} uid
 * @param {string} reason
 */
export async function flagUser(uid, reason) {
  if (!uid) return;
  await safeExec(async (redis) => {
    const key = `flagged:user:${uid}`;
    await redis
      .pipeline()
      .hset(key, { reason, flaggedAt: new Date().toISOString() })
      .expire(key, TTL.USER_FLAG)
      .sadd('security:set:flagged:users', uid)
      .exec();
  }, null);
  await logAttack({ type: 'USER_FLAGGED', uid, reason });
}

/**
 * Clear a user flag (admin override / ops review complete).
 */
export async function unflagUser(uid) {
  await safeExec(async (redis) => {
    await redis
      .pipeline()
      .del(`flagged:user:${uid}`)
      .srem('security:set:flagged:users', uid)
      .exec();
  }, null);
}

/**
 * Check if a user is flagged for review.
 * @param {string} uid
 * @returns {Promise<{ flagged: boolean, reason?: string }>}
 */
export async function isUserFlagged(uid) {
  if (!uid) return { flagged: false };
  return safeExec(
    async (redis) => {
      const data = await redis.hgetall(`flagged:user:${uid}`);
      if (!data || !data.reason) return { flagged: false };
      return { flagged: true, reason: data.reason };
    },
    { flagged: false },
  );
}

// ── Suspend Admin ─────────────────────────────────────────────────────────────

/**
 * Mark an admin as suspicious / temporarily suspended.
 * This does NOT revoke Firebase tokens — the caller must do that separately
 * via Firebase Admin auth.revokeRefreshTokens(adminId) for immediate effect.
 *
 * @param {string} adminId
 * @param {string} reason
 * @param {number} [ttlSec]
 */
export async function suspendAdmin(adminId, reason, ttlSec = TTL.ADMIN_SUSPENSION) {
  if (!adminId) return;
  await safeExec(async (redis) => {
    const key = `suspicious:admin:${adminId}`;
    await redis
      .pipeline()
      .hset(key, { reason, detectedAt: new Date().toISOString(), ttlSec })
      .expire(key, ttlSec)
      .sadd('security:set:suspicious:admins', adminId)
      .exec();
  }, null);
  writeBlockToFirestore('admin', adminId, reason, ttlSec);
  await logAttack({ type: 'ADMIN_SUSPENDED', adminId, reason, ttlSec });
}

/**
 * Clear an admin suspension (after review).
 */
export async function clearAdminSuspension(adminId) {
  await safeExec(async (redis) => {
    await redis
      .pipeline()
      .del(`suspicious:admin:${adminId}`)
      .srem('security:set:suspicious:admins', adminId)
      .exec();
  }, null);
  deleteBlockFromFirestore('admin', adminId);
}

/**
 * Check if an admin is currently suspended.
 * @param {string} adminId
 * @returns {Promise<{ suspended: boolean, reason?: string }>}
 */
export async function isAdminSuspended(adminId) {
  if (!adminId) return { suspended: false };
  return safeExec(
    async (redis) => {
      const data = await redis.hgetall(`suspicious:admin:${adminId}`);
      if (!data || !data.reason) return { suspended: false };
      return { suspended: true, reason: data.reason };
    },
    async () => {
      console.warn(
        '[SecurityState:Degraded] redis_unavailable — isAdminSuspended falling back to Firestore',
        JSON.stringify({ adminId }),
      );
      const fb = await checkFirestoreBlock('admin', adminId);
      return { suspended: fb.blocked, reason: fb.reason };
    },
  );
}

// ── Security Overview ─────────────────────────────────────────────────────────

/**
 * Return a security overview for the admin dashboard.
 * Reads from tracking sets — fast, no SCAN needed.
 * Re-verifies each member so expired keys are not counted.
 *
 * @returns {Promise<{
 *   blockedIps: string[],
 *   blockedUsers: string[],
 *   flaggedUsers: string[],
 *   suspendedAdmins: string[],
 *   recentAttacks: object[],
 *   counts: { blockedIps: number, blockedUsers: number, flaggedUsers: number, suspendedAdmins: number }
 * }>}
 */
export async function getSecurityOverview() {
  return safeExec(
    async (redis) => {
      // Read sets in parallel
      const [ipSet, userSet, flaggedSet, adminSet, attackLog] = await Promise.all([
        redis.smembers('security:set:blocked:ips'),
        redis.smembers('security:set:blocked:users'),
        redis.smembers('security:set:flagged:users'),
        redis.smembers('security:set:suspicious:admins'),
        redis.lrange('security:attacks:log', 0, 49), // last 50 attacks
      ]);

      // Filter out expired keys (TTL expired but set membership not yet cleaned)
      const verify = async (keys, keyFn) => {
        if (!keys.length) return [];
        const pipeline = redis.pipeline();
        keys.forEach((k) => pipeline.exists(keyFn(k)));
        const results = await pipeline.exec();
        return keys.filter((_, i) => results[i][1] === 1);
      };

      const [blockedIps, blockedUsers, flaggedUsers, suspendedAdmins] = await Promise.all([
        verify(ipSet, (ip) => `blocked:ip:${ip}`),
        verify(userSet, (uid) => `blocked:user:${uid}`),
        verify(flaggedSet, (uid) => `flagged:user:${uid}`),
        verify(adminSet, (id) => `suspicious:admin:${id}`),
      ]);

      const recentAttacks = attackLog
        .map((entry) => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return {
        blockedIps,
        blockedUsers,
        flaggedUsers,
        suspendedAdmins,
        recentAttacks,
        counts: {
          blockedIps: blockedIps.length,
          blockedUsers: blockedUsers.length,
          flaggedUsers: flaggedUsers.length,
          suspendedAdmins: suspendedAdmins.length,
        },
      };
    },
    {
      // Fallback when Redis is down — return empty overview, never crash the dashboard
      blockedIps: [],
      blockedUsers: [],
      flaggedUsers: [],
      suspendedAdmins: [],
      recentAttacks: [],
      counts: { blockedIps: 0, blockedUsers: 0, flaggedUsers: 0, suspendedAdmins: 0 },
    },
  );
}

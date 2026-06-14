/**
 * @c1rcle/core — Attack Detection + Auto-Mitigation
 *
 * Detects credential stuffing, payment fraud, and admin abuse via Redis counters.
 * When a threshold is crossed:
 *   1. The appropriate block/suspension is applied (security-state)
 *   2. Reputation score is incremented (reputation)
 *   3. Pattern detection is run (pattern-detection)
 *   4. Attack trend is recorded (reputation / hourly bucket)
 *
 * Usage:
 *   import { checkCredentialStuffing, checkPaymentFraud, checkAdminAbuse } from "@c1rcle/core/attack-detection";
 *
 *   // After a failed auth
 *   const threat = await checkCredentialStuffing(ip, uid);
 *
 *   // After a payment anomaly
 *   const fraud = await checkPaymentFraud(uid, ip);
 *
 *   // After a critical admin action
 *   const abuse = await checkAdminAbuse(adminId);
 */

import { getRedisClient } from "./redis.js";
import { blockIp, blockUser, flagUser, suspendAdmin, TTL, recordGlobalAuthFailure } from "./security-state.js";
import { addReputation, recordAttackTrend } from "./reputation.js";
import { recordAndCheckPatterns } from "./pattern-detection.js";
import { logSecurityEvent } from "./security-logger.js";

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
    AUTH_FAILURES_PER_IP:      { limit: 10, windowSec: 600  },
    AUTH_FAILURES_PER_UID:     { limit: 5,  windowSec: 600  },
    PAYMENT_ANOMALIES_PER_UID: { limit: 3,  windowSec: 3600 },
    PAYMENT_ANOMALIES_PER_IP:  { limit: 5,  windowSec: 3600 },
    ADMIN_CRITICAL_PER_UID:    { limit: 5,  windowSec: 60   }, // 5 actions/min → maximises detection speed
};

// ── Core counter ──────────────────────────────────────────────────────────────

async function increment(key, windowSec) {
    try {
        const redis = getRedisClient();
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        return count;
    } catch (_) {
        return 0;
    }
}

// ── Credential Stuffing Detection ────────────────────────────────────────────

/**
 * Record an auth failure and check for credential stuffing.
 * Also runs pattern detection (multi-account spray, account siege).
 *
 * @param {string|null} ip
 * @param {string|null} uid
 * @param {string}      [endpoint]  - route label for trend tracking
 * @returns {Promise<{ detected: boolean, reason: string|null, count: number, mitigated: boolean, patterns: string[] }>}
 */
export async function checkCredentialStuffing(ip, uid, endpoint) {
    const [ipCount, uidCount, patterns] = await Promise.all([
        ip  ? increment(`detect:auth:ip:${ip}`,   THRESHOLDS.AUTH_FAILURES_PER_IP.windowSec)  : Promise.resolve(0),
        uid ? increment(`detect:auth:uid:${uid}`,  THRESHOLDS.AUTH_FAILURES_PER_UID.windowSec) : Promise.resolve(0),
        recordAndCheckPatterns(ip, uid),
    ]);

    // Always add reputation for auth failure + record trend + contribute to global velocity
    await Promise.all([
        ip  ? addReputation("ip",   ip,  "AUTH_FAIL") : Promise.resolve(),
        uid ? addReputation("user", uid, "AUTH_FAIL") : Promise.resolve(),
        recordAttackTrend("AUTH_FAIL", endpoint),
        recordGlobalAuthFailure(), // feeds the distributed botnet detector
    ]);

    const patternTypes = patterns.map(p => p.type);

    if (ip && ipCount >= THRESHOLDS.AUTH_FAILURES_PER_IP.limit) {
        await blockIp(ip, `credential_stuffing:${ipCount}_failures`, TTL.IP_BLOCK);
        logSecurityEvent("CREDENTIAL_STUFFING", { ip, uid, endpoint, reason: "AUTH_FAILURES_PER_IP", count: ipCount, mitigated: true, mitigationAction: "IP_BLOCKED", patterns: patternTypes });
        return { detected: true, reason: "AUTH_FAILURES_PER_IP", count: ipCount, mitigated: true, patterns: patternTypes };
    }

    if (uid && uidCount >= THRESHOLDS.AUTH_FAILURES_PER_UID.limit) {
        await Promise.all([
            blockUser(uid, `credential_stuffing:${uidCount}_failures`, TTL.USER_BLOCK),
            flagUser(uid, "credential_stuffing_account_targeted"),
        ]);
        logSecurityEvent("CREDENTIAL_STUFFING", { ip, uid, endpoint, reason: "AUTH_FAILURES_PER_UID", count: uidCount, mitigated: true, mitigationAction: "USER_BLOCKED", patterns: patternTypes });
        return { detected: true, reason: "AUTH_FAILURES_PER_UID", count: uidCount, mitigated: true, patterns: patternTypes };
    }

    // Patterns detected even if numeric thresholds not crossed
    if (patternTypes.length > 0) {
        logSecurityEvent("SUSPICIOUS_PATTERN", { ip, uid, endpoint, reason: patternTypes[0], count: Math.max(ipCount, uidCount), mitigated: true, patterns: patternTypes });
        return { detected: true, reason: patternTypes[0], count: Math.max(ipCount, uidCount), mitigated: true, patterns: patternTypes };
    }

    return { detected: false, reason: null, count: Math.max(ipCount, uidCount), mitigated: false, patterns: [] };
}

// ── Payment Fraud Detection ───────────────────────────────────────────────────

/**
 * Record a payment anomaly and check for fraud patterns.
 *
 * @param {string|null} uid
 * @param {string|null} ip
 * @param {string}      [endpoint]
 * @returns {Promise<{ detected: boolean, reason: string|null, count: number, mitigated: boolean }>}
 */
export async function checkPaymentFraud(uid, ip, endpoint) {
    const [uidCount, ipCount] = await Promise.all([
        uid ? increment(`detect:payment:uid:${uid}`, THRESHOLDS.PAYMENT_ANOMALIES_PER_UID.windowSec) : Promise.resolve(0),
        ip  ? increment(`detect:payment:ip:${ip}`,   THRESHOLDS.PAYMENT_ANOMALIES_PER_IP.windowSec)  : Promise.resolve(0),
    ]);

    await Promise.all([
        uid ? addReputation("user", uid, "PAYMENT_ANOMALY") : Promise.resolve(),
        ip  ? addReputation("ip",   ip,  "PAYMENT_ANOMALY") : Promise.resolve(),
        recordAttackTrend("PAYMENT_ANOMALY", endpoint),
    ]);

    if (uid && uidCount >= THRESHOLDS.PAYMENT_ANOMALIES_PER_UID.limit) {
        await Promise.all([
            blockUser(uid, `payment_fraud:${uidCount}_anomalies`, TTL.USER_BLOCK),
            flagUser(uid, "payment_fraud_pattern_detected"),
        ]);
        logSecurityEvent("PAYMENT_FRAUD", { uid, ip, endpoint, reason: "PAYMENT_ANOMALIES_PER_UID", count: uidCount, mitigated: true, mitigationAction: "USER_BLOCKED" });
        return { detected: true, reason: "PAYMENT_ANOMALIES_PER_UID", count: uidCount, mitigated: true };
    }

    if (ip && ipCount >= THRESHOLDS.PAYMENT_ANOMALIES_PER_IP.limit) {
        await blockIp(ip, `payment_fraud:${ipCount}_anomalies`, TTL.IP_BLOCK);
        logSecurityEvent("PAYMENT_FRAUD", { uid, ip, endpoint, reason: "PAYMENT_ANOMALIES_PER_IP", count: ipCount, mitigated: true, mitigationAction: "IP_BLOCKED" });
        return { detected: true, reason: "PAYMENT_ANOMALIES_PER_IP", count: ipCount, mitigated: true };
    }

    return { detected: false, reason: null, count: Math.max(uidCount, ipCount), mitigated: false };
}

// ── Admin Abuse Detection ─────────────────────────────────────────────────────

/**
 * Record a critical admin action and check for abuse.
 * Caller must call Firebase auth.revokeRefreshTokens(adminId) for token invalidation.
 *
 * @param {string} adminId
 * @param {string} [endpoint]
 * @returns {Promise<{ detected: boolean, count: number, mitigated: boolean }>}
 */
export async function checkAdminAbuse(adminId, endpoint) {
    const count = await increment(
        `detect:admin:uid:${adminId}`,
        THRESHOLDS.ADMIN_CRITICAL_PER_UID.windowSec
    );

    await Promise.all([
        addReputation("admin", adminId, "ADMIN_ABUSE"),
        recordAttackTrend("ADMIN_ABUSE", endpoint),
    ]);

    if (count >= THRESHOLDS.ADMIN_CRITICAL_PER_UID.limit) {
        await suspendAdmin(adminId, `admin_abuse:${count}_critical_actions`, TTL.ADMIN_SUSPENSION);
        logSecurityEvent("ADMIN_ABUSE", { adminId, endpoint, reason: "ADMIN_CRITICAL_PER_UID", count, mitigated: true, mitigationAction: "ADMIN_SUSPENDED" });
        return { detected: true, count, mitigated: true };
    }

    return { detected: false, count, mitigated: false };
}

// ── Rate limit event recording ─────────────────────────────────────────────────

/**
 * Record a rate limit hit in the reputation and trend systems.
 * Call this whenever a 429 is returned to keep scores accurate.
 *
 * @param {string|null} ip
 * @param {string|null} uid
 * @param {string}      [endpoint]
 */
export async function recordRateLimitHit(ip, uid, endpoint) {
    await Promise.all([
        ip  ? addReputation("ip",   ip,  "RATE_LIMIT") : Promise.resolve(),
        uid ? addReputation("user", uid, "RATE_LIMIT") : Promise.resolve(),
        recordAttackTrend("RATE_LIMIT", endpoint),
    ]);
}

// ── Peek (read-only) ──────────────────────────────────────────────────────────

export async function peekCounter(key) {
    try {
        const redis = getRedisClient();
        const val = await redis.get(key);
        return val ? parseInt(val, 10) : 0;
    } catch (_) {
        return 0;
    }
}

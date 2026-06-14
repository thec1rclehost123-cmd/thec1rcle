/**
 * Returns true if Redis is connected and ready for commands.
 * Synchronous — safe to call in hot paths.
 */
export function isRedisHealthy(): boolean;
/**
 * In-process rate limiter used when Redis is unavailable.
 * Cleans up its own expired entries on each write to avoid unbounded growth.
 *
 * @param {string} key
 * @param {number} limit       - max requests allowed in the window
 * @param {number} windowMs    - window length in milliseconds
 * @returns {{ allowed: boolean, count: number, remaining: number }}
 */
export function memoryRateLimit(key: string, limit: number, windowMs?: number): {
    allowed: boolean;
    count: number;
    remaining: number;
};
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
export function checkCriticalEndpoint(identifier: string, criticalLimit: number, windowMs?: number | undefined): {
    allowed: boolean;
    degraded: boolean;
};
/**
 * Increment the global auth failure counter and activate high-risk mode if threshold is crossed.
 * Called on every credential stuffing detection event.
 * Fire-and-forget friendly — errors are swallowed.
 */
export function recordGlobalAuthFailure(): Promise<void>;
/**
 * Returns true when the system is in high-risk mode (sustained distributed attack detected).
 * Used by the adaptive rate limiter to halve all limits until the mode expires.
 */
export function isHighRiskMode(): Promise<any>;
/**
 * Block an IP address for the given TTL.
 * @param {string} ip
 * @param {string} reason - human-readable reason (logged, not exposed to client)
 * @param {number} [ttlSec]
 */
export function blockIp(ip: string, reason: string, ttlSec?: number | undefined): Promise<void>;
/**
 * Remove an IP block (admin override).
 */
export function unblockIp(ip: any): Promise<void>;
/**
 * Check if an IP is currently blocked.
 * @param {string} ip
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export function isIpBlocked(ip: string): Promise<{
    blocked: boolean;
    reason?: string;
}>;
/**
 * Block a user account for the given TTL.
 * @param {string} uid
 * @param {string} reason
 * @param {number} [ttlSec]
 */
export function blockUser(uid: string, reason: string, ttlSec?: number | undefined): Promise<void>;
/**
 * Remove a user block (admin override).
 */
export function unblockUser(uid: any): Promise<void>;
/**
 * Check if a user is currently blocked.
 * @param {string} uid
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
export function isUserBlocked(uid: string): Promise<{
    blocked: boolean;
    reason?: string;
}>;
/**
 * Flag a user for manual review. Does NOT block them — just marks for ops review.
 * @param {string} uid
 * @param {string} reason
 */
export function flagUser(uid: string, reason: string): Promise<void>;
/**
 * Clear a user flag (admin override / ops review complete).
 */
export function unflagUser(uid: any): Promise<void>;
/**
 * Check if a user is flagged for review.
 * @param {string} uid
 * @returns {Promise<{ flagged: boolean, reason?: string }>}
 */
export function isUserFlagged(uid: string): Promise<{
    flagged: boolean;
    reason?: string;
}>;
/**
 * Mark an admin as suspicious / temporarily suspended.
 * This does NOT revoke Firebase tokens — the caller must do that separately
 * via Firebase Admin auth.revokeRefreshTokens(adminId) for immediate effect.
 *
 * @param {string} adminId
 * @param {string} reason
 * @param {number} [ttlSec]
 */
export function suspendAdmin(adminId: string, reason: string, ttlSec?: number | undefined): Promise<void>;
/**
 * Clear an admin suspension (after review).
 */
export function clearAdminSuspension(adminId: any): Promise<void>;
/**
 * Check if an admin is currently suspended.
 * @param {string} adminId
 * @returns {Promise<{ suspended: boolean, reason?: string }>}
 */
export function isAdminSuspended(adminId: string): Promise<{
    suspended: boolean;
    reason?: string;
}>;
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
export function getSecurityOverview(): Promise<{
    blockedIps: string[];
    blockedUsers: string[];
    flaggedUsers: string[];
    suspendedAdmins: string[];
    recentAttacks: object[];
    counts: {
        blockedIps: number;
        blockedUsers: number;
        flaggedUsers: number;
        suspendedAdmins: number;
    };
}>;
export namespace TTL {
    let IP_BLOCK: number;
    let USER_BLOCK: number;
    let ADMIN_SUSPENSION: number;
    let USER_FLAG: number;
}

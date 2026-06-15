/**
 * @param {string} key           - unique identifier (uid, IP, etc.)
 * @param {number} [limit=20]
 * @param {number} [windowSeconds=60]
 * @param {boolean} [failClosed=false]
 * @returns {Promise<{ success: boolean, limit: number, remaining: number, reset: number }>}
 */
export function checkRateLimit(
  key: string,
  limit?: number | undefined,
  windowSeconds?: number | undefined,
  failClosed?: boolean | undefined,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}>;
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
export function checkAdaptiveRateLimit(
  key: string,
  baseLimit: number,
  windowSeconds: number,
  reputationType: 'ip' | 'user' | 'admin',
  reputationId: string,
  failClosed?: boolean | undefined,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  tier: string;
}>;
export function clearRateLimit(key: any): Promise<void>;

import { getRedisClient } from './redis.js';

/**
 * THE C1RCLE - Distributed Lock Service (Redis)
 *
 * Prevents multiple instances of scripts or processes from running
 * at the same time globally across the monorepo.
 */

/**
 * Acquire a lock
 * @param {string} key - Lock identifier
 * @param {number} ttlSeconds - Time before lock automatically expires
 * @returns {Promise<boolean>} - True if lock acquired, False otherwise
 */
export async function acquireLock(key, ttlSeconds = 300) {
  const redis = getRedisClient();
  const lockKey = `lock:${key}`;

  // NX = Only set if not exists, EX = Set expiry
  const result = await redis.set(lockKey, 'locked', 'NX', 'EX', ttlSeconds);
  return result === 'OK';
}

/**
 * Release a lock
 * @param {string} key - Lock identifier
 */
export async function releaseLock(key) {
  const redis = getRedisClient();
  const lockKey = `lock:${key}`;
  await redis.del(lockKey);
}

/**
 * Execute a function within a lock
 */
export async function withLock(key, fn, ttlSeconds = 300) {
  const acquired = await acquireLock(key, ttlSeconds);
  if (!acquired) {
    throw new Error(`Could not acquire global lock for: ${key}. Is another instance running?`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}

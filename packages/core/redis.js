import { Redis } from 'ioredis';

/**
 * THE C1RCLE - Centralized Redis Client
 *
 * Provides a shared connection pool for all apps in the monorepo.
 * Uses environment variables for configuration.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redis = null;

export function getRedisClient() {
  if (!REDIS_URL || REDIS_URL.toUpperCase() === 'PLACEHOLDER') {
    return null;
  }

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      commandTimeout: 2000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('[Redis] Client Error:', err.message);
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  return redis;
}

export async function cacheGet(key) {
  const client = getRedisClient();
  if (!client || !key) return null;
  try {
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.warn(`[Redis] cacheGet failed for ${key}:`, error.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  const client = getRedisClient();
  if (!client || !key) return false;
  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await client.set(key, payload);
    }
    return true;
  } catch (error) {
    console.warn(`[Redis] cacheSet failed for ${key}:`, error.message);
    return false;
  }
}

export async function cacheDel(key) {
  const client = getRedisClient();
  if (!client || !key) return false;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.warn(`[Redis] cacheDel failed for ${key}:`, error.message);
    return false;
  }
}

export async function bumpCacheVersion(namespace) {
  const client = getRedisClient();
  if (!client || !namespace) return null;
  const redisKey = `public-cache-version:${namespace}`;
  try {
    const next = await client.incr(redisKey);
    return next;
  } catch (error) {
    console.warn(`[Redis] Failed to bump version for namespace ${namespace}:`, error.message);
    return null;
  }
}

export default getRedisClient;

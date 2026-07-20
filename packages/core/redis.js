import { Redis } from 'ioredis';

/**
 * THE C1RCLE - Centralized Redis Client
 *
 * Provides a shared connection pool for all apps in the monorepo.
 * Uses environment variables for configuration.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redis = null;

async function waitForReady(client, timeoutMs = 2500) {
  if (!client) return false;
  if (client.status === 'ready') return true;
  if (client.status === 'end') {
    try {
      await client.connect();
    } catch (error) {
      if (!String(error?.message || '').includes('already connecting')) return false;
    }
  }
  if (client.status === 'ready') return true;

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeListener('ready', onReady);
      client.removeListener('error', onFailure);
      client.removeListener('end', onFailure);
      resolve(value);
    };
    const onReady = () => finish(true);
    const onFailure = () => finish(false);
    const timer = setTimeout(() => finish(client.status === 'ready'), timeoutMs);
    client.once('ready', onReady);
    client.once('error', onFailure);
    client.once('end', onFailure);
  });
}

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
    if (!(await waitForReady(client))) return null;
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
    if (!(await waitForReady(client))) return false;
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
    if (!(await waitForReady(client))) return false;
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

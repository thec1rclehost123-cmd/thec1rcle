/**
 * Offline Caching Service
 *
 * Provides two APIs:
 * 1. Low-level get/set (cacheData, getCachedData) — for manual cache management
 * 2. cacheFetch — stale-while-revalidate fetch wrapper for offline resilience
 *
 * Uses AsyncStorage instead of SecureStore to avoid 2KB size limits.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = 'c1rcle_cache_';

const CACHE_KEYS = {
  events: CACHE_PREFIX + 'events',
  featuredEvents: CACHE_PREFIX + 'featured',
  userOrders: CACHE_PREFIX + 'orders',
  lastSync: CACHE_PREFIX + 'last_sync',
};

// Maximum cache age in milliseconds (5 minutes for most data)
const DEFAULT_TTL = 5 * 60 * 1000;
// Longer TTL for event lists (1 hour)
const EVENTS_TTL = 60 * 60 * 1000;

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ─── Low-level cache API ─────────────────────────────────────────

/** Save data to cache */
export async function cacheData<T>(key: string, data: T, ttl: number = EVENTS_TTL): Promise<void> {
  try {
    const entry: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    if (__DEV__) console.warn('[Cache] Error caching data:', error);
  }
}

/** Get data from cache */
export async function getCachedData<T>(
  key: string,
  maxAge: number = EVENTS_TTL,
): Promise<{ data: T | null; isStale: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return { data: null, isStale: true };
    }

    const parsed: CachedData<T> = JSON.parse(raw);
    const age = Date.now() - parsed.timestamp;
    const isStale = age > (parsed.ttl || maxAge);

    return { data: parsed.data, isStale };
  } catch (error) {
    if (__DEV__) console.warn('[Cache] Error getting cached data:', error);
    return { data: null, isStale: true };
  }
}

/** Clear specific cache */
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/** Clear all C1RCLE caches */
export async function clearAllCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    if (__DEV__) console.warn('[Cache] Error clearing all caches:', error);
  }
}

// ─── Domain-specific helpers ─────────────────────────────────────

export async function cacheEvents(events: any[]): Promise<void> {
  await cacheData(CACHE_KEYS.events, events, EVENTS_TTL);
}

export async function getCachedEvents(): Promise<{
  data: any[] | null;
  isStale: boolean;
}> {
  return getCachedData<any[]>(CACHE_KEYS.events, EVENTS_TTL);
}

export async function cacheFeaturedEvents(events: any[]): Promise<void> {
  await cacheData(CACHE_KEYS.featuredEvents, events, EVENTS_TTL);
}

export async function getCachedFeaturedEvents(): Promise<{
  data: any[] | null;
  isStale: boolean;
}> {
  return getCachedData<any[]>(CACHE_KEYS.featuredEvents, EVENTS_TTL);
}

export async function cacheUserOrders(orders: any[]): Promise<void> {
  await cacheData(CACHE_KEYS.userOrders, orders, EVENTS_TTL);
}

export async function getCachedUserOrders(): Promise<{
  data: any[] | null;
  isStale: boolean;
}> {
  return getCachedData<any[]>(CACHE_KEYS.userOrders, EVENTS_TTL);
}

export async function hasOfflineData(): Promise<boolean> {
  const { data: events } = await getCachedEvents();
  return events !== null && events.length > 0;
}

export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const timestamp = await AsyncStorage.getItem(CACHE_KEYS.lastSync);
    if (timestamp) {
      return new Date(parseInt(timestamp, 10));
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.lastSync, Date.now().toString());
  } catch {
    // Ignore
  }
}

// ─── Cache-First Fetch (stale-while-revalidate) ──────────────────

interface CacheFetchOptions {
  /** Cache TTL in ms (default 5 min) */
  ttl?: number;
  /** Force network fetch, ignore cache */
  forceRefresh?: boolean;
}

/**
 * Fetch data using a stale-while-revalidate strategy.
 *
 * 1. If fresh cache → return immediately
 * 2. If stale cache → return stale & revalidate in background
 * 3. If no cache → fetch from network (falls back to error)
 * 4. If offline & cache exists → return cache regardless of age
 */
export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheFetchOptions = {},
): Promise<T> {
  const { ttl = DEFAULT_TTL, forceRefresh = false } = options;
  const cacheKey = CACHE_PREFIX + key;

  // 1. Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const { data, isStale } = await getCachedData<T>(cacheKey, ttl);

    if (data !== null) {
      if (!isStale) {
        return data; // Fresh cache — done
      }

      // Stale → return stale, revalidate in background
      revalidateInBackground(cacheKey, fetcher, ttl);
      return data;
    }
  }

  // 2. No cache — check network
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    // Offline — try stale cache as last resort
    const { data: stale } = await getCachedData<T>(cacheKey, Infinity);
    if (stale !== null) return stale;
    throw new Error('No internet connection and no cached data');
  }

  // 3. Fetch from network
  const freshData = await fetcher();
  await cacheData(cacheKey, freshData, ttl);
  return freshData;
}

/** Background revalidation — non-blocking */
async function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
): Promise<void> {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    const freshData = await fetcher();
    await cacheData(key, freshData, ttl);
  } catch (error) {
    // Silent — we already have stale data showing
    if (__DEV__) console.warn('[Cache] Background revalidation failed:', key);
  }
}

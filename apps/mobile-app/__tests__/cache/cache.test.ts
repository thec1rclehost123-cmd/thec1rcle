/* global jest, describe, beforeEach, it, expect */

const mockNetInfoState = { isConnected: true };
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve(mockNetInfoState)),
}));

// In-memory AsyncStorage with exposed store for test cleanup
const asyncStorageStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStorageStore[key] = value;
  }),
  getItem: jest.fn(async (key: string) => asyncStorageStore[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStorageStore[key];
  }),
  getAllKeys: jest.fn(async () => Object.keys(asyncStorageStore)),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => {
      delete asyncStorageStore[k];
    });
  }),
}));

import NetInfo from '@react-native-community/netinfo';
import {
  cacheData,
  getCachedData,
  clearCache,
  clearAllCaches,
  cacheEvents,
  getCachedEvents,
  cacheFeaturedEvents,
  getCachedFeaturedEvents,
  cacheUserOrders,
  getCachedUserOrders,
  hasOfflineData,
  getLastSyncTime,
  updateLastSyncTime,
  cacheFetch,
} from '../../lib/cache';

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    mockNetInfoState.isConnected = true;
  });

  describe('cacheData / getCachedData', () => {
    it('stores and retrieves data', async () => {
      await cacheData('test_key', { foo: 'bar' }, 60000);

      const { data, isStale } = await getCachedData('test_key', 60000);
      expect(data).toEqual({ foo: 'bar' });
      expect(isStale).toBe(false);
    });

    it('returns isStale when TTL exceeded', async () => {
      await cacheData('old_key', 'value', 1);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 2));

      const { isStale } = await getCachedData('old_key', 1);
      expect(isStale).toBe(true);
    });

    it('returns null for missing key', async () => {
      const { data, isStale } = await getCachedData('nonexistent');
      expect(data).toBeNull();
      expect(isStale).toBe(true);
    });
  });

  describe('clearCache / clearAllCaches', () => {
    it('removes a single key', async () => {
      await cacheData('key1', 'val');
      await clearCache('key1');

      const { data } = await getCachedData('key1');
      expect(data).toBeNull();
    });

    it('clears all caches with prefix', async () => {
      await cacheData('c1rcle_cache_events', [1, 2, 3]);
      await cacheData('c1rcle_cache_orders', [4, 5]);
      await cacheData('other_key', 'should remain');

      await clearAllCaches();

      const { data: e } = await getCachedData('c1rcle_cache_events');
      const { data: o } = await getCachedData('c1rcle_cache_orders');
      const { data: other } = await getCachedData('other_key');

      expect(e).toBeNull();
      expect(o).toBeNull();
      expect(other).toEqual('should remain');
    });
  });

  describe('domain-specific helpers', () => {
    it('cacheEvents / getCachedEvents round-trips', async () => {
      await cacheEvents([{ id: 'evt_1' }]);

      const { data } = await getCachedEvents();
      expect(data).toEqual([{ id: 'evt_1' }]);
    });

    it('cacheFeaturedEvents / getCachedFeaturedEvents round-trips', async () => {
      await cacheFeaturedEvents([{ id: 'feat_1' }]);

      const { data } = await getCachedFeaturedEvents();
      expect(data).toEqual([{ id: 'feat_1' }]);
    });

    it('cacheUserOrders / getCachedUserOrders round-trips', async () => {
      await cacheUserOrders('user_1', [{ id: 'ord_1' }]);

      const { data } = await getCachedUserOrders('user_1');
      expect(data).toEqual([{ id: 'ord_1' }]);
    });

    it('isolates cached orders between users', async () => {
      await cacheUserOrders('user_1', [{ id: 'ord_user_1' }]);
      await cacheUserOrders('user_2', [{ id: 'ord_user_2' }]);

      await expect(getCachedUserOrders('user_1')).resolves.toMatchObject({
        data: [{ id: 'ord_user_1' }],
      });
      await expect(getCachedUserOrders('user_2')).resolves.toMatchObject({
        data: [{ id: 'ord_user_2' }],
      });
      await expect(getCachedUserOrders('signed_out')).resolves.toMatchObject({ data: null });
    });
  });

  describe('hasOfflineData', () => {
    it('returns true when events cache has data', async () => {
      await cacheEvents([{ id: 'evt_1' }]);

      const has = await hasOfflineData();
      expect(has).toBe(true);
    });

    it('returns false when events cache is empty', async () => {
      const has = await hasOfflineData();
      expect(has).toBe(false);
    });
  });

  describe('lastSyncTime', () => {
    it('updates and retrieves sync time', async () => {
      await updateLastSyncTime();

      const time = await getLastSyncTime();
      expect(time).toBeInstanceOf(Date);
    });

    it('returns null when never synced', async () => {
      const time = await getLastSyncTime();
      expect(time).toBeNull();
    });
  });

  describe('cacheFetch', () => {
    const fetcher = jest.fn().mockResolvedValue('fresh-data');

    it('returns cached data when fresh and does not call fetcher', async () => {
      await cacheData('c1rcle_cache_test', 'cached-val', 60000);

      const result = await cacheFetch('test', fetcher, { ttl: 60000 });
      expect(result).toBe('cached-val');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('returns stale data and revalidates in background', async () => {
      await cacheData('c1rcle_cache_test', 'stale-val', -1);

      const result = await cacheFetch('test', fetcher, { ttl: 60000 });
      expect(result).toBe('stale-val');
      // Background revalidation should still trigger
    });

    it('fetches from network when cache is empty', async () => {
      const result = await cacheFetch('test', fetcher, { ttl: 60000 });
      expect(result).toBe('fresh-data');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('falls back to stale cache when offline', async () => {
      mockNetInfoState.isConnected = false;
      await cacheData('c1rcle_cache_test', 'offline-fallback', -1);

      const result = await cacheFetch('test', fetcher, { ttl: 60000 });
      expect(result).toBe('offline-fallback');
    });

    it('throws when offline and no cache', async () => {
      mockNetInfoState.isConnected = false;

      await expect(cacheFetch('test', fetcher)).rejects.toThrow('No internet connection');
    });

    it('skips cache and forces network when forceRefresh is true', async () => {
      await cacheData('c1rcle_cache_test', 'should-be-skipped', 60000);

      const result = await cacheFetch('test', fetcher, { forceRefresh: true });
      expect(result).toBe('fresh-data');
    });
  });
});

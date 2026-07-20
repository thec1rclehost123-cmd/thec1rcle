/* global jest, describe, beforeEach, it, expect */

const values = new Map<string, string>();
const mockSetItemAsync = jest.fn(async (key: string, value: string) => values.set(key, value));
const mockGetItemAsync = jest.fn(async (key: string) => values.get(key) ?? null);
const mockDeleteItemAsync = jest.fn(async (key: string) => {
  values.delete(key);
});

jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: [string, string]) => mockSetItemAsync(...args),
  getItemAsync: (...args: [string]) => mockGetItemAsync(...args),
  deleteItemAsync: (...args: [string]) => mockDeleteItemAsync(...args),
}));

import {
  cacheCanonicalBootSession,
  clearCachedBootSession,
  readCachedBootSession,
} from '../../lib/boot/sessionCache';

const cacheKey = (uid: string) => `c1rcle_canonical_boot_v2_${uid}`;

describe('canonical boot session cache', () => {
  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
  });

  it('stores only a bounded profile projection with the canonical onboarding snapshot', async () => {
    await cacheCanonicalBootSession(
      'user-1',
      { currentStage: 'complete', completed: true, cityName: 'Pune' },
      {
        uid: 'user-1',
        displayName: 'Aayush',
        city: 'Pune',
        privateAdminField: 'must-not-cache',
      },
    );

    const result = await readCachedBootSession('user-1');
    expect(result).toMatchObject({
      uid: 'user-1',
      snapshot: { currentStage: 'complete', completed: true, cityName: 'Pune' },
      profile: { uid: 'user-1', displayName: 'Aayush', city: 'Pune' },
    });
    expect(result?.profile).not.toHaveProperty('privateAdminField');
  });

  it('refuses to cache a snapshot without a canonical stage', async () => {
    await cacheCanonicalBootSession('user-1', {}, { uid: 'user-1' });
    expect(mockSetItemAsync).not.toHaveBeenCalled();
  });

  it('deletes expired or malformed cache records', async () => {
    values.set(
      cacheKey('user-1'),
      JSON.stringify({
        uid: 'user-1',
        snapshot: { currentStage: 'complete' },
        profile: null,
        cachedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      }),
    );

    expect(await readCachedBootSession('user-1')).toBeNull();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(cacheKey('user-1'));

    values.set(cacheKey('user-1'), 'not-json');
    expect(await readCachedBootSession('user-1')).toBeNull();
    expect(values.has(cacheKey('user-1'))).toBe(false);
  });

  it('clears the cached identity on sign-out request', async () => {
    values.set(cacheKey('user-1'), '{}');
    await clearCachedBootSession('user-1');
    expect(values.has(cacheKey('user-1'))).toBe(false);
  });
});

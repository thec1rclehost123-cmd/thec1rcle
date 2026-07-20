import * as SecureStore from 'expo-secure-store';
import type { FirstRunSnapshot } from '@/lib/firstRun';

const CACHE_PREFIX = 'c1rcle_canonical_boot_v2_';
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type CachedBootSession = {
  uid: string;
  snapshot: FirstRunSnapshot;
  profile: Record<string, unknown> | null;
  cachedAt: number;
};

function key(uid: string) {
  return `${CACHE_PREFIX}${uid}`;
}

function cacheSafeProfile(profile: Record<string, unknown> | null) {
  if (!profile) return null;
  return {
    uid: profile.uid,
    displayName: profile.displayName,
    name: profile.name,
    photoURL: profile.photoURL,
    avatar: profile.avatar,
    city: profile.city,
    cityId: profile.cityId,
    identity: profile.identity,
    discoveryProfile: profile.discoveryProfile,
    onboarding: profile.onboarding,
  };
}

export async function cacheCanonicalBootSession(
  uid: string,
  snapshot: FirstRunSnapshot | null,
  profile: Record<string, unknown> | null,
) {
  if (!uid || !snapshot?.currentStage) return;
  const value: CachedBootSession = {
    uid,
    snapshot,
    profile: cacheSafeProfile(profile),
    cachedAt: Date.now(),
  };
  await SecureStore.setItemAsync(key(uid), JSON.stringify(value));
}

export async function readCachedBootSession(uid: string): Promise<CachedBootSession | null> {
  if (!uid) return null;
  const raw = await SecureStore.getItemAsync(key(uid));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CachedBootSession;
    if (
      value.uid !== uid ||
      !value.snapshot?.currentStage ||
      !Number.isFinite(value.cachedAt) ||
      Date.now() - value.cachedAt > MAX_CACHE_AGE_MS
    ) {
      await clearCachedBootSession(uid);
      return null;
    }
    return value;
  } catch {
    await clearCachedBootSession(uid);
    return null;
  }
}

export async function clearCachedBootSession(uid: string) {
  if (uid) await SecureStore.deleteItemAsync(key(uid));
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOCIAL_SETUP_SKIPPED_KEY = 'c1rcle_social_setup_skipped';

function scopedKey(baseKey: string, userId?: string) {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

async function readFlag(baseKey: string, userId?: string, legacyKeys: string[] = []) {
  const keys = userId
    ? [
        scopedKey(baseKey, userId),
        baseKey,
        ...legacyKeys.map((key) => scopedKey(key, userId)),
        ...legacyKeys,
      ]
    : [baseKey, ...legacyKeys];

  for (const key of keys) {
    if ((await AsyncStorage.getItem(key)) === 'true') return true;
  }

  return false;
}

async function writeFlag(baseKey: string, userId?: string, legacyKeys: string[] = []) {
  const entries: [string, string][] = [[scopedKey(baseKey, userId), 'true']];
  for (const key of legacyKeys) {
    entries.push([scopedKey(key, userId), 'true']);
  }
  await AsyncStorage.multiSet(entries);
}

async function clearFlag(baseKey: string, userId?: string) {
  const keys = userId ? [scopedKey(baseKey, userId), baseKey] : [baseKey];
  await AsyncStorage.multiRemove(keys);
}

export function hasSkippedSocialSetup(userId?: string) {
  return readFlag(SOCIAL_SETUP_SKIPPED_KEY, userId);
}

export function markSocialSetupSkipped(userId?: string) {
  return writeFlag(SOCIAL_SETUP_SKIPPED_KEY, userId);
}

export function clearSocialSetupSkipped(userId?: string) {
  return clearFlag(SOCIAL_SETUP_SKIPPED_KEY, userId);
}

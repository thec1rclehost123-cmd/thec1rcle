import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_VIEWED_KEY = 'c1rcle_onboarding_viewed';
export const ONBOARDING_COMPLETE_KEY = 'c1rcle_onboarding_complete';
export const PERMISSIONS_REQUESTED_KEY = 'c1rcle_permissions_requested';
export const SOCIAL_SETUP_SKIPPED_KEY = 'c1rcle_social_setup_skipped';
export const CONTACT_LINKING_COMPLETE_KEY = 'c1rcle_contact_linking_complete';

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

export function hasViewedOnboarding(userId?: string) {
  return readFlag(ONBOARDING_VIEWED_KEY, userId, [ONBOARDING_COMPLETE_KEY]);
}

export function markOnboardingViewed(userId?: string) {
  return writeFlag(ONBOARDING_VIEWED_KEY, userId, [ONBOARDING_COMPLETE_KEY]);
}

export function hasRequestedPermissions(userId?: string) {
  return readFlag(PERMISSIONS_REQUESTED_KEY, userId);
}

export function markPermissionsRequested(userId?: string) {
  return writeFlag(PERMISSIONS_REQUESTED_KEY, userId);
}

export function hasCompletedContactLinking(userId?: string) {
  return readFlag(CONTACT_LINKING_COMPLETE_KEY, userId);
}

export function markContactLinkingComplete(userId?: string) {
  return writeFlag(CONTACT_LINKING_COMPLETE_KEY, userId);
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

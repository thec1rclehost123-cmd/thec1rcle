import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_MIGRATION_VERSION = 2;
const LEGACY_FIRST_RUN_KEYS = [
  'c1rcle_onboarding_viewed',
  'c1rcle_onboarding_complete',
  'c1rcle_permissions_requested',
];

function markerKey(userId: string) {
  return `c1rcle:first_run:local_migration:${LOCAL_MIGRATION_VERSION}:${userId}`;
}

export async function migrateLegacyFirstRunStorage(userId: string): Promise<boolean> {
  if (!userId) return false;
  const marker = markerKey(userId);
  if ((await AsyncStorage.getItem(marker)) === 'done') return false;

  const scopedKeys = LEGACY_FIRST_RUN_KEYS.map((key) => `${key}:${userId}`);
  const profileSetupFlag = `profileSetupJustCompleted_${userId}`;
  // Read exactly once so upgrades from old builds are observable during local
  // debugging, but never use these values as routing authority.
  await AsyncStorage.multiGet([...LEGACY_FIRST_RUN_KEYS, ...scopedKeys, profileSetupFlag]);
  await AsyncStorage.multiRemove([...LEGACY_FIRST_RUN_KEYS, ...scopedKeys, profileSetupFlag]);
  await AsyncStorage.setItem(marker, 'done');
  return true;
}

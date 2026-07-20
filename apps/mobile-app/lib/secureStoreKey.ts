const INVALID_SECURE_STORE_KEY_CHARACTER = /[^A-Za-z0-9._-]/g;

/**
 * Android's Expo SecureStore rejects characters such as `:`, `/`, and `@`.
 * Normalize every dynamic key at the storage boundary so Firebase and app
 * persistence use the same valid key on both platforms.
 */
export function secureStoreKey(value: string): string {
  const normalized = value.replace(INVALID_SECURE_STORE_KEY_CHARACTER, '_');
  if (!normalized) throw new Error('SecureStore key cannot be empty.');
  return normalized;
}

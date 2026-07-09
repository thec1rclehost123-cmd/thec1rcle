/**
 * Secure Storage for Firebase Auth Persistence
 *
 * 100% hardware-backed encryption via iOS Keychain / Android Keystore.
 * Zero AsyncStorage fallback — values exceeding the Android 2 KB
 * SecureStore limit are transparently split into chunks stored as
 * separate SecureStore entries.
 *
 * Chunk naming convention:
 *   - `key_chunks` — stores the integer count of chunks
 *   - `key_chunk_0`, `key_chunk_1`, ... — each ≤ 1800 bytes
 *   - Single-chunk values use the bare key (no suffix) for efficiency.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SUFFIX = '_chunk_';
const COUNT_KEY_SUFFIX = '_chunks';
const MAX_CHUNK_BYTES = 1800;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const charBytes = byteLength(char);
    if (currentBytes + charBytes > MAX_CHUNK_BYTES && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

interface FirebaseStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const secureStorage: FirebaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const countStr = await SecureStore.getItemAsync(key + COUNT_KEY_SUFFIX);
      if (countStr === null) {
        return await SecureStore.getItemAsync(key);
      }
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) return null;

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(key + CHUNK_SUFFIX + i);
        if (chunk === null) return null;
        parts.push(chunk);
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await secureStorage.removeItem(key);

      const chunks = splitIntoChunks(value);
      const count = chunks.length;

      if (count === 0) return;
      if (count === 1) {
        await SecureStore.setItemAsync(key, value);
        return;
      }

      await SecureStore.setItemAsync(key + COUNT_KEY_SUFFIX, String(count));
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(key + CHUNK_SUFFIX + i, chunks[i]);
      }
    } catch (error) {
      console.error('[secureStorage] setItem failed:', error);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const countStr = await SecureStore.getItemAsync(key + COUNT_KEY_SUFFIX);
      if (countStr !== null) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count) && count > 0) {
          const deletions = [];
          for (let i = 0; i < count; i++) {
            deletions.push(SecureStore.deleteItemAsync(key + CHUNK_SUFFIX + i));
          }
          deletions.push(SecureStore.deleteItemAsync(key + COUNT_KEY_SUFFIX));
          await Promise.allSettled(deletions);
        }
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Swallow errors on removal
    }
  },
};

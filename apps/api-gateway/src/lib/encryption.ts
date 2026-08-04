import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const algorithm = 'aes-256-cbc';

// The encryption key MUST come from the environment. A missing key means any
// "encrypted" value is trivially decryptable — fail hard regardless of NODE_ENV.
const secret = process.env.ENCRYPTION_KEY;
if (!secret) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}
// Derive primary key using configured salt or strong domain-separated salt.
// Also keep legacy key derived from 'salt' to ensure backward compatibility for old encrypted records.
const primarySalt =
  process.env.ENCRYPTION_SALT || 'c1rcle_api_gateway_aes256_key_derivation_salt_v1';
const primaryKey = scryptSync(secret, primarySalt, 32);
const legacyKey = scryptSync(secret, 'salt', 32);

/**
 * Encrypts a plaintext string to AES-256-CBC hex representation with IV prefix
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, primaryKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted hex string back to plaintext.
 * Returns the original text if it's not encrypted or decryption fails (for legacy records).
 */
export function decrypt(encryptedText: string | null | undefined): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return encryptedText; // Fallback to raw text if not encrypted
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  // Try primary key first
  try {
    const decipher = createDecipheriv(algorithm, primaryKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    if (decrypted) return decrypted;
  } catch {
    // Fall back to legacy key below if primary decryption fails
  }

  // Fallback: try legacy key for records encrypted before salt hardening
  try {
    const decipher = createDecipheriv(algorithm, legacyKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Genuine decryption failure (corrupt data or wrong key). Return empty string.
    return '';
  }
}

/**
 * Hashes a plaintext password securely using scrypt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, storedKeyHex] = parts;
  const storedKey = Buffer.from(storedKeyHex, 'hex');
  const computed = scryptSync(password, salt, 64);
  // timingSafeEqual throws if the buffers differ in length, so guard first —
  // a malformed/truncated stored hash must return false, not crash.
  if (storedKey.length !== computed.length) return false;
  return timingSafeEqual(storedKey, computed);
}

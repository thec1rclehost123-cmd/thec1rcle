import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const algorithm = 'aes-256-cbc';
const secret = process.env.ENCRYPTION_KEY || 'c1rcle-super-secret-key-1234567890';
const key = scryptSync(secret, 'salt', 32);

/**
 * Encrypts a plaintext string to AES-256-CBC hex representation with IV prefix
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
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
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Fallback to raw text if not encrypted
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return original text (useful for legacy data)
    return encryptedText;
  }
}

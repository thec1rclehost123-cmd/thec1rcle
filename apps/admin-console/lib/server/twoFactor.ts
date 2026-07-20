import { createHmac, randomBytes } from 'node:crypto';
import { getAdminDb } from '@/lib/firebase/admin';

const TOTP_WINDOW = 30; // 30 seconds
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

function generateTOTP(secret: string, timestamp: number = Date.now()): string {
  const time = Math.floor(timestamp / 1000 / TOTP_WINDOW);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));

  const decodedSecret = Buffer.from(secret, 'ascii');
  const hmac = createHmac('sha1', decodedSecret);
  hmac.update(buffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (code % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    codes.push(code.match(/.{1,4}/g)!.join('-'));
  }
  return codes;
}

function generateSecret(): string {
  const key = randomBytes(10);
  return base32Encode(key);
}

function getOtpAuthURI(secret: string, email: string): string {
  const issuer = encodeURIComponent('C1RCLE Admin');
  const user = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${user}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_WINDOW}`;
}

export interface TwoFactorSetup {
  secret: string;
  uri: string;
  recoveryCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt?: string;
}

export async function setupTwoFactor(adminId: string, email: string): Promise<TwoFactorSetup> {
  const db = getAdminDb();
  const secret = generateSecret();
  const recoveryCodes = generateRecoveryCodes();
  const hashedCodes = recoveryCodes.map((c) =>
    createHmac('sha256', c).digest('hex').slice(0, 16),
  );

  await db.collection('admin_2fa').doc(adminId).set({
    secret,
    recoveryCodes: hashedCodes,
    enabled: false,
    createdAt: new Date().toISOString(),
  });

  return {
    secret,
    uri: getOtpAuthURI(secret, email),
    recoveryCodes,
  };
}

export async function getTwoFactorStatus(adminId: string): Promise<TwoFactorStatus> {
  const db = getAdminDb();
  const doc = await db.collection('admin_2fa').doc(adminId).get();
  if (!doc.exists) return { enabled: false };
  const data = doc.data()!;
  return { enabled: data.enabled, verifiedAt: data.verifiedAt };
}

export async function verifyTwoFactor(
  adminId: string,
  token: string,
): Promise<{ valid: boolean; recovery?: string }> {
  const db = getAdminDb();
  const doc = await db.collection('admin_2fa').doc(adminId).get();
  if (!doc.exists) return { valid: false };

  const data = doc.data()!;
  if (!data.secret) return { valid: false };

  // Check if it's a recovery code
  if (token.length > 6) {
    const codeHash = createHmac('sha256', token).digest('hex').slice(0, 16);
    const codes: string[] = data.recoveryCodes || [];
    const idx = codes.indexOf(codeHash);
    if (idx !== -1) {
      codes.splice(idx, 1);
      await db.collection('admin_2fa').doc(adminId).update({
        recoveryCodes: codes,
        lastRecoveryAt: new Date().toISOString(),
      });
      return { valid: true, recovery: 'used' };
    }
    return { valid: false };
  }

  // Check current and adjacent time windows (±1 for clock drift)
  const now = Date.now();
  for (let drift = -1; drift <= 1; drift++) {
    const expected = generateTOTP(data.secret, now + drift * TOTP_WINDOW * 1000);
    if (expected === token) {
      return { valid: true };
    }
  }

  return { valid: false };
}

export async function enableTwoFactor(adminId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection('admin_2fa').doc(adminId).update({
    enabled: true,
    verifiedAt: new Date().toISOString(),
  });
}

export async function disableTwoFactor(adminId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection('admin_2fa').doc(adminId).delete();
}

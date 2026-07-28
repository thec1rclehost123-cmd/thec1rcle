import { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'node:crypto';

const SCANNER_AUTH_SESSION_COLLECTION = 'scanner_auth_sessions';

type SessionInputCodeData = {
  code: string;
  eventId: string;
  venueId?: string | null;
  type?: string;
  maxDevices?: number;
  allowReuse?: boolean;
};

export type ScannerSessionValidation =
  | {
      authorized: true;
      sessionId: string;
      sessionRef: any;
      sessionData: any;
      codeDoc: any;
      codeData: any;
    }
  | { authorized: false };

function getRuntimeSecret(name: string, developmentFallback: string): string {
  const value = process.env[name];
  if (value) return value;

  const env = process.env.NODE_ENV || 'development';
  if (env === 'development' || env === 'test') {
    return developmentFallback;
  }

  throw new Error(`${name} environment variable is required in production`);
}

export function getQrSecret(): string {
  return getRuntimeSecret('QR_SECRET_KEY', 'dev-only-qr-secret');
}

export function getScannerSessionSecret(): string {
  return getRuntimeSecret('SCANNER_SESSION_SECRET', 'dev-only-scanner-session-secret');
}

export function hashScannerSessionToken(token: string, secret = getScannerSessionSecret()): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export async function createScannerSession(
  fastify: FastifyInstance,
  codeId: string,
  codeData: SessionInputCodeData,
): Promise<
  | { ok: true; sessionToken: string; sessionExpiresAt: string; sessionId: string }
  | { ok: false; error: string }
> {
  const db = (fastify as any).db;
  const now = new Date();
  const nowIso = now.toISOString();
  const maxDevices = codeData.maxDevices ?? 5;

  const existingSnap = await db
    .collection(SCANNER_AUTH_SESSION_COLLECTION)
    .where('codeId', '==', codeId)
    .where('revokedAt', '==', null)
    .get();

  const activeSessions = existingSnap.docs.filter((doc: any) => {
    const expiresAt = doc.data()?.expiresAt;
    return !expiresAt || new Date(expiresAt) >= now;
  });

  if (activeSessions.length >= maxDevices && !codeData.allowReuse) {
    return { ok: false, error: 'Code device limit reached. Contact the event organiser.' };
  }

  const sessionToken = randomBytes(24).toString('hex');
  const sessionId = hashScannerSessionToken(sessionToken);
  const sessionExpiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

  await db
    .collection(SCANNER_AUTH_SESSION_COLLECTION)
    .doc(sessionId)
    .set({
      codeId,
      code: codeData.code,
      codeType: codeData.type || 'full',
      eventId: codeData.eventId,
      venueId: codeData.venueId || null,
      createdAt: nowIso,
      lastUsedAt: nowIso,
      expiresAt: sessionExpiresAt,
      revokedAt: null,
    });

  return { ok: true, sessionToken, sessionExpiresAt, sessionId };
}

export async function validateScannerSession(
  fastify: FastifyInstance,
  token: string,
): Promise<ScannerSessionValidation> {
  if (!token) return { authorized: false };

  const db = (fastify as any).db;
  const sessionId = hashScannerSessionToken(token);
  const sessionRef = db.collection(SCANNER_AUTH_SESSION_COLLECTION).doc(sessionId);
  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) return { authorized: false };

  const sessionData = sessionDoc.data();
  if (sessionData?.revokedAt) return { authorized: false };
  if (sessionData?.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
    return { authorized: false };
  }

  if (sessionData?.isStaffSession) {
    const virtualData = {
      code: sessionData.code || 'STAFF',
      eventId: sessionData.eventId,
      venueId: sessionData.venueId,
      deviceId: sessionData.deviceId,
      type: sessionData.codeType || 'scan_only',
      isStaffSession: true,
      userId: sessionData.userId,
      role: sessionData.role,
    };
    return {
      authorized: true,
      sessionId,
      sessionRef,
      sessionData,
      codeDoc: {
        id: sessionData.codeId || 'staff_' + sessionData.userId,
        exists: true,
        data: () => virtualData,
      } as any,
      codeData: virtualData,
    };
  }

  const codeDoc = await db.collection('event_codes').doc(sessionData.codeId).get();
  if (!codeDoc.exists) return { authorized: false };

  const codeData = codeDoc.data();
  if (codeData?.isRevoked) return { authorized: false };
  if (codeData?.expiresAt && new Date(codeData.expiresAt) < new Date()) {
    return { authorized: false };
  }

  return {
    authorized: true,
    sessionId,
    sessionRef,
    sessionData,
    codeDoc,
    codeData,
  };
}

export async function touchScannerSession(
  sessionRef: any,
  when = new Date().toISOString(),
): Promise<void> {
  try {
    await sessionRef.set({ lastUsedAt: when }, { merge: true });
  } catch {
    // Best-effort keepalive only
  }
}

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate.js';
import { hashScannerSessionToken } from '../../lib/scannerSessions.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';
import scanRoutes from './scan.js';

async function buildServer(db = new MockFirestore()) {
  const server = Fastify({ logger: false });
  server.decorate('db', db as any);
  server.decorate('auth', {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'scanner-session-token') throw new Error('not a Firebase token');
      return {
        uid: token,
        email: `${token}@example.com`,
      };
    }),
  } as any);
  server.decorate('broadcast', vi.fn() as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    const bearer = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (bearer) request.user = { uid: bearer };
    if (!request.user) return reply.status(401).send({ error: 'Authentication required' });
  });
  await server.register(validatePlugin);
  await server.register(scanRoutes);
  return server;
}

describe('scanner route fail-closed boundaries', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('does not mint a staff scanner session without Firebase authentication', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/staff/session',
      payload: {
        eventId: 'event-1',
        venueId: 'venue-1',
        deviceId: 'scanner_device_123456789',
      },
    });
    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('rejects an ordinary Firebase attendee as scanner staff', async () => {
    const db = new MockFirestore();
    db.seed('events/event-1', { venueId: 'venue-1', status: 'scheduled' });
    const server = await buildServer(db);
    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { authorization: 'Bearer attendee-1' },
      payload: {
        qrData: 'not-a-jwt',
        eventId: 'event-1',
        venueId: 'venue-1',
        deviceId: 'scanner_device_123456789',
      },
    });
    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('retires unsigned and jwt_verified legacy payloads without writes', async () => {
    const db = new MockFirestore();
    const token = 'scanner-session-token';
    db.seed(`scanner_auth_sessions/${hashScannerSessionToken(token)}`, {
      codeId: 'staff-1',
      code: 'STAFF',
      codeType: 'scan_only',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId: 'scanner_device_123456789',
      userId: 'staff-1',
      role: 'door',
      isStaffSession: true,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const server = await buildServer(db);

    for (const qrData of [
      JSON.stringify({ o: 'order-1', e: 'event-1', sig: 'jwt_verified' }),
      JSON.stringify({ o: 'order-1', e: 'event-1', sig: 'forged' }),
    ]) {
      const response = await server.inject({
        method: 'POST',
        url: '/',
        headers: { 'x-scanner-code': token },
        payload: {
          qrData,
          eventId: 'event-1',
          venueId: 'venue-1',
          deviceId: 'scanner_device_123456789',
        },
      });
      expect(response.statusCode).toBe(410);
      expect(response.json().code).toBe('LEGACY_QR_RETIRED');
    }

    expect(db.listCollection('ticket_scans')).toHaveLength(0);
    await server.close();
  });
});

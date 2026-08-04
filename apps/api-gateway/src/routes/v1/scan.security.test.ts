import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate.js';
import { hashScannerSessionToken } from '../../lib/scannerSessions.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';
import { createCoverWalletQrToken } from '@c1rcle/core/cover-charge-engine';
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

  it.each([
    { role: 'DOOR', canCharge: true, codeType: 'charge' },
    { role: 'SECURITY', canCharge: false, codeType: 'scan_only' },
  ])(
    'mints a scoped Cover Wallet permission only for an authorized $role staff session',
    async ({ role, canCharge, codeType }) => {
      const db = new MockFirestore();
      const uid = `${role.toLowerCase()}-1`;
      db.seed('events/event-1', {
        venueId: 'venue-1',
        status: 'scheduled',
        title: 'QA Cover Event',
      });
      db.seed(`venue_staff/${uid}`, {
        userId: uid,
        venueId: 'venue-1',
        role,
        name: `${role} Operator`,
        verified: true,
        isActive: true,
        status: 'active',
      });
      const server = await buildServer(db);

      const response = await server.inject({
        method: 'POST',
        url: '/staff/session',
        headers: { authorization: `Bearer ${uid}` },
        payload: {
          eventId: 'event-1',
          venueId: 'venue-1',
          deviceId: `scanner_device_${role.toLowerCase()}_123456`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().permissions.canCharge).toBe(canCharge);
      expect(db.listCollection('scanner_auth_sessions')).toHaveLength(1);
      expect(db.listCollection('scanner_auth_sessions')[0].data).toMatchObject({
        codeType,
        role: role.toLowerCase(),
        venueId: 'venue-1',
        eventId: 'event-1',
      });
      await server.close();
    },
  );

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

  it('accepts a valid rotating Cover Wallet QR only for its bound charge device and scope', async () => {
    const db = new MockFirestore();
    const token = 'scanner-session-token';
    const deviceId = 'scanner_device_123456789';
    const wallet = {
      id: 'wallet-1',
      orderId: 'order-1',
      eventId: 'event-1',
      venueId: 'venue-1',
      userId: 'guest-1',
      state: 'ACTIVE',
      currentBalancePaise: 49_900,
      openingBalancePaise: 99_900,
      totalDebitedPaise: 50_000,
      rules: {
        terminationTime: new Date(Date.now() + 60_000).toISOString(),
        allowedPresetItems: [],
        showBalanceToGuest: true,
      },
    };
    db.seed(`scanner_auth_sessions/${hashScannerSessionToken(token)}`, {
      codeId: 'charge-code-1',
      code: 'CHARGE',
      codeType: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId,
      userId: 'staff-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    db.seed('event_codes/charge-code-1', {
      code: 'CHARGE',
      type: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId,
      isRevoked: false,
    });
    db.seed(`bound_devices/venue-1_${deviceId}`, {
      bound: true,
      status: 'active',
      venueId: 'venue-1',
      deviceId,
    });
    db.seed('cover_wallets/wallet-1', wallet);

    const qr = createCoverWalletQrToken(wallet);
    const server = await buildServer(db);
    const response = await server.inject({
      method: 'POST',
      url: '/wallet-qr',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        qrData: qr.token,
        eventId: 'event-1',
        eventCode: 'CHARGE',
        venueId: 'venue-1',
        deviceId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.json()).toMatchObject({
      wallet: {
        id: 'wallet-1',
        eventId: 'event-1',
        venueId: 'venue-1',
        currentBalancePaise: 49_900,
      },
    });
    await server.close();
  });

  it('rejects a tampered Cover Wallet QR before returning wallet data', async () => {
    const db = new MockFirestore();
    const token = 'scanner-session-token';
    const deviceId = 'scanner_device_123456789';
    const wallet = {
      id: 'wallet-1',
      orderId: 'order-1',
      eventId: 'event-1',
      venueId: 'venue-1',
      userId: 'guest-1',
      state: 'ACTIVE',
      currentBalancePaise: 50_000,
      openingBalancePaise: 50_000,
      rules: { terminationTime: new Date(Date.now() + 60_000).toISOString() },
    };
    db.seed(`scanner_auth_sessions/${hashScannerSessionToken(token)}`, {
      codeId: 'charge-code-1',
      code: 'CHARGE',
      codeType: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId,
      userId: 'staff-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    db.seed('event_codes/charge-code-1', {
      code: 'CHARGE',
      type: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId,
    });
    db.seed(`bound_devices/venue-1_${deviceId}`, {
      bound: true,
      status: 'active',
    });
    db.seed('cover_wallets/wallet-1', wallet);

    const qr = createCoverWalletQrToken(wallet).token;
    const tamperedQr = `${qr.slice(0, -1)}${qr.endsWith('a') ? 'b' : 'a'}`;
    const server = await buildServer(db);
    const response = await server.inject({
      method: 'POST',
      url: '/wallet-qr',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        qrData: tamperedQr,
        eventId: 'event-1',
        eventCode: 'CHARGE',
        venueId: 'venue-1',
        deviceId,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('COVER_QR_INVALID');
    await server.close();
  });

  it('rejects a valid Cover Wallet QR when the submitted device is not the bound session device', async () => {
    const db = new MockFirestore();
    const token = 'scanner-session-token';
    const boundDeviceId = 'scanner_device_123456789';
    const submittedDeviceId = 'scanner_device_987654321';
    const wallet = {
      id: 'wallet-1',
      orderId: 'order-1',
      eventId: 'event-1',
      venueId: 'venue-1',
      userId: 'guest-1',
      state: 'ACTIVE',
      currentBalancePaise: 50_000,
      openingBalancePaise: 50_000,
      rules: { terminationTime: new Date(Date.now() + 60_000).toISOString() },
    };
    db.seed(`scanner_auth_sessions/${hashScannerSessionToken(token)}`, {
      codeId: 'charge-code-1',
      code: 'CHARGE',
      codeType: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId: boundDeviceId,
      userId: 'staff-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    db.seed('event_codes/charge-code-1', {
      code: 'CHARGE',
      type: 'charge',
      eventId: 'event-1',
      venueId: 'venue-1',
      deviceId: boundDeviceId,
    });
    db.seed(`bound_devices/venue-1_${submittedDeviceId}`, {
      bound: true,
      status: 'active',
    });
    db.seed('cover_wallets/wallet-1', wallet);

    const server = await buildServer(db);
    const response = await server.inject({
      method: 'POST',
      url: '/wallet-qr',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        qrData: createCoverWalletQrToken(wallet).token,
        eventId: 'event-1',
        eventCode: 'CHARGE',
        venueId: 'venue-1',
        deviceId: submittedDeviceId,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().result).toBe('device_invalid');
    await server.close();
  });
});

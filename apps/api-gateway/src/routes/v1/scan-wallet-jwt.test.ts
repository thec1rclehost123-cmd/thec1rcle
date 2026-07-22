import Fastify from 'fastify';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { TEST_QR_SECRET } = vi.hoisted(() => {
  process.env.QR_SECRET_KEY = 'test-qr-secret';
  return { TEST_QR_SECRET: 'test-qr-secret' };
});

vi.mock('@c1rcle/core/scan-engine', () => ({
  verifyScanSignature: vi.fn(() => true),
  validateScannerDevice: vi.fn(async () => ({
    valid: true,
    device: { deviceName: 'Door iPad' },
    ref: { update: vi.fn() },
  })),
  recordScanAttempt: vi.fn(async () => undefined),
}));

vi.mock('../../lib/scannerLiveState', () => ({
  getScannerSummarySnapshot: vi.fn(async () => ({})),
  recordScannerLiveEvent: vi.fn(async () => undefined),
  updateScannerSummary: vi.fn(async () => undefined),
  upsertScannerDeviceState: vi.fn(async () => undefined),
}));

import validatePlugin from '../../plugins/validate';
import scanRoutes from './scan';

function base64Url(value: unknown) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signTicketJwt(payload: Record<string, unknown>) {
  const header = base64Url({ alg: 'HS256', typ: 'JWT', kid: 'ticket-v1' });
  const body = base64Url(payload);
  const signature = createHmac('sha256', TEST_QR_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function signWalletJwt(payload: Record<string, unknown>) {
  const header = base64Url({ alg: 'HS256', typ: 'JWT', kid: 'wallet-v1' });
  const body = base64Url(payload);
  const signature = createHmac('sha256', TEST_QR_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function snapshot(id: string, ref: any, data: any) {
  return {
    id,
    ref,
    exists: Boolean(data),
    data: () => data,
  };
}

function createDb(seed: Record<string, Record<string, any>>) {
  const data = seed;

  function collection(name: string): any {
    if (!data[name]) data[name] = {};
    return {
      doc(id: string) {
        const ref = {
          id,
          async get() {
            return snapshot(id, ref, data[name][id] || null);
          },
          async set(value: any) {
            data[name][id] = { ...(value || {}) };
          },
          async update(value: any) {
            data[name][id] = { ...(data[name][id] || {}), ...(value || {}) };
          },
        };
        return ref;
      },
      where(field: string, _op: string, value: any) {
        const filters = [{ field, value }];
        const query: any = {
          where(nextField: string, _nextOp: string, nextValue: any) {
            filters.push({ field: nextField, value: nextValue });
            return query;
          },
          limit(count: number) {
            query._limit = count;
            return query;
          },
          async get() {
            const entries = Object.entries(data[name] || {}).filter(([, row]) =>
              filters.every((filter) => row?.[filter.field] === filter.value),
            );
            const limited =
              typeof query._limit === 'number' ? entries.slice(0, query._limit) : entries;
            const docs = limited.map(([id, row]) => snapshot(id, collection(name).doc(id), row));
            return { empty: docs.length === 0, docs, size: docs.length };
          },
        };
        return query;
      },
    };
  }

  return {
    data,
    collection,
    async runTransaction(work: (tx: any) => Promise<void>) {
      return work({
        get: (ref: any) => ref.get(),
        set: (ref: any, value: any) => ref.set(value),
        update: (ref: any, value: any) => ref.update(value),
      });
    },
  };
}

async function buildServer(seedOverrides: Record<string, Record<string, any>> = {}) {
  const db = createDb({
    tickets: {
      'TKT-ORD-1-GEN-1': {
        id: 'TKT-ORD-1-GEN-1',
        bookingCode: 'AX9B21',
        ticketId: 'ord_1-general-1',
        orderId: 'ord_1',
        eventId: 'event_1',
        userId: 'user_1',
        tierId: 'general',
        tierName: 'General',
        status: 'active',
        scanCountUsed: 0,
      },
    },
    orders: {
      ord_1: {
        id: 'ord_1',
        eventId: 'event_1',
        userId: 'user_1',
        status: 'confirmed',
        userName: 'Guest User',
      },
    },
    ticket_scans: {},
    events: { event_1: { id: 'event_1', venueId: 'venue_1' } },
    ...seedOverrides,
  });
  const server = Fastify({ logger: false });
  server.decorate('db', db as any);
  server.decorate('firebase', {
    auth: () => ({ verifyIdToken: vi.fn(async () => ({ uid: 'scanner_1', role: 'manager' })) }),
  } as any);
  (server as any).decorate('broadcast', vi.fn());
  (server as any).decorate(
    'verifyPartnerAccess',
    vi.fn(async () => undefined),
  );

  await server.register(validatePlugin);
  await server.register(scanRoutes, { prefix: '/api/v1/scan' });
  await server.register(scanRoutes, { prefix: '/api/v1/scanner' });
  return { server, db };
}

describe('scanner wallet ticket QR route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a raw ticket document id and activates the pending cover wallet atomically', async () => {
    const { server, db } = await buildServer({
      cover_wallets: {
        wallet_1: {
          id: 'wallet_1',
          orderId: 'ord_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          userId: 'user_1',
          state: 'PENDING',
        },
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/scan',
      headers: { authorization: 'Bearer scanner-token' },
      payload: { eventId: 'event_1', qrData: 'TKT-ORD-1-GEN-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, result: 'valid' });
    expect(db.data.ticket_scans['ticket_TKT-ORD-1-GEN-1']).toMatchObject({
      qrMode: 'raw_id',
      ticketDocumentId: 'TKT-ORD-1-GEN-1',
    });
    expect(db.data.cover_wallets.wallet_1).toMatchObject({
      state: 'ACTIVE',
      scanId: 'ticket_TKT-ORD-1-GEN-1',
    });

    await server.close();
  });

  it('accepts a signed wallet ticket JWT QR once and rejects reuse', async () => {
    const { server, db } = await buildServer();
    const now = Math.floor(Date.now() / 1000);
    const qrData = signTicketJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'ticket',
      ver: 1,
      sub: 'ord_1-general-1',
      jti: 'TKT-ORD-1-GEN-1',
      orderId: 'ord_1',
      eventId: 'event_1',
      userId: 'user_1',
      tierId: 'general',
      iat: now,
      nbf: now,
      exp: now + 60,
    });

    const first = await server.inject({
      method: 'POST',
      url: '/api/v1/scan',
      headers: { authorization: 'Bearer scanner-token' },
      payload: { eventId: 'event_1', qrData },
    });
    const second = await server.inject({
      method: 'POST',
      url: '/api/v1/scan',
      headers: { authorization: 'Bearer scanner-token' },
      payload: { eventId: 'event_1', qrData },
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ success: true, result: 'valid' });
    const scanDocKey = `ticket_TKT-ORD-1-GEN-1`;
    expect(db.data.ticket_scans[scanDocKey]).toMatchObject({
      result: 'valid',
      qrMode: 'legacy_jwt',
      ticketDocumentId: 'TKT-ORD-1-GEN-1',
    });
    expect(second.statusCode).toBe(400);
    expect(second.json()).toMatchObject({ result: 'already_scanned' });

    await server.close();
  });

  it('loads an active wallet from a short-lived payment QR JWT', async () => {
    const { server } = await buildServer({
      cover_wallets: {
        wallet_1: {
          id: 'wallet_1',
          orderId: 'ord_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          userId: 'user_1',
          state: 'ACTIVE',
          currentBalancePaise: 60000,
          openingBalancePaise: 100000,
          totalDebitedPaise: 40000,
          guestFirstName: 'Guest',
          rules: {
            allowedPresetItems: [
              { id: 'beer', name: 'Beer', amountPaise: 40000, isAvailable: true, sortOrder: 1 },
            ],
            minChargeAmountPaise: 1000,
            maxChargeAmountPaise: 100000,
            showBalanceToGuest: true,
          },
        },
      },
    });
    const now = Math.floor(Date.now() / 1000);
    const qrData = signWalletJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'wallet',
      walletId: 'wallet_1',
      userId: 'user_1',
      iat: now,
      nbf: now,
      exp: now + 60,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/scan/wallet-qr',
      headers: { authorization: 'Bearer scanner-token' },
      payload: { qrData, eventId: 'event_1', venueId: 'venue_1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      wallet: {
        id: 'wallet_1',
        eventId: 'event_1',
        venueId: 'venue_1',
        currentBalancePaise: 60000,
        paymentQrJwt: qrData,
        rules: {
          allowedPresetItems: [
            { id: 'beer', name: 'Beer', amountPaise: 40000, isAvailable: true, sortOrder: 1 },
          ],
        },
      },
    });

    await server.close();
  });

  it('rejects wallet JWT QR payloads for the wrong event', async () => {
    const { server } = await buildServer({
      events: { event_2: { id: 'event_2', venueId: 'venue_1' } },
    });
    const now = Math.floor(Date.now() / 1000);
    const qrData = signTicketJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'ticket',
      ver: 1,
      sub: 'ord_1-general-1',
      jti: 'TKT-ORD-1-GEN-1',
      orderId: 'ord_1',
      eventId: 'event_1',
      userId: 'user_1',
      iat: now,
      nbf: now,
      exp: now + 60,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/scan',
      headers: { authorization: 'Bearer scanner-token' },
      payload: { eventId: 'event_2', qrData },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ result: 'wrong_event' });

    await server.close();
  });
});

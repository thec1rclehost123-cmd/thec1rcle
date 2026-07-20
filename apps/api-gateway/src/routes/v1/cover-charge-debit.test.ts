import Fastify from 'fastify';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { debitWalletMock, TEST_QR_SECRET } = vi.hoisted(() => {
  process.env.QR_SECRET_KEY = 'test-qr-secret';
  return {
    TEST_QR_SECRET: 'test-qr-secret',
    debitWalletMock: vi.fn(async () => ({
      success: true,
      balanceAfterPaise: 50000,
      receipt: { itemName: 'Beer', amountPaise: 40000 },
    })),
  };
});

vi.mock('@c1rcle/core/cover-charge-engine', () => ({
  debitWallet: debitWalletMock,
  reverseTransaction: vi.fn(),
  topUpWallet: vi.fn(),
  freezeWallet: vi.fn(),
  unfreezeWallet: vi.fn(),
  generateReconciliation: vi.fn(),
}));

vi.mock('../../lib/scannerSessions', () => ({
  getQrSecret: () => TEST_QR_SECRET,
  validateScannerSession: vi.fn(async () => ({
    authorized: true,
    sessionId: 'scanner_session_1',
    codeDoc: { id: 'code_1' },
    codeData: {
      type: 'charge',
      eventId: 'event_1',
      venueId: 'venue_1',
      isRevoked: false,
    },
  })),
}));

import validatePlugin from '../../plugins/validate';
import coverChargeRoutes from './cover-charge';

function base64Url(value: unknown) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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

  const db = {
    collection(name: string): any {
      if (!data[name]) data[name] = {};
      return {
        doc(id: string) {
          const ref = {
            id,
            async get() {
              return snapshot(id, ref, data[name][id] || null);
            },
            collection(childName: string) {
              return db.collection(`${name}/${id}/${childName}`);
            },
          };
          return ref;
        },
      };
    },
  };

  return {
    ...db,
  };
}

async function buildServer() {
  const db = createDb({
    cover_wallets: {
      wallet_1: {
        id: 'wallet_1',
        orderId: 'ord_1',
        eventId: 'event_1',
        venueId: 'venue_1',
        userId: 'user_1',
        state: 'ACTIVE',
        currentBalancePaise: 90000,
        openingBalancePaise: 100000,
        totalDebitedPaise: 10000,
        rules: {
          maxDebitsPerMinutePerDevice: 3,
        },
      },
    },
    event_codes: {
      code_1: {
        type: 'charge',
        eventId: 'event_1',
        venueId: 'venue_1',
        isRevoked: false,
      },
    },
  });
  const server = Fastify({ logger: false });
  server.decorate('db', db as any);
  server.decorate('redis', {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    decr: vi.fn(async () => 0),
  } as any);
  server.decorate('firebase', {
    auth: () => ({ verifyIdToken: vi.fn(async () => Promise.reject(new Error('not firebase'))) }),
  } as any);

  await server.register(validatePlugin);
  await server.register(coverChargeRoutes, { prefix: '/api/v1/cover-charge' });
  return server;
}

function validDebitPayload(paymentQrJwt: string) {
  return {
    walletId: 'wallet_1',
    paymentQrJwt,
    presetItemId: 'beer',
    quantity: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    operatorId: 'code_1',
    operatorName: 'Bar Scanner',
    deviceId: 'device_1',
    eventCodeId: 'code_1',
    isOnline: true,
  };
}

describe('cover-charge debit route', () => {
  beforeEach(() => {
    debitWalletMock.mockClear();
  });

  it('rejects a debit when the payment QR belongs to another wallet', async () => {
    const server = await buildServer();
    const now = Math.floor(Date.now() / 1000);
    const qr = signWalletJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'wallet',
      walletId: 'wallet_2',
      userId: 'user_1',
      iat: now,
      nbf: now,
      exp: now + 60,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/cover-charge/debit',
      headers: { authorization: 'Bearer scanner-token' },
      payload: validDebitPayload(qr),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'PAYMENT_QR_WALLET_MISMATCH' });
    expect(debitWalletMock).not.toHaveBeenCalled();
    await server.close();
  });

  it('passes only verified scanner and payment QR context into debitWallet', async () => {
    const server = await buildServer();
    const now = Math.floor(Date.now() / 1000);
    const qr = signWalletJwt({
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
      url: '/api/v1/cover-charge/debit',
      headers: { authorization: 'Bearer scanner-token' },
      payload: validDebitPayload(qr),
    });

    expect(response.statusCode).toBe(200);
    expect(debitWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet_1',
        presetItemId: 'beer',
        operatorRole: 'charge_staff',
        eventCodeId: 'code_1',
        scannerSessionId: 'scanner_session_1',
      }),
    );
    await server.close();
  });
});

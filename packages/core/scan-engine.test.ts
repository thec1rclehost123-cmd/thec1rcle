import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const originalNodeEnv = process.env.NODE_ENV;
const originalQrSecret = process.env.QR_SECRET_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.QR_SECRET_KEY = 'test-qr-secret';
  vi.resetModules();
});

describe('scan-engine', () => {
  it('verifies signed paid ticket payloads', async () => {
    const { verifyScanSignature } = await import('./scan-engine.js');
    const payload: any = {
      o: 'order_1',
      e: 'event_1',
      t: 'ticket_1',
      u: 'user_1',
      q: 2,
      ts: 1711000000000,
      rt: 0,
    };

    payload.sig = createHmac('sha256', 'test-qr-secret')
      .update(`${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}:PAID`)
      .digest('hex')
      .substring(0, 16);

    expect(verifyScanSignature(payload)).toBe(true);
  });

  it('rejects bound devices that are not active', async () => {
    const { validateScannerDevice } = await import('./scan-engine.js');
    const get = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ status: 'revoked', bound: true }),
    });
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ get })),
      })),
    };

    const result = await validateScannerDevice(db as any, 'device_1', 'venue_1');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not authorized');
  });
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalQrSecret === undefined) {
    delete process.env.QR_SECRET_KEY;
  } else {
    process.env.QR_SECRET_KEY = originalQrSecret;
  }
});

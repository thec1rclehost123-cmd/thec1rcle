import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateScannerSession, debitWallet, checkAndIncrementVelocity } = vi.hoisted(() => ({
  validateScannerSession: vi.fn(),
  debitWallet: vi.fn(),
  checkAndIncrementVelocity: vi.fn(),
}));

vi.mock('../../lib/scannerSessions', () => ({
  validateScannerSession,
}));

vi.mock('@c1rcle/core/cover-charge-engine', () => ({
  debitWallet,
  checkAndIncrementVelocity,
  reverseTransaction: vi.fn(),
  topUpWallet: vi.fn(),
  freezeWallet: vi.fn(),
  unfreezeWallet: vi.fn(),
  generateReconciliation: vi.fn(),
}));

import coverChargeRoutes from './cover-charge';

function createReply() {
  return {
    statusCode: 200,
    payload: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.payload = payload;
      return payload;
    },
  };
}

async function registerRoutes() {
  const handlers = new Map<string, any>();
  const boundDeviceDoc = {
    exists: true,
    data: () => ({ bound: true, status: 'active' }),
  };
  const fastify: any = {
    validate: () => async () => undefined,
    requireAuth: async () => undefined,
    redis: {},
    log: { error: vi.fn(), warn: vi.fn() },
    db: {
      collection: vi.fn((collection: string) => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => (collection === 'bound_devices' ? boundDeviceDoc : { exists: false })),
        })),
      })),
    },
    get(path: string, _options: any, handler: any) {
      handlers.set(`GET ${path}`, handler);
    },
    post(path: string, _options: any, handler: any) {
      handlers.set(`POST ${path}`, handler);
    },
  };
  await coverChargeRoutes(fastify);
  return { handlers, fastify };
}

describe('cover-charge scanner trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndIncrementVelocity.mockResolvedValue(true);
    debitWallet.mockResolvedValue({ success: true, balanceAfterPaise: 9000 });
  });

  it('rejects an ordinary bearer credential that is not a bound charge session', async () => {
    validateScannerSession.mockResolvedValue({ authorized: false });
    const { handlers } = await registerRoutes();
    const reply = createReply();

    await handlers.get('POST /debit')(
      {
        headers: { authorization: 'Bearer ordinary-firebase-token' },
        body: {
          walletId: 'wallet_1',
          presetItemId: 'water',
          quantity: 1,
          idempotencyKey: 'db11d94d-c258-4f3e-adc2-4cc509578d13',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(401);
    expect(debitWallet).not.toHaveBeenCalled();
  });

  it('derives all operator and tenant authority from the bound charge session', async () => {
    validateScannerSession.mockResolvedValue({
      authorized: true,
      sessionId: 'session_1',
      sessionData: {
        codeId: 'charge_code_1',
        codeType: 'charge',
        eventId: 'event_1',
        venueId: 'venue_1',
        deviceId: 'device_1',
        userId: 'staff_1',
        userName: 'Door Manager',
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes();
    const reply = createReply();

    await handlers.get('POST /debit')(
      {
        headers: { authorization: 'Bearer charge-session-token' },
        body: {
          walletId: 'wallet_1',
          presetItemId: 'water',
          quantity: 1,
          idempotencyKey: 'db11d94d-c258-4f3e-adc2-4cc509578d13',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(debitWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 'staff_1',
        operatorRole: 'charge_operator',
        deviceId: 'device_1',
        eventCodeId: 'charge_code_1',
        authorizedEventId: 'event_1',
        authorizedVenueId: 'venue_1',
        scannerSessionId: 'session_1',
      }),
    );
  });
});

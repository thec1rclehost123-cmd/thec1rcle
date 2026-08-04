import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  validateScannerSession,
  debitWallet,
  checkAndIncrementVelocity,
  createCoverWalletQrToken,
  hashSupervisorPin,
  reverseTransaction,
  topUpWallet,
  freezeWallet,
  unfreezeWallet,
} = vi.hoisted(() => ({
  validateScannerSession: vi.fn(),
  debitWallet: vi.fn(),
  checkAndIncrementVelocity: vi.fn(),
  createCoverWalletQrToken: vi.fn(),
  hashSupervisorPin: vi.fn(),
  reverseTransaction: vi.fn(),
  topUpWallet: vi.fn(),
  freezeWallet: vi.fn(),
  unfreezeWallet: vi.fn(),
}));

vi.mock('../../lib/scannerSessions', () => ({
  validateScannerSession,
}));

vi.mock('@c1rcle/core/cover-charge-engine', () => ({
  debitWallet,
  checkAndIncrementVelocity,
  reverseTransaction,
  topUpWallet,
  freezeWallet,
  unfreezeWallet,
  generateReconciliation: vi.fn(),
  createCoverWalletQrToken,
  hashSupervisorPin,
}));

import coverChargeRoutes from './cover-charge';

function createReply() {
  return {
    statusCode: 200,
    payload: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(payload: any) {
      this.payload = payload;
      return payload;
    },
  };
}

async function registerRoutes({
  boundDeviceActive = true,
  walletDocuments = {} as Record<string, any>,
  walletTransactions = {} as Record<string, any[]>,
} = {}) {
  const handlers = new Map<string, any>();
  const batch = {
    set: vi.fn().mockReturnThis(),
    commit: vi.fn(async () => undefined),
  };
  const boundDeviceDoc = {
    exists: boundDeviceActive,
    data: () => ({ bound: boundDeviceActive, status: boundDeviceActive ? 'active' : 'revoked' }),
  };
  const fastify: any = {
    validate: () => async () => undefined,
    requireAuth: async () => undefined,
    enrichAuthContext: async () => undefined,
    redis: {},
    log: { error: vi.fn(), warn: vi.fn() },
    db: {
      batch: vi.fn(() => batch),
      collection: vi.fn((collection: string) => {
        const walletSnapshot = (id: string, wallet: any) => ({
          id,
          exists: true,
          data: () => wallet,
        });
        const query = (filters: Array<{ field: string; value: any }> = [], max = 100) => ({
          where(field: string, _operator: string, value: any) {
            return query([...filters, { field, value }], max);
          },
          limit(nextMax: number) {
            return query(filters, nextMax);
          },
          async get() {
            const docs =
              collection === 'cover_wallets'
                ? Object.entries(walletDocuments)
                    .filter(([, wallet]: any) =>
                      filters.every(({ field, value }) => wallet[field] === value),
                    )
                    .slice(0, max)
                    .map(([id, wallet]) => walletSnapshot(id, wallet))
                : [];
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        });
        return {
          doc: vi.fn((id: string) => {
            const wallet = collection === 'cover_wallets' ? walletDocuments[id] : undefined;
            return {
              id: id || 'generated_audit_id',
              get: vi.fn(async () =>
                collection === 'bound_devices'
                  ? boundDeviceDoc
                  : wallet
                    ? walletSnapshot(id, wallet)
                    : { id, exists: false, data: () => undefined },
              ),
              collection: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn(async () => ({
                      docs: (walletTransactions[id] || []).map((transaction, index) => ({
                        id: transaction.id || `transaction_${index}`,
                        data: () => transaction,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }),
          where: query().where,
        };
      }),
    },
    get(path: string, _options: any, handler: any) {
      handlers.set(`GET ${path}`, handler);
    },
    post(path: string, _options: any, handler: any) {
      handlers.set(`POST ${path}`, handler);
    },
    put(path: string, _options: any, handler: any) {
      handlers.set(`PUT ${path}`, handler);
    },
  };
  await coverChargeRoutes(fastify);
  return { handlers, fastify, batch };
}

describe('cover-charge scanner trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkAndIncrementVelocity.mockResolvedValue(true);
    debitWallet.mockResolvedValue({ success: true, balanceAfterPaise: 9000 });
    reverseTransaction.mockResolvedValue({ success: true, balanceAfterPaise: 10_000 });
    topUpWallet.mockResolvedValue({ success: true, balanceAfterPaise: 20_000 });
    freezeWallet.mockResolvedValue({ success: true, state: 'FROZEN' });
    unfreezeWallet.mockResolvedValue({ success: true, state: 'ACTIVE' });
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

  it('accepts the standalone Scanner x-scanner-code session header', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes();
    const reply = createReply();

    await handlers.get('POST /debit')(
      {
        headers: { 'x-scanner-code': 'charge-session-token' },
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
    expect(validateScannerSession).toHaveBeenCalledWith(expect.anything(), 'charge-session-token');
    expect(debitWallet).toHaveBeenCalledTimes(1);
  });

  it('rejects ambiguous scanner credentials before Cover Wallet mutation', async () => {
    const { handlers } = await registerRoutes();
    const reply = createReply();

    await handlers.get('POST /debit')(
      {
        headers: {
          authorization: 'Bearer one-session',
          'x-scanner-code': 'another-session',
        },
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
    expect(validateScannerSession).not.toHaveBeenCalled();
    expect(debitWallet).not.toHaveBeenCalled();
  });

  it('fails closed without calling the debit engine when Redis velocity authority is unavailable', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    checkAndIncrementVelocity.mockRejectedValueOnce(new Error('Redis offline'));
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

    expect(reply.statusCode).toBe(503);
    expect(reply.payload.code).toBe('VELOCITY_UNAVAILABLE');
    expect(debitWallet).not.toHaveBeenCalled();
  });

  it('enforces the device-wide three-debit rolling-window limit before mutation', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    checkAndIncrementVelocity.mockResolvedValueOnce(false);
    const { handlers } = await registerRoutes();
    const reply = createReply();

    await handlers.get('POST /debit')(
      {
        headers: { authorization: 'Bearer charge-session-token' },
        body: {
          walletId: 'wallet_2',
          presetItemId: 'water',
          quantity: 1,
          idempotencyKey: 'c6ce6d22-da9d-4c63-90ea-cc93cd2dcd33',
        },
      },
      reply,
    );

    expect(reply.statusCode).toBe(429);
    expect(reply.payload.code).toBe('VELOCITY_EXCEEDED');
    expect(checkAndIncrementVelocity).toHaveBeenCalledWith(
      expect.anything(),
      'device_1',
      'wallet_2',
      3,
      'c6ce6d22-da9d-4c63-90ea-cc93cd2dcd33',
    );
    expect(debitWallet).not.toHaveBeenCalled();
  });

  it('rejects a charge session whose hardware device is not actively bound', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes({ boundDeviceActive: false });
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

    expect(reply.statusCode).toBe(401);
    expect(checkAndIncrementVelocity).not.toHaveBeenCalled();
    expect(debitWallet).not.toHaveBeenCalled();
  });

  it('refuses ambiguous order lookup when one order owns multiple active wallets', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes({
      walletDocuments: {
        wallet_1: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          state: 'ACTIVE',
        },
        wallet_2: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          state: 'ACTIVE',
        },
      },
    });
    const reply = createReply();

    await handlers.get('GET /wallet/by-order/:orderId')(
      {
        headers: { authorization: 'Bearer charge-session-token' },
        params: { orderId: 'order_1' },
      },
      reply,
    );

    expect(reply.statusCode).toBe(409);
    expect(reply.payload.code).toBe('WALLET_SELECTION_REQUIRED');
  });

  it('returns exactly one active wallet only inside the bound event and venue scope', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes({
      walletDocuments: {
        scoped_wallet: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          state: 'ACTIVE',
          currentBalancePaise: 20_000,
          openingBalancePaise: 50_000,
          rules: { allowedPresetItems: [] },
        },
        other_venue_wallet: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_2',
          state: 'ACTIVE',
        },
        terminated_wallet: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_1',
          state: 'TERMINATED',
        },
      },
    });
    const reply = createReply();

    const result = await handlers.get('GET /wallet/by-order/:orderId')(
      {
        headers: { authorization: 'Bearer charge-session-token' },
        params: { orderId: 'order_1' },
      },
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(result.wallet).toMatchObject({
      id: 'scoped_wallet',
      orderId: 'order_1',
      currentBalancePaise: 20_000,
    });
  });

  it('does not reveal an order wallet outside the charge session scope', async () => {
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
      },
      codeDoc: { id: 'charge_code_1' },
      codeData: { type: 'charge' },
    });
    const { handlers } = await registerRoutes({
      walletDocuments: {
        other_venue_wallet: {
          orderId: 'order_1',
          eventId: 'event_1',
          venueId: 'venue_2',
          state: 'ACTIVE',
        },
      },
    });
    const reply = createReply();

    await handlers.get('GET /wallet/by-order/:orderId')(
      {
        headers: { authorization: 'Bearer charge-session-token' },
        params: { orderId: 'order_1' },
      },
      reply,
    );

    expect(reply.statusCode).toBe(404);
    expect(reply.payload.error).toBe('No active wallet for this order');
  });
});

describe('cover-charge supervisor and guest boundaries', () => {
  const venueWallet = {
    orderId: 'order_1',
    eventId: 'event_1',
    venueId: 'venue_1',
    userId: 'guest_1',
    state: 'ACTIVE',
    currentBalancePaise: 10_000,
    openingBalancePaise: 20_000,
    rules: {
      terminationTime: new Date(Date.now() + 60_000).toISOString(),
      showBalanceToGuest: false,
      showTransactionHistory: false,
    },
  };

  function venueRequest(role: string, body: Record<string, any>) {
    return {
      headers: { 'x-partner-id': 'venue_1' },
      user: { uid: 'operator_1', email: 'operator@test.c1rcle.com' },
      authContext: {
        memberships: [
          {
            partnerId: 'venue_1',
            partnerType: 'venue',
            role,
            isActive: true,
          },
        ],
      },
      body,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    hashSupervisorPin.mockReturnValue('scrypt-v1$salt$derived');
    reverseTransaction.mockResolvedValue({ success: true, balanceAfterPaise: 10_000 });
    topUpWallet.mockResolvedValue({ success: true, balanceAfterPaise: 20_000 });
    freezeWallet.mockResolvedValue({ success: true, state: 'FROZEN' });
    unfreezeWallet.mockResolvedValue({ success: true, state: 'ACTIVE' });
  });

  it('stores only a server-generated supervisor PIN hash for a venue owner', async () => {
    const { handlers, batch } = await registerRoutes();
    const reply = createReply();
    const request = {
      ...venueRequest('OWNER', { pin: '2468' }),
      id: 'request_1',
    };

    const result = await handlers.get('PUT /supervisor-pin')(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(result).toMatchObject({ success: true, configured: true });
    expect(hashSupervisorPin).toHaveBeenCalledWith('2468');
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        supervisorPinHash: 'scrypt-v1$salt$derived',
        supervisorPinVersion: 'scrypt-v1',
        supervisorPinUpdatedBy: 'operator_1',
      }),
      { merge: true },
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'cover_charge.supervisor_pin_rotated',
        actorId: 'operator_1',
        partnerId: 'venue_1',
      }),
    );
    for (const call of batch.set.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain('"pin":"2468"');
    }
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('blocks a venue manager from rotating the supervisor PIN', async () => {
    const { handlers, batch } = await registerRoutes();
    const reply = createReply();

    await handlers.get('PUT /supervisor-pin')(venueRequest('MANAGER', { pin: '2468' }), reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload.code).toBe('PERMISSION_REQUIRED');
    expect(hashSupervisorPin).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('blocks non-supervisor venue staff from reversals, top-ups, freeze, and unfreeze', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const operations = [
      [
        'POST /reverse',
        {
          walletId: 'wallet_1',
          transactionId: 'transaction_1',
          reason: 'incorrect charge',
          supervisorPin: '2468',
        },
      ],
      [
        'POST /top-up',
        {
          walletId: 'wallet_1',
          amountPaise: 10_000,
          reason: 'approved top up',
          idempotencyKey: '2e78bda4-cc72-430d-91bc-28b186cbd50b',
          supervisorPin: '2468',
        },
      ],
      ['POST /freeze', { walletId: 'wallet_1', reason: 'fraud review' }],
      ['POST /unfreeze', { walletId: 'wallet_1' }],
    ] as const;

    for (const [operation, body] of operations) {
      const reply = createReply();
      await handlers.get(operation)(venueRequest('STAFF', body), reply);
      expect(reply.statusCode).toBe(403);
      expect(reply.payload.code).toBe('SUPERVISOR_REQUIRED');
    }

    expect(reverseTransaction).not.toHaveBeenCalled();
    expect(topUpWallet).not.toHaveBeenCalled();
    expect(freezeWallet).not.toHaveBeenCalled();
    expect(unfreezeWallet).not.toHaveBeenCalled();
  });

  it('passes the supervisor PIN and server-derived venue operator to top-up', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const reply = createReply();

    await handlers.get('POST /top-up')(
      venueRequest('MANAGER', {
        walletId: 'wallet_1',
        amountPaise: 10_000,
        reason: 'approved top up',
        idempotencyKey: '2e78bda4-cc72-430d-91bc-28b186cbd50b',
        supervisorPin: '2468',
      }),
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(topUpWallet).toHaveBeenCalledWith({
      walletId: 'wallet_1',
      amountPaise: 10_000,
      reason: 'approved top up',
      idempotencyKey: '2e78bda4-cc72-430d-91bc-28b186cbd50b',
      supervisorPin: '2468',
      operatorId: 'operator_1',
      operatorRole: 'manager',
    });
  });

  it('maps an immutable wallet top-up policy denial to a fail-closed 403', async () => {
    topUpWallet.mockResolvedValueOnce({
      success: false,
      code: 'TOP_UP_POLICY_DENIED',
      message: 'Wallet top-up policy does not authorize role: manager',
    });
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const reply = createReply();

    await handlers.get('POST /top-up')(
      venueRequest('MANAGER', {
        walletId: 'wallet_1',
        amountPaise: 10_000,
        reason: 'approved top up',
        idempotencyKey: '2e78bda4-cc72-430d-91bc-28b186cbd50b',
        supervisorPin: '2468',
      }),
      reply,
    );

    expect(reply.statusCode).toBe(403);
    expect(reply.payload.code).toBe('TOP_UP_POLICY_DENIED');
  });

  it('passes supervisor proof and server-derived authority to an exact reversal', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const reply = createReply();

    await handlers.get('POST /reverse')(
      venueRequest('OWNER', {
        walletId: 'wallet_1',
        transactionId: 'transaction_1',
        reason: 'incorrect item charge',
        supervisorPin: '2468',
      }),
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(reverseTransaction).toHaveBeenCalledWith({
      walletId: 'wallet_1',
      transactionId: 'transaction_1',
      reason: 'incorrect item charge',
      supervisorPin: '2468',
      operatorId: 'operator_1',
      operatorRole: 'owner',
      deviceId: 'supervisor_console',
      eventCodeId: 'supervisor_approval',
    });
  });

  it('executes freeze and unfreeze through the same venue-scoped supervisor boundary', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const freezeReply = createReply();
    const unfreezeReply = createReply();

    await handlers.get('POST /freeze')(
      venueRequest('MANAGER', {
        walletId: 'wallet_1',
        reason: 'fraud review',
      }),
      freezeReply,
    );
    await handlers.get('POST /unfreeze')(
      venueRequest('MANAGER', {
        walletId: 'wallet_1',
        reason: 'review cleared',
      }),
      unfreezeReply,
    );

    expect(freezeReply.statusCode).toBe(200);
    expect(unfreezeReply.statusCode).toBe(200);
    expect(freezeWallet).toHaveBeenCalledWith('wallet_1', 'fraud review', 'operator_1');
    expect(unfreezeWallet).toHaveBeenCalledWith('wallet_1', 'operator_1', 'review cleared');
  });

  it('redacts guest balance and transaction history when the wallet privacy rules disable both', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
      walletTransactions: {
        wallet_1: [{ id: 'transaction_1', type: 'DEBIT', amountPaise: 10_000 }],
      },
    });
    const reply = createReply();

    const result = await handlers.get('GET /wallet/:walletId')(
      {
        headers: {},
        user: { uid: 'guest_1' },
        params: { walletId: 'wallet_1' },
      },
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(result.wallet).not.toHaveProperty('currentBalancePaise');
    expect(result.wallet).not.toHaveProperty('openingBalancePaise');
    expect(result.transactions).toEqual([]);
  });

  it('returns a guest QR only to the current owner and marks it no-store', async () => {
    createCoverWalletQrToken.mockReturnValue({
      token: 'signed-cover-wallet-token',
      expiresAt: new Date(Date.now() + 15_000).toISOString(),
    });
    const { handlers } = await registerRoutes({
      walletDocuments: { wallet_1: venueWallet },
    });
    const ownerReply = createReply();

    const ownerResult = await handlers.get('GET /wallet/:walletId/qr-jwt')(
      {
        headers: {},
        user: { uid: 'guest_1' },
        params: { walletId: 'wallet_1' },
      },
      ownerReply,
    );

    expect(ownerReply.statusCode).toBe(200);
    expect(ownerResult.jwt).toBe('signed-cover-wallet-token');
    expect(ownerReply.headers['cache-control']).toBe('private, no-store');

    const unrelatedReply = createReply();
    await handlers.get('GET /wallet/:walletId/qr-jwt')(
      {
        headers: {},
        user: { uid: 'other_guest' },
        params: { walletId: 'wallet_1' },
      },
      unrelatedReply,
    );
    expect(unrelatedReply.statusCode).toBe(404);
  });

  it('lists every guest wallet while enforcing each wallet transaction-history rule', async () => {
    const { handlers } = await registerRoutes({
      walletDocuments: {
        wallet_1: {
          ...venueWallet,
          issuedAt: '2026-07-20T00:00:00.000Z',
        },
        wallet_2: {
          ...venueWallet,
          orderId: 'order_2',
          issuedAt: '2026-07-21T00:00:00.000Z',
          rules: {
            ...venueWallet.rules,
            showBalanceToGuest: true,
            showTransactionHistory: true,
          },
        },
      },
      walletTransactions: {
        wallet_1: [{ id: 'hidden_txn', type: 'DEBIT', amountPaise: 1_000 }],
        wallet_2: [{ id: 'visible_txn', type: 'DEBIT', amountPaise: 2_000 }],
      },
    });
    const reply = createReply();

    const result = await handlers.get('GET /me')(
      {
        headers: {},
        user: { uid: 'guest_1' },
      },
      reply,
    );

    expect(result.wallets.map((wallet: any) => wallet.id)).toEqual(['wallet_2', 'wallet_1']);
    expect(result.transactionsByWallet.wallet_1).toEqual([]);
    expect(result.transactionsByWallet.wallet_2).toEqual([
      expect.objectContaining({ id: 'visible_txn', amountPaise: 2_000 }),
    ]);
    expect(reply.headers['cache-control']).toBe('private, no-store');
  });
});

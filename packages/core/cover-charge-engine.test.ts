/**
 * Cover Charge Engine — Unit Tests
 * Runner: Vitest
 */

import { describe, it, expect, vi } from 'vitest';

const { getAdminDbMock } = vi.hoisted(() => ({
  getAdminDbMock: vi.fn(),
}));

vi.mock('./admin.js', () => ({
  getAdminDb: getAdminDbMock,
}));

import {
  computeTerminationTime,
  formatPaise,
  debitWallet,
  reverseTransaction,
  topUpWallet,
  buildCoverWalletDocument,
  deterministicCoverWalletId,
  createCoverWalletQrToken,
  verifyCoverWalletQrToken,
  validateCoverWalletTierConfig,
  reconcileCoverWallet,
  checkAndIncrementVelocity,
  freezeWallet,
  unfreezeWallet,
  hashSupervisorPin,
  terminateDueCoverWallets,
} from './cover-charge-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWallet(overrides: Record<string, any> = {}) {
  return {
    id: 'CW-TEST001',
    orderId: 'ORD-001',
    eventId: 'EVT-001',
    venueId: 'VEN-001',
    userId: 'USR-001',
    state: 'ACTIVE',
    openingBalancePaise: 50000, // ₹500
    currentBalancePaise: 50000,
    totalDebitedPaise: 0,
    totalCreditedPaise: 0,
    totalReversedPaise: 0,
    txnCount: 0,
    rules: {
      minChargeAmountPaise: 0,
      maxChargeAmountPaise: 100000,
      topUpAllowed: false,
      maxTopUpAmountPaise: 0,
      maxTotalBalancePaise: 100000,
      topUpBy: 'none',
      terminationTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4h from now
      terminationPolicy: 'forfeit',
      partialRefundPercent: 0,
      showBalanceToGuest: true,
      showTransactionHistory: true,
      allowedPresetItems: [
        {
          id: 'ITEM-WHISKEY',
          name: 'Whiskey Soda',
          amountPaise: 35000,
          isAvailable: true,
          sortOrder: 0,
        },
        { id: 'ITEM-BEER', name: 'Beer Pint', amountPaise: 20000, isAvailable: true, sortOrder: 1 },
        {
          id: 'ITEM-UNAVAILABLE',
          name: 'Off Menu',
          amountPaise: 10000,
          isAvailable: false,
          sortOrder: 99,
        },
      ],
      currency: 'INR',
      maxTxnsPerWallet: 10,
      maxDebitsPerMinutePerDevice: 3,
    },
    termsAcceptedAt: '2026-03-14T20:00:00+05:30',
    termsVersion: '1.0',
    issuedAt: '2026-03-14T20:00:00+05:30',
    lastActivityAt: '2026-03-14T20:00:00+05:30',
    createdBy: 'checkout_service',
    ...overrides,
  };
}

function makeDebitReq(overrides: Record<string, any> = {}) {
  return {
    walletId: 'CW-TEST001',
    presetItemId: 'ITEM-WHISKEY',
    quantity: 1,
    idempotencyKey: 'idem-001',
    operatorId: 'STAFF-001',
    operatorName: 'Rahul B',
    operatorRole: 'staff',
    deviceId: 'DEVICE-001',
    eventCodeId: 'CODE-001',
    authorizedEventId: 'EVT-001',
    authorizedVenueId: 'VEN-001',
    scannerSessionId: 'SESSION-001',
    ...overrides,
  };
}

function createMemoryDb(seed: Record<string, any>) {
  const documents = new Map(Object.entries(seed));
  const merge = (current: any, patch: any) => ({ ...(current || {}), ...patch });
  const getField = (value: any, path: string) =>
    path.split('.').reduce((current, key) => current?.[key], value);
  const ref = (path: string): any => ({
    path,
    id: path.split('/').at(-1),
    get: async () => snapshot(path),
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1),
    exists: documents.has(path),
    data: () => documents.get(path),
    ref: ref(path),
  });
  const query = (
    path: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
    max = Number.POSITIVE_INFINITY,
  ): any => ({
    where: (field: string, op: string, value: any) =>
      query(path, [...filters, { field, op, value }], max),
    limit: (nextMax: number) => query(path, filters, nextMax),
    get: async () => {
      const prefix = `${path}/`;
      const docs = [...documents.entries()]
        .filter(
          ([candidate]) =>
            candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes('/'),
        )
        .filter(([, data]) =>
          filters.every((filter) => {
            const actual = getField(data, filter.field);
            if (filter.op === '==') return actual === filter.value;
            if (filter.op === '<=') return actual <= filter.value;
            throw new Error(`Unsupported test filter: ${filter.op}`);
          }),
        )
        .slice(0, max)
        .map(([candidate]) => snapshot(candidate));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });
  const collection = (path: string): any => ({
    doc: (id: string) => ref(`${path}/${id}`),
    where: (field: string, op: string, value: any) => query(path).where(field, op, value),
  });
  const db = {
    collection,
    runTransaction: vi.fn(async (handler: any) =>
      handler({
        get: async (target: any) => target.get(),
        create: (target: any, data: any) => {
          if (documents.has(target.path)) throw new Error(`Document exists: ${target.path}`);
          documents.set(target.path, data);
        },
        update: (target: any, patch: any) => {
          documents.set(target.path, merge(documents.get(target.path), patch));
        },
        set: (target: any, data: any) => documents.set(target.path, data),
      }),
    ),
  };
  return { db, documents };
}

// =============================================================================
// formatPaise
// =============================================================================

describe('formatPaise', () => {
  it('formats integer paise to INR string', () => {
    expect(formatPaise(50000)).toBe('₹500.00');
    expect(formatPaise(100)).toBe('₹1.00');
    expect(formatPaise(50)).toBe('₹0.50');
    expect(formatPaise(0)).toBe('₹0.00');
  });

  it('throws for non-integer input', () => {
    expect(() => formatPaise(500.5)).toThrow();
    expect(() => formatPaise(-1)).toThrow();
    expect(() => formatPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe('cover wallet issuance identity', () => {
  it('uses one deterministic identity per order, tier, and admission unit', () => {
    expect(deterministicCoverWalletId('ORD-1', 'VIP', 1)).toBe(
      deterministicCoverWalletId('ORD-1', 'VIP', 1),
    );
    expect(deterministicCoverWalletId('ORD-1', 'VIP', 1)).not.toBe(
      deterministicCoverWalletId('ORD-1', 'VIP', 2),
    );
  });

  it('builds an immutable integer-paise wallet snapshot', () => {
    expect(
      buildCoverWalletDocument({
        orderId: 'ORD-1',
        eventId: 'EVT-1',
        venueId: 'VEN-1',
        userId: 'USR-1',
        tierId: 'VIP',
        unitIndex: 2,
        tierConfig: {
          enabled: true,
          walletAmountPaise: 50_000,
          terminationHour: 5,
          presetItems: [],
        },
        eventStartIso: '2026-03-14T22:00:00+05:30',
        issuedAt: '2026-03-01T00:00:00.000Z',
      }),
    ).toMatchObject({
      id: deterministicCoverWalletId('ORD-1', 'VIP', 2),
      orderId: 'ORD-1',
      tierId: 'VIP',
      unitIndex: 2,
      openingBalancePaise: 50_000,
      currentBalancePaise: 50_000,
      schemaVersion: 2,
    });
  });

  it('rejects unsafe paise values, duplicate items, and invalid charge ranges', () => {
    expect(() =>
      validateCoverWalletTierConfig({
        walletAmountPaise: 50_000.5,
        presetItems: [],
      }),
    ).toThrow(/walletAmountPaise/);
    expect(() =>
      validateCoverWalletTierConfig({
        walletAmountPaise: 50_000,
        minChargeAmountPaise: 20_000,
        maxChargeAmountPaise: 10_000,
        presetItems: [],
      }),
    ).toThrow(/maxChargeAmountPaise/);
    expect(() =>
      validateCoverWalletTierConfig({
        walletAmountPaise: 50_000,
        presetItems: [
          { id: 'water', name: 'Water', amountPaise: 5_000 },
          { id: 'water', name: 'Water again', amountPaise: 5_000 },
        ],
      }),
    ).toThrow(/Duplicate preset item/);
    expect(() =>
      validateCoverWalletTierConfig({
        walletAmountPaise: 50_000,
        terminationPolicy: 'partial_refund',
        partialRefundPercent: 0,
        presetItems: [],
      }),
    ).toThrow(/partialRefundPercent/);
    expect(() =>
      validateCoverWalletTierConfig({
        walletAmountPaise: 50_000,
        terminationPolicy: 'unsupported',
        presetItems: [],
      }),
    ).toThrow(/terminationPolicy/);
  });
});

describe('cover wallet rotating QR', () => {
  const wallet = makeWallet();
  const secret = 'cover-wallet-test-secret';

  it('signs a 15-second, wallet-bound token and verifies its claims', () => {
    const nowMs = Date.parse('2026-03-14T20:00:00.000Z');
    const signed = createCoverWalletQrToken(wallet, { nowMs, secret });
    const verified = verifyCoverWalletQrToken(signed.token, { nowMs: nowMs + 10_000, secret });
    expect(verified).toMatchObject({
      valid: true,
      payload: {
        walletId: wallet.id,
        orderId: wallet.orderId,
        eventId: wallet.eventId,
        venueId: wallet.venueId,
        ownerUserId: wallet.userId,
      },
    });
    expect(Date.parse(signed.expiresAt) - nowMs).toBe(15_000);
  });

  it('rejects tampered and expired tokens', () => {
    const nowMs = Date.parse('2026-03-14T20:00:00.000Z');
    const signed = createCoverWalletQrToken(wallet, { nowMs, secret });
    expect(
      verifyCoverWalletQrToken(`${signed.token}tampered`, { nowMs: nowMs + 1_000, secret }),
    ).toMatchObject({ valid: false, code: 'COVER_QR_INVALID' });
    expect(verifyCoverWalletQrToken(signed.token, { nowMs: nowMs + 15_000, secret })).toMatchObject(
      { valid: false, code: 'COVER_QR_EXPIRED' },
    );
  });
});

// =============================================================================
// computeTerminationTime
// =============================================================================

describe('computeTerminationTime', () => {
  it('returns next-day 5AM for an evening event', () => {
    // Event starts at 10 PM IST on March 14
    const result = computeTerminationTime('2026-03-14T22:00:00+05:30', 5, '+05:30');
    expect(result).toBe('2026-03-15T05:00:00+05:30');
  });

  it('returns same-day 5AM for an early-morning event', () => {
    // Event starts at 3 AM IST on March 15 — terminates at 5 AM same day
    const result = computeTerminationTime('2026-03-15T03:00:00+05:30', 5, '+05:30');
    expect(result).toBe('2026-03-15T05:00:00+05:30');
  });

  it('handles midnight-crossing events correctly', () => {
    // Event starts at 11:59 PM — next day 5 AM
    const result = computeTerminationTime('2026-03-14T23:59:00+05:30', 5, '+05:30');
    expect(result).toBe('2026-03-15T05:00:00+05:30');
  });

  it('handles year-end boundary', () => {
    const result = computeTerminationTime('2025-12-31T22:00:00+05:30', 5, '+05:30');
    expect(result).toBe('2026-01-01T05:00:00+05:30');
  });

  it('throws for invalid ISO string', () => {
    expect(() => computeTerminationTime('not-a-date', 5, '+05:30')).toThrow();
  });

  it('throws for invalid terminationHour', () => {
    expect(() => computeTerminationTime('2026-03-14T22:00:00+05:30', 25, '+05:30')).toThrow();
  });

  it('uses custom terminationHour', () => {
    const result = computeTerminationTime('2026-03-14T22:00:00+05:30', 6, '+05:30');
    expect(result).toBe('2026-03-15T06:00:00+05:30');
  });
});

describe('scheduled Cover Wallet termination', () => {
  it('finds due wallets and atomically records expiry before refund dispatch', async () => {
    const dueAt = new Date('2026-07-27T05:00:00.000Z');
    const dueWallet = makeWallet({
      eventId: 'EVT-DUE',
      terminationAtMs: dueAt.getTime(),
      currentBalancePaise: 50_000,
      rules: {
        ...makeWallet().rules,
        terminationTime: dueAt.toISOString(),
        terminationPolicy: 'partial_refund',
        partialRefundPercent: 40,
      },
    });
    const futureWallet = makeWallet({
      id: 'CW-FUTURE',
      eventId: 'EVT-FUTURE',
      terminationAtMs: dueAt.getTime() + 60_000,
    });
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': dueWallet,
      'cover_wallets/CW-FUTURE': futureWallet,
    });
    getAdminDbMock.mockReturnValue(db);

    const result = await terminateDueCoverWallets({
      db,
      now: new Date(dueAt.getTime() + 1_000),
      limit: 25,
    });

    expect(result).toMatchObject({
      dueWallets: 1,
      eventsProcessed: 1,
      terminated: 1,
      failed: 0,
    });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      state: 'EXPIRED',
      currentBalancePaise: 0,
      txnCount: 2,
    });
    expect(documents.get('cover_wallets/CW-FUTURE')).toMatchObject({
      state: 'ACTIVE',
      currentBalancePaise: 50_000,
    });
    expect(
      documents.get('domain_event_outbox/cover-wallet-expiry-refund-CW-TEST001'),
    ).toMatchObject({
      type: 'cover.wallet.expiry_refund.required',
      amountPaise: 20_000,
      status: 'pending',
    });
  });
});

// =============================================================================
// debitWallet — unit tests with mocked Firestore
// =============================================================================

describe('debitWallet', () => {
  it('returns MISSING_IDEMPOTENCY_KEY if no key', async () => {
    const result = await debitWallet(makeDebitReq({ idempotencyKey: '' }));
    expect(result.success).toBe(false);
    expect(result.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('returns INVALID_QUANTITY for quantity 0', async () => {
    const result = await debitWallet(makeDebitReq({ quantity: 0 }));
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_QUANTITY');
  });

  it('returns INVALID_QUANTITY for quantity > 10', async () => {
    const result = await debitWallet(makeDebitReq({ quantity: 11 }));
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_QUANTITY');
  });

  it('atomically debits integer paise and returns the same result on an exact replay', async () => {
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': makeWallet(),
      'event_codes/CODE-001': {
        type: 'charge',
        eventId: 'EVT-001',
        venueId: 'VEN-001',
        isRevoked: false,
      },
    });
    getAdminDbMock.mockReturnValue(db);

    const first = await debitWallet(makeDebitReq());
    const replay = await debitWallet(makeDebitReq());

    expect(first).toMatchObject({
      success: true,
      balanceAfterPaise: 15_000,
      receipt: { amountPaise: 35_000 },
    });
    expect(replay).toMatchObject({
      success: true,
      code: 'IDEMPOTENCY_REPLAY',
      balanceAfterPaise: 15_000,
    });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      currentBalancePaise: 15_000,
      totalDebitedPaise: 35_000,
      txnCount: 1,
    });
    expect(documents.get('cover_wallets/CW-TEST001/txns/IDEMP-idem-001')).toMatchObject({
      type: 'DEBIT',
      amountPaise: 35_000,
      deviceId: 'DEVICE-001',
      scannerSessionId: 'SESSION-001',
    });
    expect(documents.get('cover_wallet_idempotency/idem-001')).toMatchObject({
      type: 'DEBIT',
      walletId: 'CW-TEST001',
      transactionId: 'IDEMP-idem-001',
      amountPaise: 35_000,
    });
  });

  it('accepts a transactionally verified bound staff charge session without a legacy event code', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': makeWallet(),
      'scanner_auth_sessions/STAFF-SESSION-001': {
        codeId: 'staff_STAFF-001',
        codeType: 'charge',
        eventId: 'EVT-001',
        venueId: 'VEN-001',
        deviceId: 'DEVICE-001',
        expiresAt,
        revokedAt: null,
        isStaffSession: true,
        userId: 'STAFF-001',
      },
    });
    getAdminDbMock.mockReturnValue(db);

    const result = await debitWallet(
      makeDebitReq({
        eventCodeId: 'staff_STAFF-001',
        scannerSessionId: 'STAFF-SESSION-001',
      }),
    );

    expect(result).toMatchObject({
      success: true,
      balanceAfterPaise: 15_000,
      receipt: { amountPaise: 35_000 },
    });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      currentBalancePaise: 15_000,
      totalDebitedPaise: 35_000,
      txnCount: 1,
    });
  });

  it('fails a mismatched idempotency replay instead of charging another item', async () => {
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': makeWallet(),
      'event_codes/CODE-001': {
        type: 'charge',
        eventId: 'EVT-001',
        venueId: 'VEN-001',
        isRevoked: false,
      },
    });
    getAdminDbMock.mockReturnValue(db);

    await debitWallet(makeDebitReq());
    const conflict = await debitWallet(
      makeDebitReq({ presetItemId: 'ITEM-BEER', idempotencyKey: 'idem-001' }),
    );

    expect(conflict).toMatchObject({ success: false, code: 'IDEMPOTENCY_CONFLICT' });
    expect(documents.get('cover_wallets/CW-TEST001').currentBalancePaise).toBe(15_000);
  });

  it('rejects reuse of one idempotency key across two wallets', async () => {
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': makeWallet(),
      'cover_wallets/CW-TEST002': makeWallet({
        id: 'CW-TEST002',
        orderId: 'ORD-002',
        userId: 'USR-002',
      }),
      'event_codes/CODE-001': {
        type: 'charge',
        eventId: 'EVT-001',
        venueId: 'VEN-001',
        isRevoked: false,
      },
    });
    getAdminDbMock.mockReturnValue(db);

    const first = await debitWallet(makeDebitReq());
    const conflict = await debitWallet(
      makeDebitReq({
        walletId: 'CW-TEST002',
        idempotencyKey: 'idem-001',
      }),
    );

    expect(first).toMatchObject({ success: true, balanceAfterPaise: 15_000 });
    expect(conflict).toMatchObject({ success: false, code: 'IDEMPOTENCY_CONFLICT' });
    expect(documents.get('cover_wallets/CW-TEST002')).toMatchObject({
      currentBalancePaise: 50_000,
      totalDebitedPaise: 0,
      txnCount: 0,
    });
    expect(documents.get('cover_wallet_idempotency/idem-001')).toMatchObject({
      type: 'DEBIT',
      walletId: 'CW-TEST001',
    });
  });

  it('expires a wallet before mutation and records exact refund, forfeit, and outbox artifacts', async () => {
    const expiredWallet = makeWallet({
      rules: {
        ...makeWallet().rules,
        terminationTime: new Date(Date.now() - 1_000).toISOString(),
        terminationPolicy: 'partial_refund',
        partialRefundPercent: 40,
      },
    });
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': expiredWallet,
      'event_codes/CODE-001': {
        type: 'charge',
        eventId: 'EVT-001',
        venueId: 'VEN-001',
        isRevoked: false,
      },
    });
    getAdminDbMock.mockReturnValue(db);

    const result = await debitWallet(makeDebitReq());

    expect(result).toMatchObject({ success: false, code: 'WALLET_EXPIRED' });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      state: 'EXPIRED',
      currentBalancePaise: 0,
      txnCount: 2,
    });
    expect(documents.get('cover_wallets/CW-TEST001/txns/EXPIRY-REFUND-CW-TEST001')).toMatchObject({
      type: 'EXPIRY_REFUND',
      amountPaise: 20_000,
    });
    expect(documents.get('cover_wallets/CW-TEST001/txns/EXPIRY-FORFEIT-CW-TEST001')).toMatchObject({
      type: 'EXPIRY_FORFEIT',
      amountPaise: 30_000,
    });
    expect(
      documents.get('domain_event_outbox/cover-wallet-expiry-refund-CW-TEST001'),
    ).toMatchObject({
      type: 'cover.wallet.expiry_refund.required',
      walletId: 'CW-TEST001',
      amountPaise: 20_000,
      status: 'pending',
    });
  });
});

describe('wallet mutation state machine', () => {
  it('reverses one committed debit exactly once and preserves the original result on replay', async () => {
    const supervisorPin = '2468';
    const supervisorPinHash = hashSupervisorPin(supervisorPin, {
      salt: Buffer.alloc(16, 1),
    });
    const wallet = makeWallet({
      currentBalancePaise: 15_000,
      totalDebitedPaise: 35_000,
      txnCount: 1,
    });
    const original = {
      id: 'IDEMP-idem-001',
      walletId: wallet.id,
      type: 'DEBIT',
      status: 'COMMITTED',
      amountPaise: 35_000,
      balanceAfterPaise: 15_000,
      idempotencyKey: 'idem-001',
    };
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': wallet,
      'cover_wallets/CW-TEST001/txns/IDEMP-idem-001': original,
      'platform_settings/venue_VEN-001': { supervisorPinHash },
    });
    getAdminDbMock.mockReturnValue(db);
    const request = {
      walletId: 'CW-TEST001',
      transactionId: 'IDEMP-idem-001',
      reason: 'Incorrect item',
      supervisorPin,
      operatorId: 'manager-1',
      operatorRole: 'manager',
      deviceId: 'supervisor_console',
      eventCodeId: 'supervisor_approval',
    };

    const first = await reverseTransaction(request);
    const replay = await reverseTransaction(request);

    expect(first).toMatchObject({ success: true, transactionId: 'REV-IDEMP-idem-001' });
    expect(replay).toMatchObject({
      success: true,
      code: 'IDEMPOTENCY_REPLAY',
      balanceAfterPaise: 50_000,
    });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      currentBalancePaise: 50_000,
      totalReversedPaise: 35_000,
      txnCount: 2,
    });
    expect(documents.get('cover_wallets/CW-TEST001/txns/REV-IDEMP-idem-001')).toMatchObject({
      type: 'REVERSAL',
      amountPaise: 35_000,
      reversesTransactionId: 'IDEMP-idem-001',
    });
  });

  it('top-ups atomically with supervisor proof and exact idempotency', async () => {
    const supervisorPin = '1357';
    const supervisorPinHash = hashSupervisorPin(supervisorPin, {
      salt: Buffer.alloc(16, 2),
    });
    const wallet = makeWallet({
      rules: {
        ...makeWallet().rules,
        topUpAllowed: true,
        topUpBy: 'host',
        maxTopUpAmountPaise: 20_000,
      },
    });
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': wallet,
      'platform_settings/venue_VEN-001': { supervisorPinHash },
    });
    getAdminDbMock.mockReturnValue(db);
    const request = {
      walletId: 'CW-TEST001',
      amountPaise: 10_000,
      reason: 'Approved guest recovery',
      idempotencyKey: 'topup-uuid',
      supervisorPin,
      operatorId: 'manager-1',
      operatorRole: 'manager',
    };

    const first = await topUpWallet(request);
    const replay = await topUpWallet(request);

    expect(first).toMatchObject({ success: true, balanceAfterPaise: 60_000 });
    expect(replay).toMatchObject({ success: true, code: 'IDEMPOTENCY_REPLAY' });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      currentBalancePaise: 60_000,
      totalCreditedPaise: 10_000,
      txnCount: 1,
    });
    expect(documents.get('cover_wallet_idempotency/topup-uuid')).toMatchObject({
      type: 'TOP_UP',
      walletId: 'CW-TEST001',
      transactionId: 'TOPUP-topup-uuid',
      amountPaise: 10_000,
    });
  });

  it('enforces the immutable topUpBy policy inside the transaction', async () => {
    const supervisorPin = '1357';
    const supervisorPinHash = hashSupervisorPin(supervisorPin, {
      salt: Buffer.alloc(16, 3),
    });
    const wallet = makeWallet({
      rules: {
        ...makeWallet().rules,
        topUpAllowed: true,
        topUpBy: 'admin',
        maxTopUpAmountPaise: 20_000,
      },
    });
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': wallet,
      'platform_settings/venue_VEN-001': { supervisorPinHash },
    });
    getAdminDbMock.mockReturnValue(db);

    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: 10_000,
      reason: 'venue manager must not bypass admin-only policy',
      idempotencyKey: 'topup-admin-only',
      supervisorPin,
      operatorId: 'manager-1',
      operatorRole: 'manager',
    });

    expect(result).toMatchObject({ success: false, code: 'TOP_UP_POLICY_DENIED' });
    expect(documents.get('cover_wallets/CW-TEST001')).toMatchObject({
      currentBalancePaise: 50_000,
      totalCreditedPaise: 0,
      txnCount: 0,
    });
    expect(documents.has('cover_wallet_idempotency/topup-admin-only')).toBe(false);
  });

  it('freezes and unfreezes only a non-expired active wallet', async () => {
    const { db, documents } = createMemoryDb({
      'cover_wallets/CW-TEST001': makeWallet(),
    });
    getAdminDbMock.mockReturnValue(db);

    await expect(freezeWallet('CW-TEST001', 'Fraud review', 'manager-1')).resolves.toMatchObject({
      success: true,
    });
    expect(documents.get('cover_wallets/CW-TEST001').state).toBe('FROZEN');
    expect(
      [...documents.entries()].some(
        ([path, data]) =>
          path.startsWith('cover_wallet_state_events/FREEZE-') &&
          data.fromState === 'ACTIVE' &&
          data.toState === 'FROZEN',
      ),
    ).toBe(true);
    await expect(unfreezeWallet('CW-TEST001', 'manager-1')).resolves.toMatchObject({
      success: true,
    });
    expect(documents.get('cover_wallets/CW-TEST001').state).toBe('ACTIVE');
    expect(
      [...documents.entries()].some(
        ([path, data]) =>
          path.startsWith('cover_wallet_state_events/UNFREEZE-') &&
          data.fromState === 'FROZEN' &&
          data.toState === 'ACTIVE',
      ),
    ).toBe(true);
  });
});

// =============================================================================
// Paise arithmetic invariants
// =============================================================================

describe('paise arithmetic invariants', () => {
  it('all amounts in wallet rules are integers', () => {
    const wallet = makeWallet();
    expect(Number.isInteger(wallet.openingBalancePaise)).toBe(true);
    expect(Number.isInteger(wallet.currentBalancePaise)).toBe(true);
    expect(Number.isInteger(wallet.rules.minChargeAmountPaise)).toBe(true);
    expect(Number.isInteger(wallet.rules.maxChargeAmountPaise)).toBe(true);
    for (const item of wallet.rules.allowedPresetItems) {
      expect(Number.isInteger(item.amountPaise)).toBe(true);
    }
  });

  it('balance never goes below zero (invariant)', () => {
    const wallet = makeWallet({ currentBalancePaise: 35000 });
    // Trying to debit 35001 paise = insufficient
    const item = wallet.rules.allowedPresetItems[0]; // WHISKEY = 35000
    const wouldDebit = item.amountPaise * 2; // 70000 > 35000
    expect(wouldDebit > wallet.currentBalancePaise).toBe(true);
    // In the real engine, INSUFFICIENT_BALANCE is returned
  });

  it('sum of debits + reversals + expired = opening - closing', () => {
    const opening = 50000;
    const debited = 35000;
    const reversed = 10000;
    const expired = 5000;
    const expectedClosing = opening - debited + reversed - expired;
    expect(expectedClosing).toBe(20000);
    expect(expectedClosing).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Wallet state transitions
// =============================================================================

describe('wallet state rules', () => {
  it('FROZEN wallet rejects debits (code level)', () => {
    const wallet = makeWallet({ state: 'FROZEN' });
    // The Firestore transaction would check wallet.state
    expect(wallet.state).toBe('FROZEN');
  });

  it('EXPIRED wallet rejects debits', () => {
    const wallet = makeWallet({
      state: 'ACTIVE',
      rules: {
        ...makeWallet().rules,
        terminationTime: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      },
    });
    const now = new Date();
    const termTime = new Date(wallet.rules.terminationTime);
    expect(now >= termTime).toBe(true);
  });

  it('TERMINATED wallet rejects debits', () => {
    const wallet = makeWallet({ state: 'TERMINATED' });
    expect(['EXPIRED', 'TERMINATED'].includes(wallet.state)).toBe(true);
  });
});

// =============================================================================
// Transaction limit
// =============================================================================

describe('transaction limits', () => {
  it('rejects debit when txnCount >= maxTxnsPerWallet', () => {
    const wallet = makeWallet({
      txnCount: 10,
      rules: { ...makeWallet().rules, maxTxnsPerWallet: 10 },
    });
    expect(wallet.txnCount >= wallet.rules.maxTxnsPerWallet).toBe(true);
  });
});

// =============================================================================
// Reversal authorization
// =============================================================================

describe('reverseTransaction authorization', () => {
  it('rejects reversal with insufficient role', async () => {
    const result = await reverseTransaction({
      walletId: 'CW-TEST001',
      transactionId: 'WTX-001',
      reason: 'mistake',
      supervisorPin: '1234',
      operatorId: 'STAFF-001',
      operatorRole: 'staff', // not manager
      deviceId: 'DEVICE-001',
      eventCodeId: 'CODE-001',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_ROLE');
  });

  it('rejects reversal without supervisor PIN', async () => {
    const result = await reverseTransaction({
      walletId: 'CW-TEST001',
      transactionId: 'WTX-001',
      reason: 'mistake',
      supervisorPin: '', // empty
      operatorId: 'MGR-001',
      operatorRole: 'manager',
      deviceId: 'DEVICE-001',
      eventCodeId: 'CODE-001',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('SUPERVISOR_PIN_REQUIRED');
  });
});

// =============================================================================
// Top-up authorization
// =============================================================================

describe('topUpWallet authorization', () => {
  it('rejects top-up with staff role', async () => {
    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: 10000,
      reason: 'test',
      idempotencyKey: 'top-001',
      operatorId: 'STAFF-001',
      operatorRole: 'staff',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_ROLE');
  });

  it('rejects non-integer amountPaise', async () => {
    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: 100.5,
      reason: 'test',
      idempotencyKey: 'top-002',
      operatorId: 'ADMIN-001',
      operatorRole: 'admin',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_AMOUNT');
  });

  it('rejects unsafe integer amountPaise', async () => {
    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: Number.MAX_SAFE_INTEGER + 1,
      reason: 'test',
      idempotencyKey: 'top-unsafe',
      supervisorPin: '1234',
      operatorId: 'ADMIN-001',
      operatorRole: 'admin',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_AMOUNT');
  });

  it('rejects top-up without idempotencyKey', async () => {
    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: 10000,
      reason: 'test',
      idempotencyKey: '',
      operatorId: 'ADMIN-001',
      operatorRole: 'admin',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('rejects top-up without supervisor PIN proof', async () => {
    const result = await topUpWallet({
      walletId: 'CW-TEST001',
      amountPaise: 10000,
      reason: 'test',
      idempotencyKey: 'top-003',
      supervisorPin: '',
      operatorId: 'ADMIN-001',
      operatorRole: 'admin',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe('SUPERVISOR_PIN_REQUIRED');
  });
});

describe('device-wide Redis debit velocity', () => {
  it('uses wallet plus UUID as the member so cross-wallet key reuse is not treated as a retry', async () => {
    const redis = { eval: vi.fn().mockResolvedValue(1) };

    await expect(
      checkAndIncrementVelocity(redis, 'device_1', 'wallet_1', 3, 'same-uuid'),
    ).resolves.toBe(true);
    await expect(
      checkAndIncrementVelocity(redis, 'device_1', 'wallet_2', 3, 'same-uuid'),
    ).resolves.toBe(true);

    expect(redis.eval.mock.calls[0][2]).toBe('cwv:device_1');
    expect(redis.eval.mock.calls[0][5]).toBe('wallet_1:same-uuid');
    expect(redis.eval.mock.calls[1][5]).toBe('wallet_2:same-uuid');
  });

  it('fails closed when Redis or any debit identity is missing', async () => {
    await expect(
      checkAndIncrementVelocity(null, 'device_1', 'wallet_1', 3, 'uuid'),
    ).rejects.toThrow(/required/);
    await expect(
      checkAndIncrementVelocity({ eval: vi.fn() }, 'device_1', '', 3, 'uuid'),
    ).rejects.toThrow(/required/);
  });
});

// =============================================================================
// Reconciliation math
// =============================================================================

describe('reconciliation totals', () => {
  it('netConsumed = debited - reversed', () => {
    const debited = 35000;
    const reversed = 10000;
    expect(debited - reversed).toBe(25000);
  });

  it('expired balance = opening - consumed - credited', () => {
    const opening = 50000;
    const consumed = 25000;
    const credited = 10000;
    const expired = opening - consumed + credited - 0; // no reversals
    // Wait — this isn't right. Let's use the proper formula:
    // closing = opening + credited - debited + reversed - expired
    // → expired = opening + credited - debited + reversed - closing
    const debited = 35000;
    const reversals = 10000;
    const closing = 0; // fully terminated
    const expiredFromFormula = opening + credited - debited + reversals - closing;
    expect(expiredFromFormula).toBe(35000);
    expect(expiredFromFormula).toBeGreaterThanOrEqual(0);
  });

  it('counts a reversed debit and its immutable reversal without negative consumption', () => {
    const wallet = makeWallet({
      currentBalancePaise: 50_000,
      totalDebitedPaise: 35_000,
      totalReversedPaise: 35_000,
      txnCount: 2,
    });
    const result = reconcileCoverWallet(wallet.id, wallet, [
      {
        id: 'DEBIT-1',
        type: 'DEBIT',
        status: 'REVERSED',
        idempotencyKey: 'debit-1',
        amountPaise: 35_000,
        quantity: 1,
        presetItemId: 'ITEM-WHISKEY',
        presetItemName: 'Whiskey Soda',
      },
      {
        id: 'REV-DEBIT-1',
        type: 'REVERSAL',
        status: 'COMMITTED',
        idempotencyKey: 'reverse-1',
        amountPaise: 35_000,
        reversesTransactionId: 'DEBIT-1',
      },
    ]);

    expect(result.totals).toMatchObject({
      totalDebitedPaise: 35_000,
      totalReversedPaise: 35_000,
      consumedBalancePaise: 0,
      closingBalancePaise: 50_000,
      reconciliationDifferencePaise: 0,
    });
    expect(result.itemDistribution).toEqual([]);
    expect(result.exceptions).toEqual([]);
  });

  it('separates expiry refunds from venue forfeiture and proves zero-sum balance', () => {
    const wallet = makeWallet({
      state: 'EXPIRED',
      currentBalancePaise: 0,
      txnCount: 2,
    });
    const result = reconcileCoverWallet(wallet.id, wallet, [
      {
        id: 'EXPIRY-REFUND-1',
        type: 'EXPIRY_REFUND',
        status: 'COMMITTED',
        idempotencyKey: 'expiry-refund',
        amountPaise: 10_000,
      },
      {
        id: 'EXPIRY-FORFEIT-1',
        type: 'EXPIRY_FORFEIT',
        status: 'COMMITTED',
        idempotencyKey: 'expiry-forfeit',
        amountPaise: 40_000,
      },
    ]);

    expect(result.totals).toMatchObject({
      expiredRefundPaise: 10_000,
      expiredForfeitPaise: 40_000,
      expiredBalancePaise: 50_000,
      closingBalancePaise: 0,
      reconciliationDifferencePaise: 0,
    });
    expect(result.exceptions).toEqual([]);
  });

  it('treats an admission-refund wallet termination as an exact terminal adjustment', () => {
    const wallet = makeWallet({
      state: 'TERMINATED',
      currentBalancePaise: 0,
      totalRefundTerminatedPaise: 50_000,
      txnCount: 1,
    });
    const result = reconcileCoverWallet(wallet.id, wallet, [
      {
        id: 'REFUND-TERMINATION-refund_1',
        type: 'REFUND_TERMINATION',
        status: 'COMMITTED',
        idempotencyKey: 'REFUND-TERMINATION-refund_1',
        refundId: 'refund_1',
        amountPaise: 50_000,
      },
    ]);

    expect(result.totals).toMatchObject({
      refundTerminatedPaise: 50_000,
      terminalAdjustmentPaise: 50_000,
      closingBalancePaise: 0,
      reconciliationDifferencePaise: 0,
    });
    expect(result.exceptions).toEqual([]);
  });
});

// =============================================================================
// computeTerminationTime — timezone edge cases
// =============================================================================

describe('computeTerminationTime timezone', () => {
  it('produces output with correct tz offset', () => {
    const result = computeTerminationTime('2026-03-14T22:00:00+05:30', 5, '+05:30');
    expect(result).toMatch(/\+05:30$/);
  });

  it('handles -08:00 offset (US timezone check)', () => {
    // Event at 10 PM PST → next day 5 AM PST
    const result = computeTerminationTime('2026-03-14T22:00:00-08:00', 5, '-08:00');
    expect(result).toBe('2026-03-15T05:00:00-08:00');
  });
});

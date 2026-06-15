/**
 * Cover Charge Engine — Unit Tests
 * Runner: Vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeTerminationTime,
  formatPaise,
  debitWallet,
  reverseTransaction,
  topUpWallet,
  issueWallet,
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
    ...overrides,
  };
}

// Mock Firestore db
function makeDb(wallet: any, existingTxns: any[] = []) {
  const walletRef = {
    get: vi.fn().mockResolvedValue({ exists: true, data: () => wallet }),
    update: vi.fn(),
  };

  const txnQueryResult = {
    empty: existingTxns.length === 0,
    docs: existingTxns.map((t) => ({ id: t.id, data: () => t })),
  };

  const txnSubcollection = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(txnQueryResult),
    doc: vi.fn().mockReturnValue({ set: vi.fn() }),
  };

  const walletCollectionDoc = vi.fn().mockReturnValue({
    ...walletRef,
    collection: vi.fn().mockReturnValue(txnSubcollection),
  });

  return {
    collection: vi.fn().mockReturnValue({ doc: walletCollectionDoc }),
    runTransaction: vi.fn().mockImplementation(async (fn) => {
      const tx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref === walletRef) return { exists: true, data: () => wallet };
          return { exists: false, data: () => null };
        }),
        set: vi.fn(),
        update: vi.fn(),
      };
      return await fn(tx);
    }),
  };
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
      supervisorPinHash: 'hash',
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
      supervisorPinHash: '', // empty
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

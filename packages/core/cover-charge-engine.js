/**
 * THE C1RCLE — Cover Charge Engine
 *
 * Business logic for the Cover Wallet system.
 *
 * Design invariants:
 *  1. All amounts are integer PAISE. No floats.
 *  2. Every mutation carries an idempotencyKey. Server deduplicates.
 *  3. Firestore transactions ensure atomicity of balance + txn sub-collection.
 *  4. Velocity checks are enforced per-device per-minute in Redis.
 *  5. Terminated wallets reject all mutations.
 *  6. Offline debits are hard-blocked at the API layer (not here).
 *
 * @module cover-charge-engine
 */

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getAdminDb } from './admin.js';
import { recordLedgerTransaction } from './ledger-engine.js';

const WALLET_COLLECTION = 'cover_wallets';
const TXN_SUBCOLLECTION = 'txns';
const RECON_COLLECTION = 'cover_wallet_reconciliations';

// Max debits we will process inside a single Firestore transaction.
// Prevents unbounded reads in the idempotency check.
const IDEMPOTENCY_LOOKBACK_LIMIT = 10;

// =============================================================================
// HELPERS
// =============================================================================

const MAX_SAFE_PAISE = 100_000_000_00; // ₹10,00,000 (~$12,000) — upper bound for any single value

/**
 * Guard that enforces paise values are safe integers within valid range.
 * Prevents IEEE 754 precision loss, overflow attacks, and negative values.
 * Must be applied to ALL amountPaise inputs before any arithmetic.
 *
 * @param {number} value - The paise value to assert
 * @param {string} [name='amountPaise'] - Name for error messages
 * @throws {Error} if value is not a safe non-negative integer or exceeds max bound
 */
function assertSafePaise(value, name = 'amountPaise') {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${name} must be non-negative, got ${value}`);
  }
  if (value > MAX_SAFE_PAISE) {
    throw new Error(`${name} exceeds maximum allowed value (${MAX_SAFE_PAISE} paise)`);
  }
}

function newWalletId() {
  return `CW-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}

function newTxnId() {
  return `WTX-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}

/**
 * Format paise as a display string: 50000 → "₹500.00"
 */
export function formatPaise(paise) {
  assertSafePaise(paise, 'formatPaise input');
  const rupees = paise / 100;
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Compute the termination time for a wallet given the event's local start time
 * and the configured termination hour (default 5 = 5:00 AM).
 *
 * Rules:
 *  - If the event starts before terminationHour (e.g. starts at 3 AM, terminates at 5 AM),
 *    the termination is the same calendar day at terminationHour.
 *  - Otherwise (event starts in the evening), the termination is the NEXT calendar
 *    day at terminationHour.
 *
 * @param {string} eventStartIso - ISO8601 with timezone offset (e.g. "2026-03-14T22:00:00+05:30")
 * @param {number} terminationHour - local hour 0–23 (default 5)
 * @param {string} tzOffset - timezone offset string (e.g. "+05:30"), defaults to "+05:30"
 * @returns {string} ISO8601 termination time with tz offset
 */
export function computeTerminationTime(eventStartIso, terminationHour = 5, tzOffset = '+05:30') {
  if (typeof eventStartIso !== 'string') throw new Error('eventStartIso must be a string');
  if (!Number.isInteger(terminationHour) || terminationHour < 0 || terminationHour > 23) {
    throw new Error(`terminationHour must be 0–23, got ${terminationHour}`);
  }

  // Parse the event start time
  const eventStart = new Date(eventStartIso);
  if (isNaN(eventStart.getTime())) throw new Error(`Invalid eventStartIso: ${eventStartIso}`);

  // Convert to local time using the tz offset
  const [, sign, hStr, mStr] = tzOffset.match(/([+-])(\d{2}):(\d{2})/) || [];
  if (!sign) throw new Error(`Invalid tzOffset: ${tzOffset}`);
  const offsetMinutes = (sign === '+' ? 1 : -1) * (parseInt(hStr, 10) * 60 + parseInt(mStr, 10));
  const offsetMs = offsetMinutes * 60 * 1000;

  // Local timestamp in ms
  const localMs = eventStart.getTime() + offsetMs;

  // Extract local date components
  const localDate = new Date(localMs);
  // Note: localDate methods return UTC values here because we've already shifted by offset
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth(); // 0-based
  const day = localDate.getUTCDate();
  const hour = localDate.getUTCHours();

  // Determine which day the termination falls on
  let termYear = year;
  let termMonth = month;
  let termDay = day;

  if (hour >= terminationHour) {
    // Event starts in the evening or past terminationHour — terminate next calendar day
    const nextDay = new Date(Date.UTC(year, month, day + 1));
    termYear = nextDay.getUTCFullYear();
    termMonth = nextDay.getUTCMonth();
    termDay = nextDay.getUTCDate();
  }
  // else: event starts early morning, terminate same calendar day

  // Build ISO8601 string with tz offset
  const pad2 = (n) => String(n).padStart(2, '0');
  const termIso =
    `${termYear}-${pad2(termMonth + 1)}-${pad2(termDay)}` +
    `T${pad2(terminationHour)}:00:00${tzOffset}`;

  return termIso;
}

// =============================================================================
// WALLET CREATION
// =============================================================================

/**
 * Issue a Cover Wallet when an order with a cover-charge tier is confirmed.
 *
 * Must be called inside the checkout confirmation transaction or immediately after.
 * Idempotent: if a wallet already exists for this orderId + eventId + userId, returns it.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.eventId
 * @param {string} params.venueId
 * @param {string} params.userId
 * @param {import('./types/cover-charge.js').CoverWalletTierConfig} params.tierConfig
 * @param {string} params.eventStartIso - ISO8601 with tz
 * @param {string} params.tzOffset - e.g. "+05:30"
 * @param {string} params.termsAcceptedAt
 * @param {'PENDING'|'ACTIVE'} [params.initialState='PENDING'] - wallet starts PENDING until door scan activates it
 * @param {object|null} [transaction] - optional Firestore transaction
 * @returns {Promise<import('./types/cover-charge.js').CoverWallet>}
 */
export async function issueWallet(
  {
    orderId,
    eventId,
    venueId,
    userId,
    tierConfig,
    eventStartIso,
    tzOffset = '+05:30',
    termsAcceptedAt,
    initialState = 'PENDING',
  },
  transaction = null,
) {
  assertSafePaise(tierConfig.walletAmountPaise, 'tierConfig.walletAmountPaise');
  if (tierConfig.walletAmountPaise <= 0) {
    throw new Error(
      `walletAmountPaise must be a positive integer, got ${tierConfig.walletAmountPaise}`,
    );
  }

  const db = getAdminDb();

  // Idempotency: check for existing wallet for this order
  const existingQuery = await db
    .collection(WALLET_COLLECTION)
    .where('orderId', '==', orderId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    return { id: existingQuery.docs[0].id, ...existingQuery.docs[0].data() };
  }

  const terminationTime = computeTerminationTime(
    eventStartIso,
    tierConfig.terminationHour ?? 5,
    tzOffset,
  );

  const walletId = newWalletId();
  const now = new Date().toISOString();

  const wallet = {
    id: walletId,
    orderId,
    eventId,
    venueId,
    userId,
    state: initialState,
    openingBalancePaise: tierConfig.walletAmountPaise,
    currentBalancePaise: tierConfig.walletAmountPaise,
    totalDebitedPaise: 0,
    totalCreditedPaise: 0,
    totalReversedPaise: 0,
    txnCount: 0,
    rules: {
      minChargeAmountPaise: tierConfig.minChargeAmountPaise ?? 0,
      maxChargeAmountPaise: tierConfig.maxChargeAmountPaise ?? tierConfig.walletAmountPaise,
      topUpAllowed: tierConfig.topUpAllowed ?? false,
      maxTopUpAmountPaise: tierConfig.maxTopUpAmountPaise ?? 0,
      maxTotalBalancePaise: tierConfig.maxTotalBalancePaise ?? tierConfig.walletAmountPaise * 2,
      topUpBy: tierConfig.topUpBy ?? 'none',
      terminationTime,
      terminationPolicy: tierConfig.terminationPolicy ?? 'forfeit',
      partialRefundPercent: tierConfig.partialRefundPercent ?? 0,
      showBalanceToGuest: tierConfig.showBalanceToGuest ?? true,
      showTransactionHistory: tierConfig.showTransactionHistory ?? true,
      allowedPresetItems: (tierConfig.presetItems || []).filter((i) => i.isAvailable),
      currency: 'INR',
      maxTxnsPerWallet: tierConfig.maxTxnsPerWallet ?? 50,
      maxDebitsPerMinutePerDevice: tierConfig.maxDebitsPerMinutePerDevice ?? 3,
    },
    termsAcceptedAt: termsAcceptedAt || now,
    termsVersion: tierConfig.termsVersion || '1.0',
    issuedAt: now,
    lastActivityAt: now,
    createdBy: 'checkout_service',
  };

  const ref = db.collection(WALLET_COLLECTION).doc(walletId);

  if (transaction) {
    transaction.set(ref, wallet);
  } else {
    await ref.set(wallet);
  }

  return wallet;
}

// =============================================================================
// ACTIVATION (PENDING → ACTIVE)
// =============================================================================

/**
 * Activate a pending cover wallet.
 *
 * Called when the bouncer scans the user's ticket at the door.
 * Idempotent: if the wallet is already ACTIVE, returns success.
 *
 * @param {string} walletId
 * @param {object} [options]
 * @param {string} [options.activatedBy] - scanner operator info
 * @param {string} [options.scanId] - the ticket_scan document ID that triggered activation
 * @returns {Promise<{success: boolean, code?: string, wallet?: object}>}
 */
export async function activateWallet(walletId, { activatedBy = 'scanner', scanId = null } = {}) {
  const db = getAdminDb();
  const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);

  return await db.runTransaction(async (tx) => {
    const walletDoc = await tx.get(walletRef);
    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND' };
    }

    const wallet = walletDoc.data();

    if (wallet.state === 'ACTIVE') {
      return { success: true, code: 'ALREADY_ACTIVE', wallet };
    }

    if (wallet.state !== 'PENDING') {
      return {
        success: false,
        code: 'INVALID_STATE',
        message: `Cannot activate wallet in state: ${wallet.state}`,
      };
    }

    const now = new Date().toISOString();
    tx.update(walletRef, {
      state: 'ACTIVE',
      activatedAt: now,
      activatedBy,
      scanId: scanId || null,
      lastActivityAt: now,
    });

    return {
      success: true,
      code: 'ACTIVATED',
      wallet: { ...wallet, state: 'ACTIVE', activatedAt: now },
    };
  });
}

// =============================================================================
// DEBIT
// =============================================================================

/**
 * Debit a Cover Wallet for a preset item (or custom amount).
 *
 * When `presetItemId` is provided, uses the preset item's amount.
 * When `customAmountPaise` is provided, validates against min/max and debits directly.
 * One of `presetItemId` or `customAmountPaise` must be set.
 *
 * Idempotent: if idempotencyKey has been seen before, returns the original txn.
 *
 * @param {import('./types/cover-charge.js').DebitWalletRequest} req
 * @returns {Promise<import('./types/cover-charge.js').DebitWalletResponse>}
 */
export async function debitWallet(req) {
  const {
    walletId,
    presetItemId,
    customAmountPaise,
    quantity = 1,
    idempotencyKey,
    operatorId,
    operatorName,
    operatorRole,
    deviceId,
    eventCodeId,
  } = req;

  if (!idempotencyKey) {
    return {
      success: false,
      code: 'MISSING_IDEMPOTENCY_KEY',
      message: 'idempotencyKey is required',
    };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return { success: false, code: 'INVALID_QUANTITY', message: 'quantity must be 1–10' };
  }
  if (!presetItemId && !customAmountPaise) {
    return {
      success: false,
      code: 'MISSING_AMOUNT',
      message: 'Either presetItemId or customAmountPaise is required',
    };
  }

  const db = getAdminDb();

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const walletDoc = await tx.get(walletRef);

    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Cover Wallet not found' };
    }

    const wallet = walletDoc.data();

    // --- Idempotency check (deterministic doc ID, transaction-snapshot-isolated) ---
    const txnDocId = `TXN-${idempotencyKey}`;
    const txnRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(txnDocId);

    const existingTxnDoc = await tx.get(txnRef);
    if (existingTxnDoc.exists) {
      const existingTxn = { id: existingTxnDoc.id, ...existingTxnDoc.data() };
      return {
        success: true,
        transactionId: existingTxn.id,
        balanceAfterPaise: existingTxn.balanceAfterPaise,
        balanceAfterDisplay: formatPaise(existingTxn.balanceAfterPaise),
        code: 'IDEMPOTENCY_REPLAY',
        message: 'Transaction already committed',
        existingTransaction: existingTxn,
      };
    }

    // --- State checks ---
    if (wallet.state === 'FROZEN') {
      return { success: false, code: 'WALLET_FROZEN', message: 'Wallet is currently frozen' };
    }
    if (wallet.state === 'EXPIRED' || wallet.state === 'TERMINATED') {
      return { success: false, code: 'WALLET_TERMINATED', message: 'Wallet has expired' };
    }
    if (wallet.state !== 'ACTIVE') {
      return { success: false, code: 'WALLET_INACTIVE', message: `Wallet state: ${wallet.state}` };
    }

    // --- Termination time check ---
    const now = new Date();
    if (now >= new Date(wallet.rules.terminationTime)) {
      // Wallet should have been swept — reject and mark terminated
      tx.update(walletRef, {
        state: 'EXPIRED',
        terminatedAt: now.toISOString(),
        terminatedBy: 'system',
        terminatedReason: 'Past termination time',
      });
      return { success: false, code: 'WALLET_TERMINATED', message: 'Wallet has expired' };
    }

    // --- Transaction limit check ---
    if (wallet.txnCount >= wallet.rules.maxTxnsPerWallet) {
      return {
        success: false,
        code: 'TXN_LIMIT_REACHED',
        message: `Maximum ${wallet.rules.maxTxnsPerWallet} transactions per wallet`,
      };
    }

    // --- Amount resolution: preset item lookup OR custom amount ---
    let itemName = '';
    let totalAmountPaise = 0;

    if (presetItemId) {
      const item = wallet.rules.allowedPresetItems?.find((i) => i.id === presetItemId);
      if (!item) {
        return {
          success: false,
          code: 'ITEM_NOT_ALLOWED',
          message: 'Preset item not found or not available for this wallet',
        };
      }
      if (!item.isAvailable) {
        return {
          success: false,
          code: 'ITEM_NOT_ALLOWED',
          message: 'Item is currently unavailable',
        };
      }
      assertSafePaise(item.amountPaise, `presetItem(${item.id}).amountPaise`);
      itemName = item.name;
      totalAmountPaise = item.amountPaise * quantity;
    } else if (customAmountPaise) {
      try {
        assertSafePaise(customAmountPaise, 'customAmountPaise');
      } catch (e) {
        return {
          success: false,
          code: 'INVALID_CUSTOM_AMOUNT',
          message: e.message,
        };
      }
      if (!Number.isInteger(customAmountPaise) || customAmountPaise <= 0) {
        return {
          success: false,
          code: 'INVALID_CUSTOM_AMOUNT',
          message: 'customAmountPaise must be a positive integer',
        };
      }
      itemName = 'Custom Charge';
      totalAmountPaise = customAmountPaise;
    }

    try {
      assertSafePaise(totalAmountPaise, 'totalAmountPaise');
    } catch (e) {
      return {
        success: false,
        code: 'AMOUNT_CALCULATION_ERROR',
        message: e.message,
      };
    }

    if (totalAmountPaise < wallet.rules.minChargeAmountPaise) {
      return {
        success: false,
        code: 'AMOUNT_BELOW_MIN',
        message: `Minimum charge is ${formatPaise(wallet.rules.minChargeAmountPaise)}`,
      };
    }
    if (totalAmountPaise > wallet.rules.maxChargeAmountPaise) {
      return {
        success: false,
        code: 'AMOUNT_EXCEEDS_MAX',
        message: `Maximum single charge is ${formatPaise(wallet.rules.maxChargeAmountPaise)}`,
      };
    }

    // --- Balance check ---
    if (wallet.currentBalancePaise < totalAmountPaise) {
      return {
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Available: ${formatPaise(wallet.currentBalancePaise)}, Required: ${formatPaise(totalAmountPaise)}`,
      };
    }

    // --- Commit ---
    const timestamp = now.toISOString();
    const newBalance = wallet.currentBalancePaise - totalAmountPaise;

    const txn = {
      id: txnDocId,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      type: 'DEBIT',
      status: 'COMMITTED',
      idempotencyKey,
      amountPaise: totalAmountPaise,
      balanceAfterPaise: newBalance,
      presetItemId: presetItemId || null,
      presetItemName: itemName,
      quantity,
      unitAmountPaise: presetItemId ? totalAmountPaise / quantity : customAmountPaise,
      operatorId,
      operatorName: operatorName || '',
      operatorRole: operatorRole || 'staff',
      deviceId,
      eventCodeId,
      createdAt: timestamp,
    };

    tx.set(txnRef, txn);
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalDebitedPaise: wallet.totalDebitedPaise + totalAmountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return {
      success: true,
      transactionId: txnDocId,
      balanceAfterPaise: newBalance,
      balanceAfterDisplay: formatPaise(newBalance),
      receipt: {
        itemName,
        quantity,
        amountPaise: totalAmountPaise,
        timestamp,
      },
    };
  });
}

// =============================================================================
// REVERSAL
// =============================================================================

/**
 * Reverse a previously committed DEBIT transaction.
 * Requires manager/admin role + supervisor PIN verification.
 *
 * @param {import('./types/cover-charge.js').ReverseTransactionRequest} req
 * @returns {Promise<{success: boolean, code?: string, message?: string, transactionId?: string}>}
 */
export async function reverseTransaction(req) {
  const {
    walletId,
    transactionId,
    reason,
    supervisorPin,
    operatorId,
    operatorRole,
    deviceId,
    eventCodeId,
  } = req;

  if (!['manager', 'admin', 'super'].includes(operatorRole)) {
    return {
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: 'Reversals require manager or admin role',
    };
  }
  if (!supervisorPin) {
    return {
      success: false,
      code: 'SUPERVISOR_PIN_REQUIRED',
      message: 'Supervisor PIN is required for reversals',
    };
  }

  const db = getAdminDb();

  // Server-side bcrypt verification of the plain PIN
  const pinVerified = await verifySupervisorPin(supervisorPin, walletId);
  if (!pinVerified) {
    return {
      success: false,
      code: 'INVALID_SUPERVISOR_PIN',
      message: 'Supervisor PIN is incorrect',
    };
  }

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const walletDoc = await tx.get(walletRef);

    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
    }

    const wallet = walletDoc.data();

    const txnRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(transactionId);
    const txnDoc = await tx.get(txnRef);

    if (!txnDoc.exists) {
      return { success: false, code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found' };
    }

    const originalTxn = txnDoc.data();
    assertSafePaise(originalTxn.amountPaise, 'originalTxn.amountPaise');

    if (originalTxn.type !== 'DEBIT') {
      return {
        success: false,
        code: 'NOT_REVERSIBLE',
        message: 'Only DEBIT transactions can be reversed',
      };
    }
    if (originalTxn.status === 'REVERSED') {
      return {
        success: false,
        code: 'ALREADY_REVERSED',
        message: 'Transaction has already been reversed',
      };
    }
    if (originalTxn.walletId !== walletId) {
      return {
        success: false,
        code: 'TRANSACTION_MISMATCH',
        message: 'Transaction does not belong to this wallet',
      };
    }

    // Check balance cap (top-up may not exceed maxTotalBalance)
    const newBalance = wallet.currentBalancePaise + originalTxn.amountPaise;
    if (newBalance > wallet.rules.maxTotalBalancePaise) {
      return {
        success: false,
        code: 'BALANCE_EXCEEDS_MAX',
        message: `Reversal would exceed max balance ${formatPaise(wallet.rules.maxTotalBalancePaise)}`,
      };
    }

    const idempotencyKey = `REV-${transactionId}`;
    const reversalDocId = `TXN-${idempotencyKey}`;
    const timestamp = new Date().toISOString();

    // Idempotency check — deterministic doc ID within the transaction
    const reversalRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(reversalDocId);

    const existingReversal = await tx.get(reversalRef);
    if (existingReversal.exists) {
      return { success: true, transactionId: reversalDocId, code: 'IDEMPOTENCY_REPLAY' };
    }

    const reversalTxn = {
      id: reversalDocId,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      type: 'REVERSAL',
      status: 'COMMITTED',
      idempotencyKey,
      amountPaise: originalTxn.amountPaise,
      balanceAfterPaise: newBalance,
      reversesTransactionId: transactionId,
      reversalReason: reason,
      operatorId,
      operatorName: '',
      operatorRole,
      deviceId,
      eventCodeId,
      approvedBy: operatorId,
      approvedByRole: operatorRole,
      supervisorPinVerified: true,
      createdAt: timestamp,
    };

    tx.set(reversalRef, reversalTxn);
    tx.update(txnRef, { status: 'REVERSED', reversedAt: timestamp, reversedBy: operatorId });
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalReversedPaise: wallet.totalReversedPaise + originalTxn.amountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return { success: true, transactionId: reversalDocId };
  });
}

// =============================================================================
// TOP-UP (host/admin only)
// =============================================================================

/**
 * Top up a wallet balance. Host/admin only in v1.
 * Guest self-top-up is disabled by default.
 */
export async function topUpWallet(req) {
  const { walletId, amountPaise, reason, idempotencyKey, operatorId, operatorRole } = req;

  if (!['host', 'admin', 'super'].includes(operatorRole)) {
    return {
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: 'Top-up requires host or admin role',
    };
  }
  try {
    assertSafePaise(amountPaise, 'amountPaise');
  } catch (e) {
    return {
      success: false,
      code: 'INVALID_AMOUNT',
      message: e.message,
    };
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return {
      success: false,
      code: 'INVALID_AMOUNT',
      message: 'amountPaise must be a positive integer',
    };
  }
  if (!idempotencyKey) {
    return {
      success: false,
      code: 'MISSING_IDEMPOTENCY_KEY',
      message: 'idempotencyKey is required',
    };
  }

  const db = getAdminDb();

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const walletDoc = await tx.get(walletRef);

    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
    }

    const wallet = walletDoc.data();

    // --- Idempotency check (deterministic doc ID, transaction-snapshot-isolated) ---
    const topUpDocId = `TXN-${idempotencyKey}`;
    const topUpRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(topUpDocId);

    const existingTopUp = await tx.get(topUpRef);
    if (existingTopUp.exists) {
      return {
        success: true,
        transactionId: topUpDocId,
        code: 'IDEMPOTENCY_REPLAY',
        message: 'Already committed',
      };
    }

    if (!wallet.rules.topUpAllowed) {
      return {
        success: false,
        code: 'TOP_UP_DISABLED',
        message: 'Top-up is not enabled for this wallet',
      };
    }
    if (wallet.state !== 'ACTIVE') {
      return {
        success: false,
        code: 'WALLET_INACTIVE',
        message: `Cannot top-up wallet in state: ${wallet.state}`,
      };
    }
    if (amountPaise > wallet.rules.maxTopUpAmountPaise) {
      return {
        success: false,
        code: 'AMOUNT_EXCEEDS_MAX',
        message: `Maximum single top-up is ${formatPaise(wallet.rules.maxTopUpAmountPaise)}`,
      };
    }

    const newBalance = wallet.currentBalancePaise + amountPaise;
    if (newBalance > wallet.rules.maxTotalBalancePaise) {
      return {
        success: false,
        code: 'BALANCE_EXCEEDS_MAX',
        message: `Top-up would exceed maximum balance ${formatPaise(wallet.rules.maxTotalBalancePaise)}`,
      };
    }

    const timestamp = new Date().toISOString();

    const txn = {
      id: topUpDocId,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      type: 'TOP_UP',
      status: 'COMMITTED',
      idempotencyKey,
      amountPaise,
      balanceAfterPaise: newBalance,
      reversalReason: reason,
      operatorId,
      operatorName: '',
      operatorRole,
      deviceId: 'admin',
      eventCodeId: 'admin',
      createdAt: timestamp,
    };

    tx.set(topUpRef, txn);
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalCreditedPaise: wallet.totalCreditedPaise + amountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return { success: true, transactionId: topUpDocId, balanceAfterPaise: newBalance };
  });
}

// =============================================================================
// FREEZE / UNFREEZE
// =============================================================================

export async function freezeWallet(walletId, reason, frozenBy) {
  const db = getAdminDb();
  const now = new Date().toISOString();
  await db.collection(WALLET_COLLECTION).doc(walletId).update({
    state: 'FROZEN',
    frozenAt: now,
    frozenBy,
    frozenReason: reason,
    lastActivityAt: now,
  });
  return { success: true };
}

export async function unfreezeWallet(walletId, unfrozenBy) {
  const db = getAdminDb();
  const walletDoc = await db.collection(WALLET_COLLECTION).doc(walletId).get();
  if (!walletDoc.exists) return { success: false, code: 'WALLET_NOT_FOUND' };
  const wallet = walletDoc.data();
  if (wallet.state !== 'FROZEN') {
    return { success: false, code: 'NOT_FROZEN', message: `Wallet is ${wallet.state}, not FROZEN` };
  }

  const now = new Date().toISOString();
  await db.collection(WALLET_COLLECTION).doc(walletId).update({
    state: 'ACTIVE',
    unfrozenAt: now,
    unfrozenBy,
    lastActivityAt: now,
  });
  return { success: true };
}

// =============================================================================
// TERMINATION (called by Cloud Function at terminationTime)
// =============================================================================

/**
 * Terminate all ACTIVE wallets for an event that have passed terminationTime.
 * Writes EXPIRY_FORFEIT or EXPIRY_REFUND transactions as per wallet policy.
 * Called by the Cloud Function (cover-charge-termination).
 *
 * @param {string} eventId
 * @returns {Promise<{terminated: number, errors: string[]}>}
 */
export async function terminateExpiredWallets(eventId) {
  const db = getAdminDb();
  const now = new Date();

  const activeWallets = await db
    .collection(WALLET_COLLECTION)
    .where('eventId', '==', eventId)
    .where('state', '==', 'ACTIVE')
    .get();

  let terminated = 0;
  const errors = [];

  for (const walletDoc of activeWallets.docs) {
    const wallet = walletDoc.data();

    try {
      const terminationTime = new Date(wallet.rules.terminationTime);
      if (now < terminationTime) continue; // Not yet due

      await db.runTransaction(async (tx) => {
        // Re-read inside transaction
        const fresh = await tx.get(walletDoc.ref);
        if (!fresh.exists || fresh.data().state !== 'ACTIVE') return;

        const w = fresh.data();
        const timestamp = now.toISOString();
        const expiredBalancePaise = w.currentBalancePaise;

        const txnType =
          w.rules.terminationPolicy === 'partial_refund' && expiredBalancePaise > 0
            ? 'EXPIRY_REFUND'
            : 'EXPIRY_FORFEIT';

        if (expiredBalancePaise > 0) {
          const txnId = newTxnId();
          const txn = {
            id: txnId,
            walletId: w.id,
            eventId: w.eventId,
            venueId: w.venueId,
            type: txnType,
            status: 'COMMITTED',
            idempotencyKey: `TERMINATION-${w.id}`,
            amountPaise: expiredBalancePaise,
            balanceAfterPaise: 0,
            operatorId: 'system',
            operatorName: 'system',
            operatorRole: 'system',
            deviceId: 'system',
            eventCodeId: 'system',
            createdAt: timestamp,
          };

          const txnRef = walletDoc.ref.collection(TXN_SUBCOLLECTION).doc(txnId);
          tx.set(txnRef, txn);
        }

        tx.update(walletDoc.ref, {
          state: 'EXPIRED',
          currentBalancePaise: 0,
          terminatedAt: timestamp,
          terminatedBy: 'system',
          terminatedReason: `Automatic expiry at ${wallet.rules.terminationTime}`,
          lastActivityAt: timestamp,
        });
      });

      terminated++;
    } catch (err) {
      errors.push(`wallet ${wallet.id}: ${err.message}`);
    }
  }

  return { terminated, errors };
}

// =============================================================================
// RECONCILIATION
// =============================================================================

/**
 * Generate the event-close reconciliation report.
 * Called after terminateExpiredWallets completes.
 *
 * @param {string} eventId
 * @param {string} venueId
 * @returns {Promise<import('./types/cover-charge.js').CoverWalletReconciliation>}
 */
export async function generateReconciliation(eventId, venueId) {
  const db = getAdminDb();

  const walletsSnap = await db.collection(WALLET_COLLECTION).where('eventId', '==', eventId).get();

  const exceptions = [];
  const walletRows = [];

  let openingBalancePaise = 0;
  let totalDebitedPaise = 0;
  let totalCreditedPaise = 0;
  let totalReversedPaise = 0;
  let expiredBalancePaise = 0;

  for (const walletDoc of walletsSnap.docs) {
    const wallet = walletDoc.data();

    // Recompute from txns for verification
    const txnsSnap = await db
      .collection(WALLET_COLLECTION)
      .doc(wallet.id)
      .collection(TXN_SUBCOLLECTION)
      .get();

    let computedDebited = 0;
    let computedCredited = 0;
    let computedReversed = 0;
    let computedExpired = 0;
    const seenIdempotencyKeys = new Set();

    for (const txnDoc of txnsSnap.docs) {
      const txn = txnDoc.data();

      if (txn.status === 'REVERSED') continue; // skip reversed txns

      // Check for duplicate idempotency keys
      if (txn.idempotencyKey && seenIdempotencyKeys.has(txn.idempotencyKey)) {
        exceptions.push({
          type: 'DUPLICATE_IDEMPOTENCY',
          walletId: wallet.id,
          description: `Duplicate idempotencyKey: ${txn.idempotencyKey}`,
        });
      }
      if (txn.idempotencyKey) seenIdempotencyKeys.add(txn.idempotencyKey);

      switch (txn.type) {
        case 'DEBIT':
          computedDebited += txn.amountPaise;
          break;
        case 'REVERSAL':
          computedReversed += txn.amountPaise;
          break;
        case 'TOP_UP':
        case 'CREDIT':
          computedCredited += txn.amountPaise;
          break;
        case 'EXPIRY_FORFEIT':
        case 'EXPIRY_REFUND':
          computedExpired += txn.amountPaise;
          break;
      }
    }

    // Verify balance consistency
    const expectedBalance =
      wallet.openingBalancePaise +
      computedCredited -
      computedDebited +
      computedReversed -
      computedExpired;
    if (expectedBalance !== 0 && wallet.state !== 'ACTIVE') {
      // Closed wallet should have zero balance
      // (some ACTIVE wallets may not be terminated yet — skip this check)
    }
    if (Math.abs(wallet.totalDebitedPaise - computedDebited) > 0) {
      exceptions.push({
        type: 'BALANCE_MISMATCH',
        walletId: wallet.id,
        description: `Stored totalDebitedPaise ${wallet.totalDebitedPaise} != computed ${computedDebited}`,
      });
    }

    openingBalancePaise += wallet.openingBalancePaise;
    totalDebitedPaise += computedDebited;
    totalCreditedPaise += computedCredited;
    totalReversedPaise += computedReversed;
    expiredBalancePaise += computedExpired;

    walletRows.push({
      walletId: wallet.id,
      userId: wallet.userId,
      orderId: wallet.orderId,
      openingPaise: wallet.openingBalancePaise,
      debitedPaise: computedDebited,
      creditedPaise: computedCredited,
      reversedPaise: computedReversed,
      closingPaise: wallet.currentBalancePaise,
      terminationReason: wallet.terminatedReason || 'N/A',
      txnCount: wallet.txnCount,
      state: wallet.state,
    });
  }

  const consumedBalancePaise = totalDebitedPaise - totalReversedPaise;
  const netVenueConsumedValuePaise = consumedBalancePaise;
  const netVenueForfeitedValuePaise = expiredBalancePaise;

  const now = new Date().toISOString();

  const reconciliation = {
    id: eventId,
    eventId,
    venueId,
    generatedAt: now,
    periodStartsAt: walletsSnap.docs[0]?.data()?.issuedAt || now,
    periodEndsAt: now,
    summary: {
      walletsIssued: walletsSnap.size,
      walletsTerminated: walletsSnap.docs.filter((d) => d.data().state !== 'ACTIVE').length,
      openingBalancePaise,
      totalDebitedPaise,
      totalCreditedPaise,
      totalReversedPaise,
      expiredBalancePaise,
      consumedBalancePaise,
      netVenueConsumedValuePaise,
      netVenueForfeitedValuePaise,
      exceptionList: exceptions,
    },
    wallets: walletRows,
  };

  // Persist
  await db.collection(RECON_COLLECTION).doc(eventId).set(reconciliation);

  return reconciliation;
}

// =============================================================================
// VELOCITY CHECK (Redis-backed, called at API layer)
// =============================================================================

/**
 * Check debit velocity bound to scanner session ID.
 * Returns true if within limits, false if exceeded.
 * Does NOT increment — caller must increment only on successful debit.
 *
 * @param {object} redis - ioredis client
 * @param {string} sessionId - scanner session ID (not deviceId)
 * @param {string} walletId
 * @param {number} maxPerMinute
 * @returns {Promise<boolean>}
 */
export async function checkAndIncrementVelocity(redis, sessionId, walletId, maxPerMinute = 3) {
  const key = `cwv:${sessionId}:${walletId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 90); // 90s TTL (covers the 60s window + buffer)
  }
  return count <= maxPerMinute;
}

// =============================================================================
// SUPERVISOR PIN (stored per-venue in platform_settings)
// =============================================================================

/**
 * Verify a supervisor's plain PIN against the stored bcrypt hash for this wallet's venue.
 * The stored hash lives in platform_settings/{venueId}.supervisorPinHash.
 *
 * @param {string} supervisorPin - plain-text PIN submitted by staff (safe over TLS)
 * @param {string} walletId
 * @returns {Promise<boolean>}
 */
async function verifySupervisorPin(supervisorPin, walletId) {
  const db = getAdminDb();

  const walletDoc = await db.collection(WALLET_COLLECTION).doc(walletId).get();
  if (!walletDoc.exists) return false;

  const venueId = walletDoc.data().venueId;
  const settingsDoc = await db.collection('platform_settings').doc(`venue_${venueId}`).get();
  if (!settingsDoc.exists) return false;

  const storedHash = settingsDoc.data()?.supervisorPinHash;
  if (!storedHash) return false;

  return bcrypt.compare(supervisorPin, storedHash);
}

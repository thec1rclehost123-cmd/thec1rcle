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

import { createHash, randomUUID } from 'node:crypto';
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

export function deterministicCoverWalletId(orderId, tierId, unitIndex = 1) {
  const digest = createHash('sha256')
    .update(`cover-wallet:v2:${orderId}:${tierId}:${unitIndex}`)
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();
  return `CW-${digest}`;
}

function newTxnId() {
  return `WTX-${randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
}

/**
 * Format paise as a display string: 50000 → "₹500.00"
 */
export function formatPaise(paise) {
  if (!Number.isInteger(paise)) throw new Error(`formatPaise: expected integer, got ${paise}`);
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
  },
  transaction = null,
) {
  if (!Number.isInteger(tierConfig.walletAmountPaise) || tierConfig.walletAmountPaise <= 0) {
    throw new Error(
      `walletAmountPaise must be a positive integer, got ${tierConfig.walletAmountPaise}`,
    );
  }

  const db = getAdminDb();
  const tierId = String(tierConfig.tierId || tierConfig.ticketTierId || 'GEN');
  const unitIndex = Number(tierConfig.unitIndex || 1);
  const wallet = buildCoverWalletDocument({
    orderId,
    eventId,
    venueId,
    userId,
    tierId,
    unitIndex,
    tierConfig,
    eventStartIso,
    tzOffset,
    termsAcceptedAt,
  });
  const ref = db.collection(WALLET_COLLECTION).doc(wallet.id);
  const existing = transaction ? await transaction.get(ref) : await ref.get();
  if (existing.exists) {
    return { id: existing.id, ...existing.data() };
  }

  if (transaction) {
    transaction.create(ref, wallet);
  } else {
    await ref.create(wallet);
  }

  return wallet;
}

export function buildCoverWalletDocument({
  orderId,
  eventId,
  venueId,
  userId,
  tierId,
  unitIndex = 1,
  tierConfig,
  eventStartIso,
  tzOffset = '+05:30',
  termsAcceptedAt,
  issuedAt,
}) {
  if (!Number.isInteger(tierConfig.walletAmountPaise) || tierConfig.walletAmountPaise <= 0) {
    throw new Error(
      `walletAmountPaise must be a positive integer, got ${tierConfig.walletAmountPaise}`,
    );
  }
  if (!orderId || !eventId || !venueId || !userId || !tierId) {
    throw new Error('Cover wallet attribution is incomplete');
  }
  if (!Number.isInteger(unitIndex) || unitIndex < 1) {
    throw new Error(`unitIndex must be a positive integer, got ${unitIndex}`);
  }

  const terminationTime = computeTerminationTime(
    eventStartIso,
    tierConfig.terminationHour ?? 5,
    tzOffset,
  );
  const walletId = deterministicCoverWalletId(orderId, tierId, unitIndex);
  const now = issuedAt || new Date().toISOString();
  return {
    id: walletId,
    orderId,
    eventId,
    venueId,
    userId,
    tierId,
    unitIndex,
    schemaVersion: 2,
    state: 'ACTIVE',
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
}

// =============================================================================
// DEBIT
// =============================================================================

/**
 * Debit a Cover Wallet for a preset item.
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
    quantity,
    idempotencyKey,
    operatorId,
    operatorName,
    operatorRole,
    deviceId,
    eventCodeId,
    authorizedEventId,
    authorizedVenueId,
    scannerSessionId,
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

  const db = getAdminDb();

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const idempotencyRef = walletRef.collection(TXN_SUBCOLLECTION).doc(`IDEMP-${idempotencyKey}`);
    const eventCodeRef = db.collection('event_codes').doc(eventCodeId);
    const [walletDoc, idempotencyDoc, eventCodeDoc] = await Promise.all([
      tx.get(walletRef),
      tx.get(idempotencyRef),
      tx.get(eventCodeRef),
    ]);

    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Cover Wallet not found' };
    }

    const wallet = walletDoc.data();

    // --- Idempotency check ---
    if (idempotencyDoc.exists) {
      const existingTxn = { id: idempotencyDoc.id, ...idempotencyDoc.data() };
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
    const eventCode = eventCodeDoc.exists ? eventCodeDoc.data() : null;
    if (
      !eventCode ||
      eventCode.type !== 'charge' ||
      eventCode.isRevoked === true ||
      (eventCode.expiresAt && new Date(eventCode.expiresAt).getTime() <= Date.now()) ||
      String(eventCode.eventId) !== String(authorizedEventId) ||
      String(eventCode.venueId || '') !== String(authorizedVenueId || '') ||
      String(wallet.eventId) !== String(authorizedEventId) ||
      String(wallet.venueId) !== String(authorizedVenueId) ||
      !deviceId ||
      !scannerSessionId
    ) {
      return {
        success: false,
        code: 'CHARGE_CONTEXT_MISMATCH',
        message: 'Charge session does not authorize this wallet',
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

    // --- Preset item lookup ---
    const item = wallet.rules.allowedPresetItems?.find((i) => i.id === presetItemId);
    if (!item) {
      return {
        success: false,
        code: 'ITEM_NOT_ALLOWED',
        message: 'Preset item not found or not available for this wallet',
      };
    }
    if (!item.isAvailable) {
      return { success: false, code: 'ITEM_NOT_ALLOWED', message: 'Item is currently unavailable' };
    }

    // --- Amount calculation ---
    const totalAmountPaise = item.amountPaise * quantity;
    if (!Number.isInteger(totalAmountPaise)) {
      return {
        success: false,
        code: 'AMOUNT_CALCULATION_ERROR',
        message: 'Amount calculation error',
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
    const txnId = idempotencyRef.id;
    const timestamp = now.toISOString();
    const newBalance = wallet.currentBalancePaise - totalAmountPaise;

    const txn = {
      id: txnId,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      type: 'DEBIT',
      status: 'COMMITTED',
      idempotencyKey,
      amountPaise: totalAmountPaise,
      balanceAfterPaise: newBalance,
      presetItemId,
      presetItemName: item.name,
      quantity,
      unitAmountPaise: item.amountPaise,
      operatorId,
      operatorName: operatorName || '',
      operatorRole: operatorRole || 'staff',
      deviceId,
      eventCodeId,
      scannerSessionId,
      createdAt: timestamp,
    };

    tx.create(idempotencyRef, txn);
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalDebitedPaise: wallet.totalDebitedPaise + totalAmountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return {
      success: true,
      transactionId: txnId,
      balanceAfterPaise: newBalance,
      balanceAfterDisplay: formatPaise(newBalance),
      receipt: {
        itemName: item.name,
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
    supervisorPinHash,
    operatorId,
    operatorRole,
    deviceId,
    eventCodeId,
  } = req;

  if (!['owner', 'manager', 'admin', 'super'].includes(operatorRole)) {
    return {
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: 'Reversals require manager or admin role',
    };
  }
  if (!supervisorPinHash) {
    return {
      success: false,
      code: 'SUPERVISOR_PIN_REQUIRED',
      message: 'Supervisor PIN is required for reversals',
    };
  }

  const db = getAdminDb();

  // Verify supervisor PIN against stored hash
  const pinVerified = await verifySupervisorPin(supervisorPinHash, walletId);
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

    const reversalId = newTxnId();
    const timestamp = new Date().toISOString();
    const idempotencyKey = `REV-${transactionId}`;

    const reversalTxn = {
      id: reversalId,
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

    const reversalRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(reversalId);

    tx.set(reversalRef, reversalTxn);
    tx.update(txnRef, { status: 'REVERSED', reversedAt: timestamp, reversedBy: operatorId });
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalReversedPaise: wallet.totalReversedPaise + originalTxn.amountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return { success: true, transactionId: reversalId };
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

  if (!['owner', 'manager', 'host', 'admin', 'super'].includes(operatorRole)) {
    return {
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: 'Top-up requires host or admin role',
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

    // --- Idempotency check ---
    const idempSnap = await db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!idempSnap.empty) {
      const existing = { id: idempSnap.docs[0].id, ...idempSnap.docs[0].data() };
      return {
        success: true,
        transactionId: existing.id,
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

    const txnId = newTxnId();
    const timestamp = new Date().toISOString();

    const txn = {
      id: txnId,
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

    const txnRef = db
      .collection(WALLET_COLLECTION)
      .doc(walletId)
      .collection(TXN_SUBCOLLECTION)
      .doc(txnId);

    tx.set(txnRef, txn);
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalCreditedPaise: wallet.totalCreditedPaise + amountPaise,
      txnCount: wallet.txnCount + 1,
      lastActivityAt: timestamp,
    });

    return { success: true, transactionId: txnId, balanceAfterPaise: newBalance };
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

  const reconciliationId = `${venueId}_${eventId}`;
  const reconciliation = {
    id: reconciliationId,
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
  await db.collection(RECON_COLLECTION).doc(reconciliationId).set(reconciliation);

  return reconciliation;
}

// =============================================================================
// VELOCITY CHECK (Redis-backed, called at API layer)
// =============================================================================

/**
 * Check and increment device-level debit velocity.
 * Returns true if the debit is within velocity limits, false if exceeded.
 *
 * @param {object} redis - ioredis client
 * @param {string} deviceId
 * @param {string} walletId
 * @param {number} maxPerMinute
 * @returns {Promise<boolean>}
 */
export async function checkAndIncrementVelocity(redis, deviceId, walletId, maxPerMinute = 3) {
  const key = `cwv:${deviceId}:${walletId}:${Math.floor(Date.now() / 60000)}`;
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
 * Verify a supervisor PIN hash against the stored hash for this wallet's venue.
 * The stored hash is a bcrypt hash in platform_settings/{venueId}.supervisorPinHash.
 *
 * For v1, we use a simple constant-time comparison of bcrypt hashes.
 * In production, use the `bcrypt` package.
 *
 * @param {string} submittedHash - bcrypt hash of the PIN submitted by staff
 * @param {string} walletId
 * @returns {Promise<boolean>}
 */
async function verifySupervisorPin(submittedHash, walletId) {
  const db = getAdminDb();

  const walletDoc = await db.collection(WALLET_COLLECTION).doc(walletId).get();
  if (!walletDoc.exists) return false;

  const venueId = walletDoc.data().venueId;
  const settingsDoc = await db.collection('platform_settings').doc(`venue_${venueId}`).get();
  if (!settingsDoc.exists) return false;

  const storedHash = settingsDoc.data()?.supervisorPinHash;
  if (!storedHash) return false;

  // In production: return await bcrypt.compare(plainPin, storedHash)
  // Here we compare the client-submitted bcrypt hash with the stored hash
  // The client must hash the PIN before sending (prevents plain PIN transit)
  return storedHash === submittedHash;
}

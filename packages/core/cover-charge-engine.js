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

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { getAdminDb } from './admin.js';
import { getQrSecret } from './secret-registry.js';

const WALLET_COLLECTION = 'cover_wallets';
const TXN_SUBCOLLECTION = 'txns';
const RECON_COLLECTION = 'cover_wallet_reconciliations';

const COVER_QR_TTL_SECONDS = 15;

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

function assertSafeInteger(
  value,
  field,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be a safe integer between ${min} and ${max}, got ${value}`);
  }
  return value;
}

function assertSafePaise(value, field, { positive = false } = {}) {
  return assertSafeInteger(value, field, { min: positive ? 1 : 0 });
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

/**
 * Format paise as a display string: 50000 → "₹500.00"
 */
export function formatPaise(paise) {
  assertSafePaise(paise, 'formatPaise.paise');
  const rupees = paise / 100;
  return `₹${rupees.toFixed(2)}`;
}

export function createCoverWalletQrToken(
  wallet,
  { nowMs = Date.now(), ttlSeconds = COVER_QR_TTL_SECONDS, secret = getQrSecret() } = {},
) {
  if (!wallet?.id || !wallet.orderId || !wallet.eventId || !wallet.venueId || !wallet.userId) {
    throw new Error('Cover wallet QR attribution is incomplete');
  }
  assertSafeInteger(ttlSeconds, 'ttlSeconds', { min: 5, max: 60 });
  const nowSeconds = Math.floor(nowMs / 1000);
  const header = { alg: 'HS256', typ: 'JWT', kid: 'cover-wallet-v1' };
  const payload = {
    typ: 'cover_wallet',
    iss: 'the-c1rcle',
    aud: 'c1rcle-cover-scanner',
    sub: wallet.id,
    jti: `cover:${wallet.id}:${Math.floor(nowSeconds / ttlSeconds)}`,
    walletId: wallet.id,
    orderId: wallet.orderId,
    eventId: wallet.eventId,
    venueId: wallet.venueId,
    ownerUserId: wallet.userId,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date((nowSeconds + ttlSeconds) * 1000).toISOString(),
    payload,
  };
}

export function verifyCoverWalletQrToken(
  token,
  { nowMs = Date.now(), secret = getQrSecret() } = {},
) {
  if (!token || typeof token !== 'string') {
    return { valid: false, code: 'COVER_QR_MISSING', error: 'Cover Wallet QR is missing' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, code: 'COVER_QR_MALFORMED', error: 'Cover Wallet QR is malformed' };
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return {
      valid: false,
      code: 'COVER_QR_INVALID',
      error: 'Cover Wallet QR signature is invalid',
    };
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(nowMs / 1000);
    if (
      header.alg !== 'HS256' ||
      header.kid !== 'cover-wallet-v1' ||
      payload.typ !== 'cover_wallet' ||
      payload.iss !== 'the-c1rcle' ||
      payload.aud !== 'c1rcle-cover-scanner' ||
      !payload.walletId ||
      payload.sub !== payload.walletId ||
      !payload.orderId ||
      !payload.eventId ||
      !payload.venueId ||
      !payload.ownerUserId ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp)
    ) {
      return {
        valid: false,
        code: 'COVER_QR_CLAIMS_INVALID',
        error: 'Cover Wallet QR claims are invalid',
      };
    }
    if (nowSeconds >= payload.exp) {
      return { valid: false, code: 'COVER_QR_EXPIRED', error: 'Cover Wallet QR has expired' };
    }
    if (payload.iat > nowSeconds + 5 || payload.exp - payload.iat > 60) {
      return {
        valid: false,
        code: 'COVER_QR_CLAIMS_INVALID',
        error: 'Cover Wallet QR timing is invalid',
      };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, code: 'COVER_QR_MALFORMED', error: 'Cover Wallet QR is malformed' };
  }
}

export function validateCoverWalletTierConfig(tierConfig) {
  if (!tierConfig || typeof tierConfig !== 'object') {
    throw new Error('Cover wallet tier configuration is required');
  }

  const walletAmountPaise = assertSafePaise(tierConfig.walletAmountPaise, 'walletAmountPaise', {
    positive: true,
  });
  const minChargeAmountPaise = assertSafePaise(
    tierConfig.minChargeAmountPaise ?? 0,
    'minChargeAmountPaise',
  );
  const maxChargeAmountPaise = assertSafePaise(
    tierConfig.maxChargeAmountPaise ?? walletAmountPaise,
    'maxChargeAmountPaise',
    { positive: true },
  );
  if (maxChargeAmountPaise < minChargeAmountPaise) {
    throw new Error('maxChargeAmountPaise cannot be below minChargeAmountPaise');
  }

  const topUpAllowed = tierConfig.topUpAllowed === true;
  const maxTopUpAmountPaise = assertSafePaise(
    tierConfig.maxTopUpAmountPaise ?? 0,
    'maxTopUpAmountPaise',
  );
  const maxTotalBalancePaise = assertSafePaise(
    tierConfig.maxTotalBalancePaise ?? walletAmountPaise * 2,
    'maxTotalBalancePaise',
    { positive: true },
  );
  if (maxTotalBalancePaise < walletAmountPaise) {
    throw new Error('maxTotalBalancePaise cannot be below walletAmountPaise');
  }
  if (topUpAllowed && maxTopUpAmountPaise < 1) {
    throw new Error('maxTopUpAmountPaise must be positive when top-up is enabled');
  }

  const terminationHour = assertSafeInteger(tierConfig.terminationHour ?? 5, 'terminationHour', {
    min: 0,
    max: 23,
  });
  const terminationPolicy = tierConfig.terminationPolicy ?? 'forfeit';
  if (!['forfeit', 'partial_refund'].includes(terminationPolicy)) {
    throw new Error(`Unsupported terminationPolicy: ${terminationPolicy}`);
  }
  const partialRefundPercent = assertSafeInteger(
    tierConfig.partialRefundPercent ?? (terminationPolicy === 'partial_refund' ? 100 : 0),
    'partialRefundPercent',
    { min: 0, max: 100 },
  );
  if (terminationPolicy === 'partial_refund' && partialRefundPercent < 1) {
    throw new Error('partialRefundPercent must be positive for partial_refund policy');
  }
  if (terminationPolicy === 'forfeit' && partialRefundPercent !== 0) {
    throw new Error('partialRefundPercent must be zero for forfeit policy');
  }
  const maxTxnsPerWallet = assertSafeInteger(
    tierConfig.maxTxnsPerWallet ?? 50,
    'maxTxnsPerWallet',
    { min: 1, max: 500 },
  );
  const maxDebitsPerMinutePerDevice = assertSafeInteger(
    tierConfig.maxDebitsPerMinutePerDevice ?? 3,
    'maxDebitsPerMinutePerDevice',
    { min: 1, max: 3 },
  );
  const configuredTopUpBy = tierConfig.topUpBy ?? (topUpAllowed ? 'host' : 'none');
  if (!['host', 'admin', 'none'].includes(configuredTopUpBy)) {
    throw new Error(`Unsupported topUpBy: ${configuredTopUpBy}`);
  }
  if (topUpAllowed && configuredTopUpBy === 'none') {
    throw new Error('topUpBy must authorize host or admin when top-up is enabled');
  }
  if (!topUpAllowed && configuredTopUpBy !== 'none') {
    throw new Error('topUpBy must be none when top-up is disabled');
  }

  const presetItems = Array.isArray(tierConfig.presetItems) ? tierConfig.presetItems : [];
  const seenItemIds = new Set();
  const normalizedItems = presetItems.map((item, index) => {
    const id = String(item?.id || '').trim();
    const name = String(item?.name || '').trim();
    if (!id || !name) throw new Error(`presetItems[${index}] must include id and name`);
    if (seenItemIds.has(id)) throw new Error(`Duplicate preset item id: ${id}`);
    seenItemIds.add(id);
    return {
      ...item,
      id,
      name,
      amountPaise: assertSafePaise(item.amountPaise, `presetItems[${index}].amountPaise`, {
        positive: true,
      }),
      isAvailable: item.isAvailable !== false,
      sortOrder: assertSafeInteger(item.sortOrder ?? index, `presetItems[${index}].sortOrder`, {
        min: 0,
      }),
    };
  });

  return {
    ...tierConfig,
    walletAmountPaise,
    minChargeAmountPaise,
    maxChargeAmountPaise,
    topUpAllowed,
    maxTopUpAmountPaise,
    maxTotalBalancePaise,
    topUpBy: configuredTopUpBy,
    terminationHour,
    terminationPolicy,
    partialRefundPercent,
    showBalanceToGuest: tierConfig.showBalanceToGuest !== false,
    showTransactionHistory: tierConfig.showTransactionHistory !== false,
    maxTxnsPerWallet,
    maxDebitsPerMinutePerDevice,
    presetItems: normalizedItems,
  };
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
  if (!orderId || !eventId || !venueId || !userId || !tierId) {
    throw new Error('Cover wallet attribution is incomplete');
  }
  if (!Number.isInteger(unitIndex) || unitIndex < 1) {
    throw new Error(`unitIndex must be a positive integer, got ${unitIndex}`);
  }
  const config = validateCoverWalletTierConfig(tierConfig);

  const terminationTime = computeTerminationTime(eventStartIso, config.terminationHour, tzOffset);
  const terminationAtMs = new Date(terminationTime).getTime();
  if (!Number.isSafeInteger(terminationAtMs) || terminationAtMs <= 0) {
    throw new Error('Cover Wallet termination time is invalid');
  }
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
    terminationAtMs,
    openingBalancePaise: config.walletAmountPaise,
    currentBalancePaise: config.walletAmountPaise,
    totalDebitedPaise: 0,
    totalCreditedPaise: 0,
    totalReversedPaise: 0,
    txnCount: 0,
    rules: {
      minChargeAmountPaise: config.minChargeAmountPaise,
      maxChargeAmountPaise: config.maxChargeAmountPaise,
      topUpAllowed: config.topUpAllowed,
      maxTopUpAmountPaise: config.maxTopUpAmountPaise,
      maxTotalBalancePaise: config.maxTotalBalancePaise,
      topUpBy: config.topUpBy,
      terminationTime,
      terminationPolicy: config.terminationPolicy,
      partialRefundPercent: config.partialRefundPercent,
      showBalanceToGuest: config.showBalanceToGuest ?? true,
      showTransactionHistory: config.showTransactionHistory ?? true,
      allowedPresetItems: config.presetItems.filter((item) => item.isAvailable),
      currency: 'INR',
      maxTxnsPerWallet: config.maxTxnsPerWallet,
      maxDebitsPerMinutePerDevice: config.maxDebitsPerMinutePerDevice,
    },
    termsAcceptedAt: termsAcceptedAt || now,
    termsVersion: config.termsVersion || '1.0',
    issuedAt: now,
    lastActivityAt: now,
    createdBy: 'checkout_service',
  };
}

function buildExpiryTransactions(wallet, timestamp) {
  const balancePaise = assertSafePaise(wallet.currentBalancePaise, 'wallet.currentBalancePaise');
  if (balancePaise === 0) return [];

  const isPartialRefund = wallet.rules?.terminationPolicy === 'partial_refund';
  const partialRefundPercent = assertSafeInteger(
    wallet.rules?.partialRefundPercent ?? 0,
    'wallet.rules.partialRefundPercent',
    { min: 0, max: 100 },
  );
  const refundPaise = isPartialRefund ? Math.floor((balancePaise * partialRefundPercent) / 100) : 0;
  const forfeitPaise = balancePaise - refundPaise;
  const common = {
    walletId: wallet.id,
    eventId: wallet.eventId,
    venueId: wallet.venueId,
    status: 'COMMITTED',
    balanceAfterPaise: 0,
    operatorId: 'system',
    operatorName: 'system',
    operatorRole: 'system',
    deviceId: 'system',
    eventCodeId: 'system',
    createdAt: timestamp,
  };
  return [
    ...(refundPaise > 0
      ? [
          {
            ...common,
            id: `EXPIRY-REFUND-${wallet.id}`,
            type: 'EXPIRY_REFUND',
            idempotencyKey: `TERMINATION-REFUND-${wallet.id}`,
            amountPaise: refundPaise,
          },
        ]
      : []),
    ...(forfeitPaise > 0
      ? [
          {
            ...common,
            id: `EXPIRY-FORFEIT-${wallet.id}`,
            type: 'EXPIRY_FORFEIT',
            idempotencyKey: `TERMINATION-FORFEIT-${wallet.id}`,
            amountPaise: forfeitPaise,
          },
        ]
      : []),
  ];
}

function buildExpiryRefundOutbox(wallet, amountPaise, timestamp) {
  assertSafePaise(amountPaise, 'expiryRefund.amountPaise', { positive: true });
  return {
    id: `cover-wallet-expiry-refund-${wallet.id}`,
    type: 'cover.wallet.expiry_refund.required',
    aggregateId: wallet.id,
    walletId: wallet.id,
    orderId: wallet.orderId,
    eventId: wallet.eventId,
    venueId: wallet.venueId,
    userId: wallet.userId,
    amountPaise,
    currency: 'INR',
    status: 'pending',
    attempts: 0,
    createdAt: timestamp,
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
    const globalIdempotencyRef = db.collection('cover_wallet_idempotency').doc(idempotencyKey);
    const eventCodeRef = db.collection('event_codes').doc(eventCodeId);
    const isStaffChargeSession = String(eventCodeId || '').startsWith('staff_');
    const scannerSessionRef =
      isStaffChargeSession && scannerSessionId
        ? db.collection('scanner_auth_sessions').doc(scannerSessionId)
        : null;
    const expiryRefundRef = walletRef
      .collection(TXN_SUBCOLLECTION)
      .doc(`EXPIRY-REFUND-${walletId}`);
    const expiryForfeitRef = walletRef
      .collection(TXN_SUBCOLLECTION)
      .doc(`EXPIRY-FORFEIT-${walletId}`);
    const expiryRefundOutboxRef = db
      .collection('domain_event_outbox')
      .doc(`cover-wallet-expiry-refund-${walletId}`);
    const [
      walletDoc,
      idempotencyDoc,
      globalIdempotencyDoc,
      eventCodeDoc,
      scannerSessionDoc,
      expiryRefundDoc,
      expiryForfeitDoc,
      expiryRefundOutboxDoc,
    ] = await Promise.all([
      tx.get(walletRef),
      tx.get(idempotencyRef),
      tx.get(globalIdempotencyRef),
      tx.get(eventCodeRef),
      scannerSessionRef ? tx.get(scannerSessionRef) : Promise.resolve(null),
      tx.get(expiryRefundRef),
      tx.get(expiryForfeitRef),
      tx.get(expiryRefundOutboxRef),
    ]);

    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Cover Wallet not found' };
    }

    const wallet = walletDoc.data();

    // --- Idempotency check ---
    if (idempotencyDoc.exists || globalIdempotencyDoc.exists) {
      if (!idempotencyDoc.exists || !globalIdempotencyDoc.exists) {
        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Cover Wallet idempotency artifacts are incomplete',
        };
      }
      const existingTxn = { id: idempotencyDoc.id, ...idempotencyDoc.data() };
      const globalMarker = globalIdempotencyDoc.data();
      if (
        existingTxn.type !== 'DEBIT' ||
        existingTxn.idempotencyKey !== idempotencyKey ||
        existingTxn.walletId !== walletId ||
        existingTxn.presetItemId !== presetItemId ||
        existingTxn.quantity !== quantity ||
        globalMarker.idempotencyKey !== idempotencyKey ||
        globalMarker.type !== 'DEBIT' ||
        globalMarker.walletId !== walletId ||
        globalMarker.transactionId !== existingTxn.id ||
        globalMarker.presetItemId !== presetItemId ||
        globalMarker.quantity !== quantity ||
        globalMarker.amountPaise !== existingTxn.amountPaise
      ) {
        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotencyKey is already linked to a different wallet mutation',
        };
      }
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
    const eventCodeExpiry = eventCode?.expiresAt ? new Date(eventCode.expiresAt).getTime() : null;
    const scannerSession = scannerSessionDoc?.exists ? scannerSessionDoc.data() : null;
    const scannerSessionExpiry = scannerSession?.expiresAt
      ? new Date(scannerSession.expiresAt).getTime()
      : null;
    const staffChargeContextValid =
      isStaffChargeSession &&
      scannerSession?.isStaffSession === true &&
      scannerSession?.codeType === 'charge' &&
      scannerSession?.codeId === eventCodeId &&
      scannerSession?.revokedAt == null &&
      scannerSession?.eventId === authorizedEventId &&
      scannerSession?.venueId === authorizedVenueId &&
      scannerSession?.deviceId === deviceId &&
      scannerSessionExpiry !== null &&
      Number.isFinite(scannerSessionExpiry) &&
      scannerSessionExpiry > Date.now();
    const eventCodeContextValid =
      !isStaffChargeSession &&
      eventCode &&
      eventCode.type === 'charge' &&
      eventCode.isRevoked !== true &&
      (!eventCode.expiresAt ||
        (Number.isFinite(eventCodeExpiry) && Number(eventCodeExpiry) > Date.now())) &&
      String(eventCode.eventId) === String(authorizedEventId) &&
      String(eventCode.venueId || '') === String(authorizedVenueId || '');
    if (
      (!staffChargeContextValid && !eventCodeContextValid) ||
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

    try {
      assertSafePaise(wallet.openingBalancePaise, 'wallet.openingBalancePaise');
      assertSafePaise(wallet.currentBalancePaise, 'wallet.currentBalancePaise');
      assertSafePaise(wallet.totalDebitedPaise, 'wallet.totalDebitedPaise');
      assertSafeInteger(wallet.txnCount, 'wallet.txnCount', { min: 0 });
      assertSafeInteger(wallet.rules?.maxTxnsPerWallet, 'wallet.rules.maxTxnsPerWallet', {
        min: 1,
      });
      assertSafePaise(wallet.rules?.minChargeAmountPaise, 'wallet.rules.minChargeAmountPaise');
      assertSafePaise(wallet.rules?.maxChargeAmountPaise, 'wallet.rules.maxChargeAmountPaise', {
        positive: true,
      });
    } catch {
      return {
        success: false,
        code: 'WALLET_MONEY_INVALID',
        message: 'Wallet monetary state is invalid',
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
    const terminationMs = new Date(wallet.rules.terminationTime).getTime();
    if (!Number.isFinite(terminationMs) || now.getTime() >= terminationMs) {
      const timestamp = now.toISOString();
      const expiryTransactions = buildExpiryTransactions(
        { ...wallet, id: wallet.id || walletId },
        timestamp,
      );
      const refundPaise =
        expiryTransactions.find((transaction) => transaction.type === 'EXPIRY_REFUND')
          ?.amountPaise || 0;
      if (expiryRefundOutboxDoc.exists) {
        const existingOutbox = expiryRefundOutboxDoc.data();
        if (
          refundPaise < 1 ||
          existingOutbox?.walletId !== walletId ||
          existingOutbox?.amountPaise !== refundPaise
        ) {
          return {
            success: false,
            code: 'EXPIRY_ARTIFACT_CONFLICT',
            message: 'Wallet expiry refund artifacts conflict',
          };
        }
      }
      let expiryWrites = 0;
      for (const expiryTxn of expiryTransactions) {
        const ref = expiryTxn.type === 'EXPIRY_REFUND' ? expiryRefundRef : expiryForfeitRef;
        const snapshot = expiryTxn.type === 'EXPIRY_REFUND' ? expiryRefundDoc : expiryForfeitDoc;
        if (!snapshot.exists) {
          tx.create(ref, expiryTxn);
          expiryWrites += 1;
        }
      }
      if (refundPaise > 0 && !expiryRefundOutboxDoc.exists) {
        tx.create(
          expiryRefundOutboxRef,
          buildExpiryRefundOutbox({ ...wallet, id: wallet.id || walletId }, refundPaise, timestamp),
        );
      }
      tx.update(walletRef, {
        state: 'EXPIRED',
        currentBalancePaise: 0,
        txnCount: wallet.txnCount + expiryWrites,
        terminatedAt: timestamp,
        terminatedBy: 'system',
        terminatedReason: 'Past termination time',
        lastActivityAt: timestamp,
      });
      return { success: false, code: 'WALLET_EXPIRED', message: 'Wallet has expired' };
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
    if (
      !Number.isSafeInteger(item.amountPaise) ||
      item.amountPaise <= 0 ||
      !Number.isSafeInteger(totalAmountPaise)
    ) {
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
    const totalDebitedPaise = wallet.totalDebitedPaise + totalAmountPaise;
    if (!Number.isSafeInteger(newBalance) || !Number.isSafeInteger(totalDebitedPaise)) {
      return {
        success: false,
        code: 'AMOUNT_CALCULATION_ERROR',
        message: 'Amount calculation error',
      };
    }

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
    tx.create(globalIdempotencyRef, {
      id: idempotencyKey,
      idempotencyKey,
      type: 'DEBIT',
      walletId,
      transactionId: txnId,
      presetItemId,
      quantity,
      amountPaise: totalAmountPaise,
      createdAt: timestamp,
    });
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalDebitedPaise,
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
    supervisorPin,
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
  if (!supervisorPin) {
    return {
      success: false,
      code: 'SUPERVISOR_PIN_REQUIRED',
      message: 'Supervisor PIN is required for reversals',
    };
  }

  const db = getAdminDb();

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const txnRef = walletRef.collection(TXN_SUBCOLLECTION).doc(transactionId);
    const reversalRef = walletRef.collection(TXN_SUBCOLLECTION).doc(`REV-${transactionId}`);
    const walletDoc = await tx.get(walletRef);
    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
    }
    const wallet = walletDoc.data();
    const settingsRef = db.collection('platform_settings').doc(`venue_${wallet.venueId}`);
    const [txnDoc, reversalDoc, settingsDoc] = await Promise.all([
      tx.get(txnRef),
      tx.get(reversalRef),
      tx.get(settingsRef),
    ]);
    if (
      !settingsDoc.exists ||
      !verifySupervisorPinHash(supervisorPin, settingsDoc.data()?.supervisorPinHash)
    ) {
      return {
        success: false,
        code: 'INVALID_SUPERVISOR_PIN',
        message: 'Supervisor PIN is incorrect',
      };
    }

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
    if (reversalDoc.exists) {
      const existing = reversalDoc.data();
      if (
        existing?.type !== 'REVERSAL' ||
        existing?.walletId !== walletId ||
        existing?.reversesTransactionId !== transactionId
      ) {
        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Reversal idempotency record conflicts with the requested transaction',
        };
      }
      return {
        success: true,
        code: 'IDEMPOTENCY_REPLAY',
        transactionId: reversalDoc.id,
        balanceAfterPaise: existing.balanceAfterPaise,
      };
    }
    if (originalTxn.status === 'REVERSED') {
      return {
        success: false,
        code: 'REVERSAL_ARTIFACT_MISSING',
        message: 'Original transaction is reversed without its immutable reversal entry',
      };
    }
    if (originalTxn.walletId !== walletId) {
      return {
        success: false,
        code: 'TRANSACTION_MISMATCH',
        message: 'Transaction does not belong to this wallet',
      };
    }
    if (!['ACTIVE', 'FROZEN'].includes(wallet.state)) {
      return {
        success: false,
        code: 'WALLET_INACTIVE',
        message: `Cannot reverse a transaction for wallet state ${wallet.state}`,
      };
    }
    const terminationMs = new Date(wallet.rules?.terminationTime).getTime();
    if (!Number.isFinite(terminationMs) || Date.now() >= terminationMs) {
      return { success: false, code: 'WALLET_EXPIRED', message: 'Wallet has expired' };
    }
    try {
      assertSafePaise(originalTxn.amountPaise, 'transaction.amountPaise', { positive: true });
      assertSafePaise(wallet.currentBalancePaise, 'wallet.currentBalancePaise');
      assertSafePaise(wallet.totalReversedPaise, 'wallet.totalReversedPaise');
      assertSafePaise(wallet.rules?.maxTotalBalancePaise, 'wallet.rules.maxTotalBalancePaise', {
        positive: true,
      });
      assertSafeInteger(wallet.txnCount, 'wallet.txnCount', { min: 0 });
    } catch {
      return {
        success: false,
        code: 'WALLET_MONEY_INVALID',
        message: 'Wallet monetary state is invalid',
      };
    }

    // Check balance cap (top-up may not exceed maxTotalBalance)
    const newBalance = wallet.currentBalancePaise + originalTxn.amountPaise;
    const totalReversedPaise = wallet.totalReversedPaise + originalTxn.amountPaise;
    if (!Number.isSafeInteger(newBalance) || !Number.isSafeInteger(totalReversedPaise)) {
      return {
        success: false,
        code: 'AMOUNT_CALCULATION_ERROR',
        message: 'Amount calculation error',
      };
    }
    if (newBalance > wallet.rules.maxTotalBalancePaise) {
      return {
        success: false,
        code: 'BALANCE_EXCEEDS_MAX',
        message: `Reversal would exceed max balance ${formatPaise(wallet.rules.maxTotalBalancePaise)}`,
      };
    }

    const reversalId = reversalRef.id;
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

    tx.create(reversalRef, reversalTxn);
    tx.update(txnRef, { status: 'REVERSED', reversedAt: timestamp, reversedBy: operatorId });
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalReversedPaise,
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
  const { walletId, amountPaise, reason, idempotencyKey, supervisorPin, operatorId, operatorRole } =
    req;

  if (!['owner', 'manager', 'host', 'admin', 'super'].includes(operatorRole)) {
    return {
      success: false,
      code: 'INSUFFICIENT_ROLE',
      message: 'Top-up requires host or admin role',
    };
  }
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
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
  if (!supervisorPin) {
    return {
      success: false,
      code: 'SUPERVISOR_PIN_REQUIRED',
      message: 'Supervisor PIN is required for top-up',
    };
  }

  const db = getAdminDb();

  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const txnRef = walletRef.collection(TXN_SUBCOLLECTION).doc(`TOPUP-${idempotencyKey}`);
    const globalIdempotencyRef = db.collection('cover_wallet_idempotency').doc(idempotencyKey);
    const walletDoc = await tx.get(walletRef);
    if (!walletDoc.exists) {
      return { success: false, code: 'WALLET_NOT_FOUND', message: 'Wallet not found' };
    }
    const wallet = walletDoc.data();
    const settingsRef = db.collection('platform_settings').doc(`venue_${wallet.venueId}`);
    const [idempotencyDoc, globalIdempotencyDoc, settingsDoc] = await Promise.all([
      tx.get(txnRef),
      tx.get(globalIdempotencyRef),
      tx.get(settingsRef),
    ]);
    if (
      !settingsDoc.exists ||
      !verifySupervisorPinHash(supervisorPin, settingsDoc.data()?.supervisorPinHash)
    ) {
      return {
        success: false,
        code: 'INVALID_SUPERVISOR_PIN',
        message: 'Supervisor PIN is incorrect',
      };
    }

    // --- Idempotency check ---
    if (idempotencyDoc.exists || globalIdempotencyDoc.exists) {
      if (!idempotencyDoc.exists || !globalIdempotencyDoc.exists) {
        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Cover Wallet idempotency artifacts are incomplete',
        };
      }
      const existing = { id: idempotencyDoc.id, ...idempotencyDoc.data() };
      const globalMarker = globalIdempotencyDoc.data();
      if (
        existing.type !== 'TOP_UP' ||
        existing.idempotencyKey !== idempotencyKey ||
        existing.walletId !== walletId ||
        existing.amountPaise !== amountPaise ||
        globalMarker.idempotencyKey !== idempotencyKey ||
        globalMarker.type !== 'TOP_UP' ||
        globalMarker.walletId !== walletId ||
        globalMarker.transactionId !== existing.id ||
        globalMarker.amountPaise !== amountPaise
      ) {
        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotencyKey is already linked to a different wallet mutation',
        };
      }
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
    const topUpBy = wallet.rules.topUpBy;
    const topUpPolicyAllowsRole =
      topUpBy === 'host'
        ? ['owner', 'manager', 'host', 'admin', 'super'].includes(operatorRole)
        : topUpBy === 'admin'
          ? ['admin', 'super'].includes(operatorRole)
          : false;
    if (!topUpPolicyAllowsRole) {
      return {
        success: false,
        code: 'TOP_UP_POLICY_DENIED',
        message: `Wallet top-up policy does not authorize role: ${operatorRole}`,
      };
    }
    if (wallet.state !== 'ACTIVE') {
      return {
        success: false,
        code: 'WALLET_INACTIVE',
        message: `Cannot top-up wallet in state: ${wallet.state}`,
      };
    }
    const terminationMs = new Date(wallet.rules?.terminationTime).getTime();
    if (!Number.isFinite(terminationMs) || Date.now() >= terminationMs) {
      return { success: false, code: 'WALLET_EXPIRED', message: 'Wallet has expired' };
    }
    try {
      assertSafePaise(wallet.currentBalancePaise, 'wallet.currentBalancePaise');
      assertSafePaise(wallet.totalCreditedPaise, 'wallet.totalCreditedPaise');
      assertSafePaise(wallet.rules?.maxTopUpAmountPaise, 'wallet.rules.maxTopUpAmountPaise');
      assertSafePaise(wallet.rules?.maxTotalBalancePaise, 'wallet.rules.maxTotalBalancePaise', {
        positive: true,
      });
      assertSafeInteger(wallet.txnCount, 'wallet.txnCount', { min: 0 });
    } catch {
      return {
        success: false,
        code: 'WALLET_MONEY_INVALID',
        message: 'Wallet monetary state is invalid',
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
    const totalCreditedPaise = wallet.totalCreditedPaise + amountPaise;
    if (!Number.isSafeInteger(newBalance) || !Number.isSafeInteger(totalCreditedPaise)) {
      return {
        success: false,
        code: 'AMOUNT_CALCULATION_ERROR',
        message: 'Amount calculation error',
      };
    }
    if (newBalance > wallet.rules.maxTotalBalancePaise) {
      return {
        success: false,
        code: 'BALANCE_EXCEEDS_MAX',
        message: `Top-up would exceed maximum balance ${formatPaise(wallet.rules.maxTotalBalancePaise)}`,
      };
    }

    const txnId = txnRef.id;
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

    tx.create(txnRef, txn);
    tx.create(globalIdempotencyRef, {
      id: idempotencyKey,
      idempotencyKey,
      type: 'TOP_UP',
      walletId,
      transactionId: txnId,
      amountPaise,
      createdAt: timestamp,
    });
    tx.update(walletRef, {
      currentBalancePaise: newBalance,
      totalCreditedPaise,
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
  const eventRef = db
    .collection('cover_wallet_state_events')
    .doc(`FREEZE-${randomUUID().replace(/-/g, '').toUpperCase()}`);
  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const walletDoc = await tx.get(walletRef);
    if (!walletDoc.exists) return { success: false, code: 'WALLET_NOT_FOUND' };
    const wallet = walletDoc.data();
    if (wallet.state === 'FROZEN') return { success: true, code: 'IDEMPOTENCY_REPLAY' };
    if (wallet.state !== 'ACTIVE') {
      return {
        success: false,
        code: 'WALLET_INACTIVE',
        message: `Cannot freeze wallet in state ${wallet.state}`,
      };
    }
    const terminationMs = new Date(wallet.rules?.terminationTime).getTime();
    if (!Number.isFinite(terminationMs) || Date.now() >= terminationMs) {
      return { success: false, code: 'WALLET_EXPIRED', message: 'Wallet has expired' };
    }
    tx.update(walletRef, {
      state: 'FROZEN',
      frozenAt: now,
      frozenBy,
      frozenReason: reason,
      lastActivityAt: now,
    });
    tx.create(eventRef, {
      id: eventRef.id,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      fromState: 'ACTIVE',
      toState: 'FROZEN',
      actorId: frozenBy,
      reason,
      createdAt: now,
    });
    return { success: true };
  });
}

export async function unfreezeWallet(walletId, unfrozenBy, reason = 'SUPERVISOR_UNFREEZE') {
  const db = getAdminDb();
  const now = new Date().toISOString();
  const eventRef = db
    .collection('cover_wallet_state_events')
    .doc(`UNFREEZE-${randomUUID().replace(/-/g, '').toUpperCase()}`);
  return await db.runTransaction(async (tx) => {
    const walletRef = db.collection(WALLET_COLLECTION).doc(walletId);
    const walletDoc = await tx.get(walletRef);
    if (!walletDoc.exists) return { success: false, code: 'WALLET_NOT_FOUND' };
    const wallet = walletDoc.data();
    if (wallet.state !== 'FROZEN') {
      return {
        success: false,
        code: 'NOT_FROZEN',
        message: `Wallet is ${wallet.state}, not FROZEN`,
      };
    }
    const terminationMs = new Date(wallet.rules?.terminationTime).getTime();
    if (!Number.isFinite(terminationMs) || Date.now() >= terminationMs) {
      return { success: false, code: 'WALLET_EXPIRED', message: 'Wallet has expired' };
    }
    tx.update(walletRef, {
      state: 'ACTIVE',
      unfrozenAt: now,
      unfrozenBy,
      lastActivityAt: now,
    });
    tx.create(eventRef, {
      id: eventRef.id,
      walletId,
      eventId: wallet.eventId,
      venueId: wallet.venueId,
      fromState: 'FROZEN',
      toState: 'ACTIVE',
      actorId: unfrozenBy,
      reason,
      createdAt: now,
    });
    return { success: true };
  });
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
export async function terminateExpiredWallets(
  eventId,
  { db = getAdminDb(), now = new Date() } = {},
) {
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
      const terminationTime = new Date(
        Number.isSafeInteger(wallet.terminationAtMs)
          ? wallet.terminationAtMs
          : wallet.rules.terminationTime,
      );
      if (now < terminationTime) continue; // Not yet due

      const didTerminate = await db.runTransaction(async (tx) => {
        // Re-read inside transaction
        const fresh = await tx.get(walletDoc.ref);
        if (!fresh.exists || fresh.data().state !== 'ACTIVE') return false;

        const w = { ...fresh.data(), id: fresh.data().id || fresh.id };
        const timestamp = now.toISOString();
        const expiryTransactions = buildExpiryTransactions(w, timestamp);
        const expiryRefs = expiryTransactions.map((entry) =>
          walletDoc.ref.collection(TXN_SUBCOLLECTION).doc(entry.id),
        );
        const refundPaise = expiryTransactions
          .filter((entry) => entry.type === 'EXPIRY_REFUND')
          .reduce((sum, entry) => sum + entry.amountPaise, 0);
        const outboxRef =
          refundPaise > 0
            ? db.collection('domain_event_outbox').doc(`cover-wallet-expiry-refund-${w.id}`)
            : null;
        const [expirySnapshots, outboxDoc] = await Promise.all([
          Promise.all(expiryRefs.map((ref) => tx.get(ref))),
          outboxRef ? tx.get(outboxRef) : Promise.resolve(null),
        ]);
        if (outboxDoc?.exists) {
          const existingOutbox = outboxDoc.data();
          if (existingOutbox?.walletId !== w.id || existingOutbox?.amountPaise !== refundPaise) {
            throw new Error('Wallet expiry refund outbox conflicts with calculated refund');
          }
        }
        let expiryWrites = 0;
        expiryTransactions.forEach((entry, index) => {
          if (!expirySnapshots[index].exists) {
            tx.create(expiryRefs[index], entry);
            expiryWrites += 1;
          }
        });

        if (refundPaise > 0 && outboxRef && !outboxDoc?.exists) {
          tx.create(outboxRef, buildExpiryRefundOutbox(w, refundPaise, timestamp));
        }

        tx.update(walletDoc.ref, {
          state: 'EXPIRED',
          currentBalancePaise: 0,
          txnCount: Number(w.txnCount || 0) + expiryWrites,
          terminatedAt: timestamp,
          terminatedBy: 'system',
          terminatedReason: `Automatic expiry at ${wallet.rules.terminationTime}`,
          lastActivityAt: timestamp,
        });
        return true;
      });

      if (didTerminate) terminated++;
    } catch (err) {
      errors.push(`wallet ${wallet.id}: ${err.message}`);
    }
  }

  return { terminated, errors };
}

/**
 * Find due ACTIVE wallets across events, then apply the same atomic event
 * termination workflow. A numeric timestamp avoids timezone-string ordering
 * errors in the scheduler query.
 */
export async function terminateDueCoverWallets({
  db = getAdminDb(),
  now = new Date(),
  limit = 100,
} = {}) {
  const boundedLimit = assertSafeInteger(limit, 'limit', { min: 1, max: 500 });
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs)) throw new Error('now must be a valid Date');

  const dueSnapshot = await db
    .collection(WALLET_COLLECTION)
    .where('state', '==', 'ACTIVE')
    .where('terminationAtMs', '<=', nowMs)
    .limit(boundedLimit)
    .get();
  const eventIds = [
    ...new Set(
      dueSnapshot.docs
        .map((document) => document.data()?.eventId)
        .filter((eventId) => typeof eventId === 'string' && eventId.length > 0),
    ),
  ];
  const results = [];
  for (const eventId of eventIds) {
    const result = await terminateExpiredWallets(eventId, { db, now });
    results.push({ eventId, ...result });
  }

  return {
    dueWallets: dueSnapshot.size,
    eventsProcessed: eventIds.length,
    terminated: results.reduce((sum, result) => sum + result.terminated, 0),
    failed: results.reduce((sum, result) => sum + result.errors.length, 0),
    results,
    hasMore: dueSnapshot.size === boundedLimit,
  };
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
export function reconcileCoverWallet(walletId, wallet, transactions) {
  const exceptions = [];
  const seenIdempotencyKeys = new Set();
  const debitsById = new Map();
  const reversalsByOriginalId = new Map();
  const itemDistribution = new Map();
  let computedDebitedPaise = 0;
  let computedCreditedPaise = 0;
  let computedReversedPaise = 0;
  let expiredRefundPaise = 0;
  let expiredForfeitPaise = 0;
  let refundTerminatedPaise = 0;

  const addException = (type, description) => {
    exceptions.push({ type, walletId, description });
  };
  const addMoney = (current, amount, field) => {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      addException('INVALID_AMOUNT', `${field} is not a positive safe integer: ${amount}`);
      return current;
    }
    const next = current + amount;
    if (!Number.isSafeInteger(next)) {
      addException('INVALID_AMOUNT', `${field} overflowed safe integer precision`);
      return current;
    }
    return next;
  };

  for (const raw of transactions) {
    const txn = { ...raw, id: raw.id || raw.transactionId };
    if (txn.idempotencyKey && seenIdempotencyKeys.has(txn.idempotencyKey)) {
      addException('DUPLICATE_IDEMPOTENCY', `Duplicate idempotencyKey: ${txn.idempotencyKey}`);
    }
    if (txn.idempotencyKey) seenIdempotencyKeys.add(txn.idempotencyKey);

    switch (txn.type) {
      case 'DEBIT': {
        computedDebitedPaise = addMoney(
          computedDebitedPaise,
          txn.amountPaise,
          `${txn.id}.amountPaise`,
        );
        debitsById.set(txn.id, txn);
        const itemId = String(txn.presetItemId || 'unknown');
        const row = itemDistribution.get(itemId) || {
          itemId,
          name: txn.presetItemName || 'Unknown item',
          count: 0,
          totalPaise: 0,
        };
        row.count += Number.isSafeInteger(txn.quantity) && txn.quantity > 0 ? txn.quantity : 1;
        row.totalPaise += Number.isSafeInteger(txn.amountPaise) ? txn.amountPaise : 0;
        itemDistribution.set(itemId, row);
        break;
      }
      case 'REVERSAL':
        computedReversedPaise = addMoney(
          computedReversedPaise,
          txn.amountPaise,
          `${txn.id}.amountPaise`,
        );
        if (!txn.reversesTransactionId) {
          addException('UNMATCHED_REVERSAL', `${txn.id} has no reversesTransactionId`);
        } else {
          reversalsByOriginalId.set(txn.reversesTransactionId, txn);
        }
        break;
      case 'TOP_UP':
      case 'CREDIT':
        computedCreditedPaise = addMoney(
          computedCreditedPaise,
          txn.amountPaise,
          `${txn.id}.amountPaise`,
        );
        break;
      case 'EXPIRY_REFUND':
        expiredRefundPaise = addMoney(expiredRefundPaise, txn.amountPaise, `${txn.id}.amountPaise`);
        break;
      case 'EXPIRY_FORFEIT':
        expiredForfeitPaise = addMoney(
          expiredForfeitPaise,
          txn.amountPaise,
          `${txn.id}.amountPaise`,
        );
        break;
      case 'REFUND_TERMINATION':
        refundTerminatedPaise = addMoney(
          refundTerminatedPaise,
          txn.amountPaise,
          `${txn.id}.amountPaise`,
        );
        break;
      default:
        addException('UNKNOWN_TRANSACTION_TYPE', `Unknown transaction type: ${txn.type}`);
    }
  }

  for (const [originalId, reversal] of reversalsByOriginalId.entries()) {
    const original = debitsById.get(originalId);
    if (!original || original.amountPaise !== reversal.amountPaise) {
      addException(
        'UNMATCHED_REVERSAL',
        `${reversal.id} does not exactly reverse debit ${originalId}`,
      );
      continue;
    }
    const itemId = String(original.presetItemId || 'unknown');
    const row = itemDistribution.get(itemId);
    if (row) {
      row.count -=
        Number.isSafeInteger(original.quantity) && original.quantity > 0 ? original.quantity : 1;
      row.totalPaise -= original.amountPaise;
    }
  }
  for (const [debitId, debit] of debitsById.entries()) {
    if (debit.status === 'REVERSED' && !reversalsByOriginalId.has(debitId)) {
      addException(
        'UNMATCHED_REVERSAL',
        `${debitId} is marked REVERSED without an immutable reversal transaction`,
      );
    }
  }

  const openingPaise = Number(wallet.openingBalancePaise);
  const closingPaise = Number(wallet.currentBalancePaise);
  const expiredBalancePaise = expiredRefundPaise + expiredForfeitPaise;
  const terminalAdjustmentPaise = expiredBalancePaise + refundTerminatedPaise;
  const consumedPaise = computedDebitedPaise - computedReversedPaise;
  const expectedClosingPaise =
    openingPaise +
    computedCreditedPaise -
    computedDebitedPaise +
    computedReversedPaise -
    terminalAdjustmentPaise;
  const reconciliationDifferencePaise =
    openingPaise + computedCreditedPaise - consumedPaise - terminalAdjustmentPaise - closingPaise;

  for (const [field, value] of [
    ['openingBalancePaise', openingPaise],
    ['currentBalancePaise', closingPaise],
    ['totalDebitedPaise', wallet.totalDebitedPaise],
    ['totalCreditedPaise', wallet.totalCreditedPaise],
    ['totalReversedPaise', wallet.totalReversedPaise],
    ['txnCount', wallet.txnCount],
  ]) {
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) {
      addException('INVALID_AMOUNT', `wallet.${field} is invalid: ${value}`);
    }
  }
  if (computedReversedPaise > computedDebitedPaise) {
    addException('BALANCE_MISMATCH', 'Reversed value exceeds total debited value');
  }
  if (expectedClosingPaise !== closingPaise || reconciliationDifferencePaise !== 0) {
    addException(
      'BALANCE_MISMATCH',
      `Expected closing balance ${expectedClosingPaise}, stored ${closingPaise}, difference ${reconciliationDifferencePaise}`,
    );
  }
  for (const [field, stored, computed] of [
    ['totalDebitedPaise', wallet.totalDebitedPaise, computedDebitedPaise],
    ['totalCreditedPaise', wallet.totalCreditedPaise, computedCreditedPaise],
    ['totalReversedPaise', wallet.totalReversedPaise, computedReversedPaise],
    ['txnCount', wallet.txnCount, transactions.length],
  ]) {
    if (Number(stored) !== computed) {
      addException('COUNTER_MISMATCH', `Stored ${field} ${stored} != computed ${computed}`);
    }
  }
  if (
    ['EXPIRED', 'TERMINATED'].includes(wallet.state) &&
    (closingPaise !== 0 || expectedClosingPaise !== 0)
  ) {
    addException('BALANCE_MISMATCH', `${wallet.state} wallet must reconcile to zero`);
  }

  return {
    row: {
      walletId,
      userId: wallet.userId,
      orderId: wallet.orderId,
      openingPaise,
      debitedPaise: computedDebitedPaise,
      creditedPaise: computedCreditedPaise,
      reversedPaise: computedReversedPaise,
      expiredRefundPaise,
      expiredForfeitPaise,
      refundTerminatedPaise,
      terminalAdjustmentPaise,
      closingPaise,
      reconciliationDifferencePaise,
      terminationReason: wallet.terminatedReason || 'N/A',
      txnCount: transactions.length,
      state: wallet.state,
    },
    totals: {
      openingBalancePaise: openingPaise,
      totalDebitedPaise: computedDebitedPaise,
      totalCreditedPaise: computedCreditedPaise,
      totalReversedPaise: computedReversedPaise,
      expiredRefundPaise,
      expiredForfeitPaise,
      expiredBalancePaise,
      refundTerminatedPaise,
      terminalAdjustmentPaise,
      consumedBalancePaise: consumedPaise,
      closingBalancePaise: closingPaise,
      reconciliationDifferencePaise,
    },
    itemDistribution: [...itemDistribution.values()].filter(
      (item) => item.count > 0 || item.totalPaise > 0,
    ),
    exceptions,
  };
}

export async function generateReconciliation(eventId, venueId) {
  if (!eventId || !venueId) throw new Error('eventId and venueId are required');
  const db = getAdminDb();
  const walletsSnap = await db
    .collection(WALLET_COLLECTION)
    .where('eventId', '==', eventId)
    .where('venueId', '==', venueId)
    .get();

  const exceptions = [];
  const walletRows = [];
  const itemDistribution = new Map();
  const totals = {
    openingBalancePaise: 0,
    totalDebitedPaise: 0,
    totalCreditedPaise: 0,
    totalReversedPaise: 0,
    expiredRefundPaise: 0,
    expiredForfeitPaise: 0,
    expiredBalancePaise: 0,
    refundTerminatedPaise: 0,
    terminalAdjustmentPaise: 0,
    consumedBalancePaise: 0,
    closingBalancePaise: 0,
    reconciliationDifferencePaise: 0,
  };

  for (const walletDoc of walletsSnap.docs) {
    const wallet = { id: walletDoc.id, ...walletDoc.data() };
    const txnsSnap = await walletDoc.ref.collection(TXN_SUBCOLLECTION).get();
    const transactions = txnsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const result = reconcileCoverWallet(walletDoc.id, wallet, transactions);
    walletRows.push(result.row);
    exceptions.push(...result.exceptions);
    for (const key of Object.keys(totals)) {
      const next = totals[key] + result.totals[key];
      if (!Number.isSafeInteger(next)) {
        exceptions.push({
          type: 'INVALID_AMOUNT',
          walletId: walletDoc.id,
          description: `Reconciliation total ${key} overflowed safe integer precision`,
        });
      } else {
        totals[key] = next;
      }
    }
    for (const item of result.itemDistribution) {
      const existing = itemDistribution.get(item.itemId) || {
        itemId: item.itemId,
        name: item.name,
        count: 0,
        totalPaise: 0,
      };
      existing.count += item.count;
      existing.totalPaise += item.totalPaise;
      itemDistribution.set(item.itemId, existing);
    }
  }

  const now = new Date().toISOString();
  const reconciliationId = `${venueId}_${eventId}`;
  const reconciliation = {
    id: reconciliationId,
    eventId,
    venueId,
    schemaVersion: 2,
    generatedAt: now,
    periodStartsAt:
      walletsSnap.docs
        .map((doc) => doc.data()?.issuedAt)
        .filter(Boolean)
        .sort()[0] || now,
    periodEndsAt: now,
    summary: {
      walletsIssued: walletsSnap.size,
      walletsTerminated: walletsSnap.docs.filter((doc) =>
        ['EXPIRED', 'TERMINATED'].includes(doc.data().state),
      ).length,
      ...totals,
      netVenueConsumedValuePaise: totals.consumedBalancePaise,
      netVenueForfeitedValuePaise: totals.expiredForfeitPaise,
      exceptionList: exceptions,
    },
    itemDistribution: [...itemDistribution.values()].sort(
      (left, right) => right.totalPaise - left.totalPaise,
    ),
    wallets: walletRows,
  };

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
 * @param {string} walletId - retained for call compatibility; velocity is device-wide
 * @param {number} maxPerMinute
 * @param {string} idempotencyKey
 * @returns {Promise<boolean>}
 */
export async function checkAndIncrementVelocity(
  redis,
  deviceId,
  walletId,
  maxPerMinute = 3,
  idempotencyKey,
) {
  if (!redis || !deviceId || !walletId || !idempotencyKey) {
    throw new Error(
      'Redis, deviceId, walletId, and idempotencyKey are required for debit velocity',
    );
  }
  assertSafeInteger(maxPerMinute, 'maxPerMinute', { min: 1, max: 3 });
  const key = `cwv:${deviceId}`;
  const member = `${walletId}:${idempotencyKey}`;
  const now = Date.now();
  const lua = `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
      redis.call('PEXPIRE', KEYS[1], 90000)
      return 1
    end
    local count = redis.call('ZCARD', KEYS[1])
    if count >= tonumber(ARGV[2]) then
      return 0
    end
    redis.call('ZADD', KEYS[1], ARGV[4], ARGV[3])
    redis.call('PEXPIRE', KEYS[1], 90000)
    return 1
  `;
  const result = await redis.eval(
    lua,
    1,
    key,
    String(now - 60_000),
    String(maxPerMinute),
    member,
    String(now),
  );
  return Number(result) === 1;
}

// =============================================================================
// SUPERVISOR PIN (stored per-venue in platform_settings)
// =============================================================================

/**
 * Hash a supervisor PIN with a random salt for storage in
 * platform_settings/venue_{venueId}.supervisorPinHash. The raw PIN is sent
 * only over authenticated TLS and is never stored.
 *
 * @param {string} pin
 * @param {{salt?: Buffer}} [options]
 * @returns {string}
 */
export function hashSupervisorPin(pin, { salt = randomBytes(16) } = {}) {
  const normalized = String(pin || '');
  if (!/^\d{4,12}$/.test(normalized)) {
    throw new Error('Supervisor PIN must contain 4 to 12 digits');
  }
  const derived = scryptSync(normalized, salt, 32, {
    N: 8192,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt-v1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

/**
 * Verify a supervisor PIN against the server-owned salted hash for the
 * wallet's venue. Unknown or legacy hash formats fail closed.
 *
 * @param {string} submittedPin
 * @param {string} walletId
 * @returns {Promise<boolean>}
 */
export function verifySupervisorPinHash(submittedPin, storedHash) {
  if (!/^\d{4,12}$/.test(String(submittedPin || ''))) return false;
  const [version, saltEncoded, expectedEncoded, extra] = String(storedHash || '').split('$');
  if (version !== 'scrypt-v1' || !saltEncoded || !expectedEncoded || extra) return false;

  try {
    const salt = Buffer.from(saltEncoded, 'base64url');
    const expected = Buffer.from(expectedEncoded, 'base64url');
    if (salt.length !== 16 || expected.length !== 32) return false;
    const submitted = scryptSync(String(submittedPin), salt, expected.length, {
      N: 8192,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(expected, submitted);
  } catch {
    return false;
  }
}

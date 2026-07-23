/**
 * Scanner API unit tests
 * Uses jest-fetch-mock — no real network calls
 */

import {
  validateEventCode,
  processQRScan,
  cacheCheck,
  cacheAdd,
  cacheClear,
  fetchWalletByOrder,
  fetchWalletByPaymentQr,
  submitDebit,
  manualCheckIn,
} from '../../lib/scanner/api';

// fetchMock is globally available via jest-fetch-mock/setupJest
declare const fetchMock: any;

const MOCK_SESSION_TOKEN = 'mock-session-token-32chars-padded';

const MOCK_EVENT_DATA = {
  valid: true,
  code: 'TEST-CODE',
  codeId: 'code_123',
  sessionToken: MOCK_SESSION_TOKEN,
  sessionExpiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
  event: {
    id: 'evt_123',
    title: 'Test Event',
    venue: 'Test Venue',
    venueId: 'venue_123',
    date: '2026-03-23',
    startTime: '22:00',
    endTime: '04:00',
    capacity: 500,
  },
  permissions: { canScan: true, canDoorEntry: true, canWalkIn: true, canCharge: false },
  tiers: [{ id: 'tier_1', name: 'Stag Entry', price: 500, entryType: 'stag', available: true }],
  gate: 'Main Gate',
  stats: { totalEntered: 100, prebooked: 80, doorEntries: 20, doorRevenue: 10000 },
};

beforeEach(() => {
  fetchMock.resetMocks();
  cacheClear();
});

// ── validateEventCode ──────────────────────────────────────────────────────

describe('validateEventCode', () => {
  it('returns valid ScannerEventData + sessionToken on 200', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(MOCK_EVENT_DATA), { status: 200 });
    const result = await validateEventCode('TEST-CODE');
    expect(result.valid).toBe(true);
    expect(result.sessionToken).toBe(MOCK_SESSION_TOKEN);
    expect(result.event.id).toBe('evt_123');
  });

  it('returns valid=false on 404 (unknown code)', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Invalid event code' }), { status: 404 });
    const result = await validateEventCode('BAD-CODE');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid event code');
  });

  it('converts a structured gateway error into render-safe text', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Invalid event code',
          requestId: 'req_scanner_1',
        },
      }),
      { status: 404 },
    );

    const result = await validateEventCode('BAD-CODE');

    expect(result).toMatchObject({ valid: false, error: 'Invalid event code' });
    expect(typeof result.error).toBe('string');
  });

  it('returns valid=false on 403 (revoked code)', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Code revoked' }), { status: 403 });
    const result = await validateEventCode('REVOKED-CODE');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Code revoked');
  });

  it('falls back to mock data in __DEV__', async () => {
    fetchMock.mockRejectOnce(new Error('Network failure'));
    const result = await validateEventCode('MOCK-CODE');
    // In __DEV__, getMockEventData returns valid=true
    expect(result.valid).toBe(true);
    expect(result.sessionToken).toBe('mock-session-token-dev');
  });

  it('sends correct Content-Type and POST body', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(MOCK_EVENT_DATA), { status: 200 });
    await validateEventCode('TEST-CODE');
    const calls = fetchMock.mock.calls;
    expect(calls[0][1].method).toBe('POST');
    expect(calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0][1].body)).toEqual({ code: 'TEST-CODE' });
  });
});

// ── processQRScan ──────────────────────────────────────────────────────────

const MOCK_QR = JSON.stringify({ o: 'order_1', e: 'evt_123', t: 'tkt_1' });
const MOCK_SCAN_REQ = {
  qrData: MOCK_QR,
  eventId: 'evt_123',
  eventCode: 'TEST-CODE',
  gate: 'Main',
};

describe('processQRScan', () => {
  it('instant already_scanned from local cache (0 fetch calls)', async () => {
    const key = `${MOCK_SCAN_REQ.eventId}:${MOCK_SCAN_REQ.qrData}`;
    cacheAdd(key, 'valid');
    const result = await processQRScan(MOCK_SCAN_REQ);
    expect(result.result).toBe('already_scanned');
    expect(fetchMock.mock.calls.length).toBe(0);
  });

  it('posts to SCAN_API with correct body', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: true,
        result: 'valid',
        scanId: 'scan_1',
        ticket: { userName: 'Test', quantity: 1, entryType: 'stag' },
      }),
      { status: 200 },
    );
    await processQRScan(MOCK_SCAN_REQ);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.qrData).toBe(MOCK_QR);
    expect(body.eventId).toBe('evt_123');
    expect(body.scannedBy.role).toBe('door_staff');
  });

  it('adds to cache on valid result', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true, result: 'valid' }), { status: 200 });
    await processQRScan(MOCK_SCAN_REQ);
    const key = `${MOCK_SCAN_REQ.eventId}:${MOCK_SCAN_REQ.qrData}`;
    expect(cacheCheck(key)?.result).toBe('valid');
  });

  it('does NOT add to cache on invalid result', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ result: 'invalid', error: 'Bad sig' }), {
      status: 400,
    });
    await processQRScan(MOCK_SCAN_REQ);
    const key = `${MOCK_SCAN_REQ.eventId}:${MOCK_SCAN_REQ.qrData}`;
    expect(cacheCheck(key)).toBeNull();
  });

  it('returns network_error on fetch rejection', async () => {
    cacheClear();
    (global as any).__DEV__ = false; // disable DEV fallback to test real network_error path
    fetchMock.mockRejectOnce(new Error('Network down'));
    const result = await processQRScan(MOCK_SCAN_REQ);
    (global as any).__DEV__ = true;
    expect(result.result).toBe('network_error');
  });
});

// ── cacheCheck / cacheAdd / cacheClear ────────────────────────────────────

describe('cache operations', () => {
  it('returns null for unknown key', () => {
    expect(cacheCheck('nonexistent:key')).toBeNull();
  });

  it('cacheClear empties map', () => {
    cacheAdd('test:key', 'valid');
    expect(cacheCheck('test:key')).not.toBeNull();
    cacheClear();
    expect(cacheCheck('test:key')).toBeNull();
  });
});

// ── fetchWalletByOrder ────────────────────────────────────────────────────

const MOCK_WALLET = {
  id: 'wallet_1',
  orderId: 'order_1',
  eventId: 'evt_123',
  venueId: 'venue_123',
  currentBalancePaise: 50000,
  openingBalancePaise: 100000,
  totalDebitedPaise: 50000,
  guestFirstName: 'Arjun',
  state: 'ACTIVE',
  terminationTime: null,
  paymentQrJwt: 'wallet.jwt.token',
  rules: {
    allowedPresetItems: [],
    showBalanceToGuest: true,
    maxChargeAmountPaise: 0,
    minChargeAmountPaise: 0,
  },
};

describe('fetchWalletByOrder', () => {
  it('sends Authorization: Bearer {sessionToken}', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ wallet: MOCK_WALLET }), { status: 200 });
    await fetchWalletByOrder('order_1', MOCK_SESSION_TOKEN);
    const headers = fetchMock.mock.calls[0][1]?.headers;
    expect(headers?.Authorization).toBe(`Bearer ${MOCK_SESSION_TOKEN}`);
  });

  it('calls /wallet/by-order/{orderId}', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ wallet: MOCK_WALLET }), { status: 200 });
    await fetchWalletByOrder('order_1', MOCK_SESSION_TOKEN);
    expect(fetchMock.mock.calls[0][0]).toContain('/wallet/by-order/order_1');
  });

  it('returns { error } on 404', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'No active wallet' }), { status: 404 });
    const result = await fetchWalletByOrder('missing', MOCK_SESSION_TOKEN);
    expect('error' in result).toBe(true);
  });

  it('returns { wallet } on 200', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ wallet: MOCK_WALLET }), { status: 200 });
    const result = await fetchWalletByOrder('order_1', MOCK_SESSION_TOKEN);
    if ('wallet' in result) {
      expect(result.wallet.id).toBe('wallet_1');
    } else {
      fail('Expected wallet result');
    }
  });

  it('returns { error: network error } on fetch rejection', async () => {
    fetchMock.mockRejectOnce(new Error('Network failure'));
    const result = await fetchWalletByOrder('order_1', MOCK_SESSION_TOKEN);
    expect('error' in result).toBe(true);
  });
});

describe('fetchWalletByPaymentQr', () => {
  it('posts the rotating payment QR to /scan/wallet-qr', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ wallet: MOCK_WALLET }), { status: 200 });
    await fetchWalletByPaymentQr('wallet.jwt.token', MOCK_SESSION_TOKEN, {
      eventId: 'evt_123',
      eventCode: 'TEST-CODE',
      venueId: 'venue_123',
    });
    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain('/scan/wallet-qr');
    expect(options.headers.Authorization).toBe(`Bearer ${MOCK_SESSION_TOKEN}`);
    expect(body.qrData).toBe('wallet.jwt.token');
    expect(body.eventId).toBe('evt_123');
  });

  it('normalizes the returned wallet context', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ wallet: MOCK_WALLET }), { status: 200 });
    const result = await fetchWalletByPaymentQr('wallet.jwt.token', MOCK_SESSION_TOKEN);
    if ('wallet' in result) {
      expect(result.wallet.paymentQrJwt).toBe('wallet.jwt.token');
      expect(result.wallet.guestFirstName).toBe('Arjun');
    } else {
      fail('Expected wallet result');
    }
  });
});

// ── submitDebit ───────────────────────────────────────────────────────────

const MOCK_DEBIT_REQ = {
  walletId: 'wallet_1',
  paymentQrJwt: 'wallet.jwt.token',
  presetItemId: 'item_1',
  quantity: 1,
  idempotencyKey: 'test-uuid-1234',
  operatorId: 'scanner_code',
  operatorName: 'Scanner',
  deviceId: 'ios-test-device',
  eventCodeId: 'code_123',
  isOnline: true as const,
};

describe('submitDebit', () => {
  it('POSTs to /debit with idempotencyKey', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true, balanceAfterPaise: 40000 }), {
      status: 200,
    });
    await submitDebit(MOCK_DEBIT_REQ, MOCK_SESSION_TOKEN);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.idempotencyKey).toBe('test-uuid-1234');
  });

  it('returns { success, balanceAfterPaise } on 200', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: true,
        balanceAfterPaise: 40000,
        receipt: { itemName: 'Beer', amountPaise: 10000 },
      }),
      { status: 200 },
    );
    const result = await submitDebit(MOCK_DEBIT_REQ, MOCK_SESSION_TOKEN);
    expect(result.success).toBe(true);
    expect(result.balanceAfterPaise).toBe(40000);
  });

  it('returns { success: false, error } on 400', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ success: false, message: 'Insufficient balance' }),
      { status: 400 },
    );
    const result = await submitDebit(MOCK_DEBIT_REQ, MOCK_SESSION_TOKEN);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });

  it('returns { success: false } on network error', async () => {
    fetchMock.mockRejectOnce(new Error('Network failure'));
    const result = await submitDebit(MOCK_DEBIT_REQ, MOCK_SESSION_TOKEN);
    expect(result.success).toBe(false);
  });
});

// ── manualCheckIn ─────────────────────────────────────────────────────────

describe('manualCheckIn', () => {
  it('POSTs orderId, eventId, eventCode to /guestlist/check-in', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 });
    await manualCheckIn('order_1', 'evt_123', 'TEST-CODE');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ orderId: 'order_1', eventId: 'evt_123', eventCode: 'TEST-CODE' });
  });

  it('returns { success: false, error } on 403', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ error: 'Invalid event code' }), { status: 403 });
    const result = await manualCheckIn('order_1', 'evt_123', 'BAD-CODE');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid event code');
  });
});

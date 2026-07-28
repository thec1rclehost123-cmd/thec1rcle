import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';

dotenv.config({
  path: [
    'thec1rcle.nosync/apps/api-gateway/.env.development',
    'thec1rcle.nosync/apps/partner-dashboard/.env.development',
  ],
  quiet: true,
});

const gatewayUrl = process.env.QA_GATEWAY_URL ?? 'http://127.0.0.1:4000';
const eventId = process.env.QA_EVENT_ID ?? 'd6b896a2-9f8c-4c27-89f1-33930aab64bd';
const tierId = process.env.QA_TIER_ID ?? 'ga';
const confirmedOrderId = process.env.QA_CONFIRMED_ORDER_ID ?? 'ORD-MS3Q38PY-74C1D';
const email = process.env.QA_GUEST_EMAIL ?? 'qa_guest_2026@test.c1rcle.com';
const password = process.env.QA_GUEST_PASSWORD ?? 'TestPass123!';
const firebaseApiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
  process.env.FIREBASE_API_KEY ??
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const runLabel = String(process.env.QA_RUN_LABEL || 'phase1-20260728')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '-');
const outputDir = new URL(`./commerce-api-${runLabel}/`, import.meta.url);
const timeoutMs = Number(process.env.QA_COMMERCE_TIMEOUT_MS ?? 30_000);

if (!firebaseApiKey) throw new Error('Firebase API key is required');
await mkdir(outputDir, { recursive: true });

const authResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    signal: AbortSignal.timeout(timeoutMs),
  },
);
const authBody = await authResponse.json().catch(() => ({}));
if (!authResponse.ok || !authBody.idToken) {
  throw new Error(`QA Guest Firebase login failed with HTTP ${authResponse.status}`);
}

async function request(path, options = {}, idToken = authBody.idToken) {
  const startedAt = performance.now();
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${idToken}`);
  headers.set('x-request-id', `commerce-${runLabel}-${crypto.randomUUID()}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  try {
    const response = await fetch(`${gatewayUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      status: response.status,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      body: await response.json().catch(() => null),
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const actionId = `commerce-${runLabel}-${Date.now()}`;
const items = [{ tierId, quantity: 1 }];
const quote = await request('/api/v1/checkout/calculate', {
  method: 'POST',
  body: { eventId, items },
});
const reservation = await request('/api/v1/checkout/reserve', {
  method: 'POST',
  headers: { 'x-idempotency-key': `${actionId}:reserve` },
  body: { eventId, items, deviceId: 'qa-commerce-api-discovery' },
});
const reservationId = reservation.body?.reservationId ?? null;
const reservationReplay = reservationId
  ? await request('/api/v1/checkout/reserve', {
      method: 'POST',
      headers: { 'x-idempotency-key': `${actionId}:reserve` },
      body: { eventId, items, deviceId: 'qa-commerce-api-discovery' },
    })
  : null;
const initiation = reservationId
  ? await request('/api/v1/checkout/initiate', {
      method: 'POST',
      headers: { 'x-idempotency-key': `${actionId}:initiate` },
      body: {
        reservationId,
        userName: '[QA-TEST-2026] Guest Buyer',
        userEmail: email,
        userPhone: '9000002026',
        hostUpdatesOptIn: false,
      },
    })
  : null;
const newOrderId = initiation?.body?.order?.id ?? null;
const initiationReplay =
  reservationId && initiation?.status === 200
    ? await request('/api/v1/checkout/initiate', {
        method: 'POST',
        headers: { 'x-idempotency-key': `${actionId}:initiate` },
        body: {
          reservationId,
          userName: '[QA-TEST-2026] Guest Buyer',
          userEmail: email,
          userPhone: '9000002026',
          hostUpdatesOptIn: false,
        },
      })
    : null;
const newOrder = newOrderId
  ? await request(`/api/v1/orders/${encodeURIComponent(newOrderId)}?includeEvent=false`)
  : null;
const { getAdminAuth, getAdminDb } = await import('../packages/core/admin.js');
const confirmedOrderDoc = await getAdminDb().collection('orders').doc(confirmedOrderId).get();
const confirmedOrderOwnerId = confirmedOrderDoc.data()?.userId ?? null;
let confirmedOrderOwnerToken = null;
if (confirmedOrderOwnerId) {
  const customToken = await getAdminAuth().createCustomToken(confirmedOrderOwnerId);
  const ownerAuthResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const ownerAuthBody = await ownerAuthResponse.json().catch(() => ({}));
  if (ownerAuthResponse.ok) confirmedOrderOwnerToken = ownerAuthBody.idToken ?? null;
}
const confirmedOrder = confirmedOrderOwnerToken
  ? await request(
      `/api/v1/orders/${encodeURIComponent(confirmedOrderId)}?includeEvent=false`,
      {},
      confirmedOrderOwnerToken,
    )
  : { status: null, elapsedMs: null, body: null, error: 'CONFIRMED_ORDER_OWNER_AUTH_FAILED' };
const wallet = confirmedOrderOwnerToken
  ? await request('/api/v1/tickets/my-wallet', {}, confirmedOrderOwnerToken)
  : { status: null, elapsedMs: null, body: null, error: 'CONFIRMED_ORDER_OWNER_AUTH_FAILED' };

const confirmedOrderPayload = confirmedOrder.body?.order ?? confirmedOrder.body?.data ?? null;
const newOrderPayload = newOrder?.body?.order ?? newOrder?.body?.data ?? null;
const walletPayload = wallet.body?.data ?? wallet.body ?? {};
const walletTickets = Array.isArray(walletPayload.tickets) ? walletPayload.tickets : [];
const confirmedOrderTickets = walletTickets.filter(
  (ticket) => String(ticket.orderId || ticket.order?.id || '') === confirmedOrderId,
);

const report = {
  generatedAt: new Date().toISOString(),
  eventId,
  tierId,
  confirmedOrderId,
  passed:
    quote.status === 200 &&
    reservation.status === 200 &&
    reservationReplay?.status === 200 &&
    reservationReplay?.body?.reservationId === reservationId &&
    initiation?.status === 200 &&
    initiationReplay?.status === 200 &&
    initiationReplay?.body?.order?.id === newOrderId &&
    Boolean(initiation?.body?.razorpay?.orderId) &&
    initiation?.body?.razorpay?.key?.startsWith?.('rzp_test_') === true &&
    newOrder?.status === 200 &&
    newOrderPayload?.status === 'payment_pending' &&
    confirmedOrder.status === 200 &&
    confirmedOrderPayload?.status === 'confirmed' &&
    confirmedOrderTickets.length === 2 &&
    wallet.status === 200,
  quote: {
    status: quote.status,
    elapsedMs: quote.elapsedMs,
    error: quote.error,
    totalPaise:
      quote.body?.pricing?.totalPaise ??
      (Number.isFinite(quote.body?.pricing?.grandTotal)
        ? Math.round(quote.body.pricing.grandTotal * 100)
        : null),
  },
  reservation: {
    status: reservation.status,
    elapsedMs: reservation.elapsedMs,
    error: reservation.error,
    reservationId,
    replayStatus: reservationReplay?.status ?? null,
    replayElapsedMs: reservationReplay?.elapsedMs ?? null,
    replaySameReservation:
      Boolean(reservationId) && reservationReplay?.body?.reservationId === reservationId,
  },
  initiation: {
    status: initiation?.status ?? null,
    elapsedMs: initiation?.elapsedMs ?? null,
    error: initiation?.error ?? null,
    orderId: newOrderId,
    razorpayOrderId: initiation?.body?.razorpay?.orderId ?? null,
    testKeyConfigured: initiation?.body?.razorpay?.key?.startsWith?.('rzp_test_') === true,
    replayStatus: initiationReplay?.status ?? null,
    replayElapsedMs: initiationReplay?.elapsedMs ?? null,
    replaySameOrder: Boolean(newOrderId) && initiationReplay?.body?.order?.id === newOrderId,
  },
  pendingOrder: {
    status: newOrder?.status ?? null,
    elapsedMs: newOrder?.elapsedMs ?? null,
    orderStatus: newOrderPayload?.status ?? null,
  },
  confirmedFulfillment: {
    status: confirmedOrder.status,
    elapsedMs: confirmedOrder.elapsedMs,
    orderStatus: confirmedOrderPayload?.status ?? null,
    fulfillmentStatus: confirmedOrderPayload?.fulfillmentStatus ?? null,
    walletStatus: wallet.status,
    walletElapsedMs: wallet.elapsedMs,
    ticketCountForOrder: confirmedOrderTickets.length,
    ticketIds: confirmedOrderTickets.map((ticket) => ticket.id || ticket.ticketId).filter(Boolean),
  },
};

await writeFile(new URL('results.json', outputDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

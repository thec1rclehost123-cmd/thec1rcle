import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAdminDb } from './admin.js';
import { getQrSecret } from './secret-registry.js';
import { releaseReservation } from './inventory-engine.js';
import { finalizeTicketPayment } from './workflows/ticketing.js';

const PAYMENT_PENDING_STATUSES = new Set(['payment_pending', 'pending_payment']);
const WALLET_QR_TTL_SECONDS = 15;

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret = getQrSecret()) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: payload.typ === 'scan_confirmation' ? 'scan-confirmation-v1' : 'ticket-wallet-v1',
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyScanConfirmationToken(token, secret = getQrSecret()) {
  if (!token || typeof token !== 'string') return { valid: false, error: 'Missing token' };
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { valid: false, error: 'Malformed confirmation token' };
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
    return { valid: false, error: 'Invalid confirmation signature' };
  }
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== 'HS256' ||
      header.kid !== 'scan-confirmation-v1' ||
      payload.typ !== 'scan_confirmation' ||
      payload.iss !== 'the-c1rcle' ||
      payload.aud !== 'c1rcle-scanner' ||
      !payload.ticketId ||
      !payload.entitlementId ||
      !payload.eventId ||
      !payload.scannerId ||
      !payload.deviceId ||
      !payload.exp ||
      now >= Number(payload.exp)
    ) {
      return { valid: false, error: 'Invalid or expired confirmation claims' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Invalid confirmation token' };
  }
}

export async function previewTicketJwtScan({
  db = getAdminDb(),
  token,
  eventId,
  scannerId,
  deviceId,
}) {
  const verified = verifyTicketQrJwt(token);
  if (!verified.valid) return { success: false, result: 'invalid', error: verified.error };
  const claims = verified.payload;
  if (claims.eventId !== eventId) {
    return { success: false, result: 'wrong_event', error: 'Ticket is for a different event' };
  }

  const ticketId = claims.jti || claims.ticketId || claims.sub;
  const [ticketDoc, entitlementSnapshot] = await Promise.all([
    db.collection('tickets').doc(ticketId).get(),
    db.collection('entitlements').where('ticketDocumentId', '==', ticketId).limit(2).get(),
  ]);
  if (!ticketDoc.exists || entitlementSnapshot.docs.length !== 1) {
    return { success: false, result: 'invalid', error: 'Ticket admission is unavailable' };
  }
  const ticket = ticketDoc.data();
  const entitlementDoc = entitlementSnapshot.docs[0];
  const entitlement = entitlementDoc.data();
  if (
    ticket.orderId !== claims.orderId ||
    ticket.eventId !== eventId ||
    entitlement.eventId !== eventId ||
    entitlement.orderId !== ticket.orderId ||
    String(ticket.userId || '') !== String(claims.userId || '') ||
    String(entitlement.ownerUserId || '') !== String(ticket.userId || '') ||
    String(entitlement.state || '').toUpperCase() !== 'ACTIVE' ||
    ['revoked', 'refunded', 'cancelled', 'transferred'].includes(
      String(ticket.status || '').toLowerCase(),
    )
  ) {
    return { success: false, result: 'revoked', error: 'Ticket is not active' };
  }

  const allowed = Number(entitlement.scanCountAllowed || ticket.scanCountAllowed || 1);
  const used = Number(entitlement.scanCountUsed || ticket.scanCountUsed || 0);
  if (used >= allowed) {
    return { success: false, result: 'already_scanned', error: 'Ticket already scanned' };
  }
  if (allowed !== 2 || used !== 0 || String(ticket.entryType || '') !== 'couple') {
    return { success: true, requiresConfirmation: false, ticket: { id: ticketId, ...ticket } };
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    success: true,
    result: 'confirmation_required',
    requiresConfirmation: true,
    confirmationToken: signJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'scan_confirmation',
      ticketId,
      entitlementId: entitlementDoc.id,
      orderId: ticket.orderId,
      eventId,
      scannerId,
      deviceId,
      expectedScanCountUsed: 0,
      consumeCount: 2,
      iat: now,
      exp: now + 30,
    }),
    ticket: { id: ticketId, ...ticket, quantity: 2 },
  };
}

export async function confirmCoupleTicketScan({
  db = getAdminDb(),
  confirmationToken,
  eventId,
  scannerId,
  deviceId,
  gate = null,
}) {
  const verified = verifyScanConfirmationToken(confirmationToken);
  if (!verified.valid) {
    return { success: false, result: 'invalid', error: verified.error };
  }
  const claims = verified.payload;
  if (
    claims.eventId !== eventId ||
    claims.scannerId !== scannerId ||
    claims.deviceId !== deviceId
  ) {
    return { success: false, result: 'invalid', error: 'Confirmation context mismatch' };
  }

  const ticketRef = db.collection('tickets').doc(claims.ticketId);
  const entitlementRef = db.collection('entitlements').doc(claims.entitlementId);
  let result = null;
  await db.runTransaction(async (transaction) => {
    const [ticketDoc, entitlementDoc] = await Promise.all([
      transaction.get(ticketRef),
      transaction.get(entitlementRef),
    ]);
    if (!ticketDoc.exists || !entitlementDoc.exists) {
      result = { success: false, result: 'invalid', error: 'Ticket admission is unavailable' };
      return;
    }
    const ticket = ticketDoc.data();
    const entitlement = entitlementDoc.data();
    const used = Number(entitlement.scanCountUsed || ticket.scanCountUsed || 0);
    const allowed = Number(entitlement.scanCountAllowed || ticket.scanCountAllowed || 1);
    if (
      ticket.eventId !== eventId ||
      entitlement.eventId !== eventId ||
      entitlement.ticketDocumentId !== claims.ticketId ||
      entitlement.orderId !== claims.orderId ||
      String(entitlement.state || '').toUpperCase() !== 'ACTIVE' ||
      used !== Number(claims.expectedScanCountUsed) ||
      allowed !== 2 ||
      Number(claims.consumeCount) !== 2
    ) {
      result = {
        success: false,
        result: used >= allowed ? 'already_scanned' : 'invalid',
        error: used >= allowed ? 'Ticket already scanned' : 'Ticket state changed',
      };
      return;
    }
    const now = new Date().toISOString();
    const scanRef = db.collection('ticket_scans').doc(`${claims.ticketId}_couple_0_2`);
    transaction.update(ticketRef, {
      scanCountUsed: 2,
      status: 'used',
      lastScannedAt: now,
      updatedAt: now,
    });
    transaction.update(entitlementRef, {
      scanCountUsed: 2,
      checkedIn: true,
      state: 'CONSUMED',
      lastScannedAt: now,
      updatedAt: now,
    });
    transaction.create(scanRef, {
      orderId: ticket.orderId,
      eventId,
      ticketId: claims.ticketId,
      entitlementId: claims.entitlementId,
      userId: ticket.userId,
      quantity: 2,
      entryType: 'couple',
      result: 'valid',
      scannerId,
      deviceId,
      gate,
      scannedAt: now,
      createdAt: now,
    });
    result = {
      success: true,
      result: 'valid',
      scanId: scanRef.id,
      ticket: { id: claims.ticketId, ...ticket, quantity: 2, scanCountUsed: 2 },
      entitlementId: claims.entitlementId,
      scanCountUsed: 2,
      scanCountAllowed: 2,
    };
  });
  return result;
}

export function verifyTicketQrJwt(token, secret = getQrSecret()) {
  if (!token || typeof token !== 'string') return { valid: false, error: 'Missing token' };
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { valid: false, error: 'Malformed JWT format' };

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'Invalid JWT signature' };
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payloadStr = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      !['ticket-v1', 'ticket-wallet-v1'].includes(header.kid)
    ) {
      return { valid: false, error: 'Unsupported ticket QR signing header' };
    }
    if (
      payload.iss !== 'the-c1rcle' ||
      payload.aud !== 'c1rcle-scanner' ||
      payload.typ !== 'ticket' ||
      !payload.orderId ||
      !payload.eventId ||
      !(payload.jti || payload.ticketId || payload.sub)
    ) {
      return { valid: false, error: 'Invalid ticket QR claims' };
    }
    if (payload.nbf && nowSec < Number(payload.nbf)) {
      return { valid: false, error: 'Ticket QR code is not active yet', payload };
    }
    if (!payload.exp || nowSec >= Number(payload.exp)) {
      return { valid: false, error: 'Ticket QR code has expired', payload };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Failed to parse JWT payload' };
  }
}

export async function processTicketJwtScan({
  db = getAdminDb(),
  token,
  eventId,
  scannerId,
  gate = null,
}) {
  const verified = verifyTicketQrJwt(token);
  if (!verified.valid) return { success: false, result: 'invalid', error: verified.error };

  const claims = verified.payload;
  if (eventId && claims.eventId !== eventId) {
    return { success: false, result: 'wrong_event', error: 'Ticket is for a different event' };
  }

  const ticketDocumentId = claims.jti || claims.ticketId || claims.sub;
  const ticketRef = db.collection('tickets').doc(ticketDocumentId);
  const entitlementQuery = db
    .collection('entitlements')
    .where('ticketDocumentId', '==', ticketDocumentId)
    .limit(2);
  let result = null;

  await db.runTransaction(async (transaction) => {
    const [ticketDoc, entitlementSnapshot] = await Promise.all([
      transaction.get(ticketRef),
      transaction.get(entitlementQuery),
    ]);
    if (!ticketDoc.exists) {
      result = { success: false, result: 'not_found', error: 'Ticket not found' };
      return;
    }
    if (entitlementSnapshot.docs?.length !== 1) {
      result = {
        success: false,
        result: 'invalid',
        error: 'Ticket entitlement is missing or ambiguous',
      };
      return;
    }

    const ticket = ticketDoc.data();
    const entitlementDoc = entitlementSnapshot.docs[0];
    const entitlement = entitlementDoc.data();
    if (
      ticket.orderId !== claims.orderId ||
      ticket.eventId !== claims.eventId ||
      ticket.eventId !== (eventId || claims.eventId) ||
      entitlement.eventId !== ticket.eventId ||
      entitlement.orderId !== ticket.orderId
    ) {
      result = { success: false, result: 'invalid', error: 'Ticket claims do not match records' };
      return;
    }
    if (
      ['revoked', 'refunded', 'cancelled', 'transferred'].includes(
        String(ticket.status || '').toLowerCase(),
      ) ||
      String(entitlement.state || '').toUpperCase() !== 'ACTIVE'
    ) {
      result = { success: false, result: 'revoked', error: 'Ticket is not active' };
      return;
    }
    if (
      String(ticket.userId || '') !== String(claims.userId || '') ||
      String(entitlement.ownerUserId || '') !== String(ticket.userId || '')
    ) {
      result = { success: false, result: 'revoked', error: 'Ticket ownership has changed' };
      return;
    }

    const allowed = Number(entitlement.scanCountAllowed || ticket.scanCountAllowed || 1);
    const used = Number(entitlement.scanCountUsed || ticket.scanCountUsed || 0);
    if (used >= allowed || entitlement.state === 'CONSUMED') {
      result = { success: false, result: 'already_scanned', error: 'Ticket already scanned' };
      return;
    }

    const nextUsed = used + 1;
    const now = new Date().toISOString();
    const consumed = nextUsed >= allowed;
    const scanRef = db.collection('ticket_scans').doc(`${ticketDocumentId}_${nextUsed}`);
    transaction.update(ticketRef, {
      scanCountUsed: nextUsed,
      status: consumed ? 'used' : 'active',
      lastScannedAt: now,
      updatedAt: now,
    });
    transaction.update(entitlementDoc.ref, {
      scanCountUsed: nextUsed,
      checkedIn: consumed,
      state: consumed ? 'CONSUMED' : 'ACTIVE',
      lastScannedAt: now,
      updatedAt: now,
    });
    transaction.create(scanRef, {
      orderId: ticket.orderId,
      eventId: ticket.eventId,
      ticketId: ticketDocumentId,
      entitlementId: entitlementDoc.id,
      userId: ticket.userId,
      quantity: 1,
      entryType: ticket.entryType || 'general',
      result: 'valid',
      scannerId,
      gate,
      scannedAt: now,
      createdAt: now,
    });
    result = {
      success: true,
      result: 'valid',
      scanId: scanRef.id,
      ticket: { id: ticketDocumentId, ...ticket, scanCountUsed: nextUsed },
      entitlementId: entitlementDoc.id,
      scanCountUsed: nextUsed,
      scanCountAllowed: allowed,
    };
  });

  return result;
}

function safeDocSegment(value) {
  return String(value || 'GEN')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value.seconds != null) return new Date(value.seconds * 1000).toISOString();
  return null;
}

function normalizeOrderTickets(order) {
  return Array.isArray(order?.tickets) ? order.tickets : [];
}

export function verifyRazorpayWebhookSignature({ rawBody, signature, webhookSecret }) {
  if (!webhookSecret) throw codedError('Webhook not configured', 'PAYMENT_NOT_CONFIGURED');
  const expected = createHmac('sha256', webhookSecret)
    .update(rawBody || '')
    .digest('hex');
  if (!signature || expected !== signature) {
    throw codedError('Invalid webhook signature', 'PAYMENT_SIGNATURE_INVALID');
  }
  return true;
}

export function createTicketQrJwt(ticket, options = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = Number(options.expiresInSeconds || WALLET_QR_TTL_SECONDS);
  const exp = nowSeconds + expiresInSeconds;
  const ticketId = ticket.id || ticket.ticketId;

  return {
    qrPayload: signJwt({
      iss: 'the-c1rcle',
      aud: 'c1rcle-scanner',
      typ: 'ticket',
      ver: 1,
      sub: ticketId,
      jti: ticketId,
      ticketId,
      entitlementId: ticket.entitlementId || null,
      orderId: ticket.orderId,
      eventId: ticket.eventId,
      userId: ticket.userId,
      tierId: ticket.tierId || null,
      iat: nowSeconds,
      nbf: nowSeconds,
      exp,
    }),
    qrExpiresAt: new Date(exp * 1000).toISOString(),
    qrExpiresInSeconds: expiresInSeconds,
  };
}

export async function createTicketQrForEntitlement({ db = getAdminDb(), userId, entitlementId }) {
  if (!userId) throw codedError('Unauthorized', 'UNAUTHORIZED');
  if (!entitlementId) throw codedError('Entitlement is required', 'NOT_FOUND');

  const entitlementDoc = await db.collection('entitlements').doc(entitlementId).get();
  if (!entitlementDoc.exists) throw codedError('Entitlement not found', 'NOT_FOUND');

  const entitlement = entitlementDoc.data();
  if (
    entitlement.ownerUserId !== userId ||
    String(entitlement.state || '').toUpperCase() !== 'ACTIVE'
  ) {
    throw codedError('Entitlement is unavailable', 'NOT_FOUND');
  }
  if (!entitlement.ticketDocumentId) {
    throw codedError('Entitlement requires migration', 'TICKET_MIGRATION_REQUIRED');
  }

  const ticketDoc = await db.collection('tickets').doc(entitlement.ticketDocumentId).get();
  if (!ticketDoc.exists) throw codedError('Ticket is unavailable', 'NOT_FOUND');
  const ticket = ticketDoc.data();
  if (
    ticket.userId !== userId ||
    ticket.orderId !== entitlement.orderId ||
    ticket.eventId !== entitlement.eventId ||
    ['revoked', 'refunded', 'cancelled', 'transferred', 'used'].includes(
      String(ticket.status || '').toLowerCase(),
    )
  ) {
    throw codedError('Ticket is unavailable', 'NOT_FOUND');
  }

  return createTicketQrJwt({
    id: ticketDoc.id,
    ...ticket,
    entitlementId: entitlementDoc.id,
  });
}

function buildTicketDocuments(order, issuedAt) {
  const tickets = [];

  for (const group of normalizeOrderTickets(order)) {
    const tierId = group.ticketId || group.tierId || group.id || 'GEN';
    const safeTierId = safeDocSegment(tierId);
    const quantity = Math.max(1, Number(group.quantity || 1));

    for (let index = 1; index <= quantity; index += 1) {
      const ticketId = `${order.id}-${tierId}-${index}`;
      const docId = `TKT-${safeDocSegment(order.id)}-${safeTierId}-${index}`.toUpperCase();
      const qr = createTicketQrJwt({
        id: docId,
        ticketId,
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        tierId,
      });

      tickets.push({
        id: docId,
        ticketId,
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        tierId,
        tierName: group.name || group.tierName || tierId,
        slotIndex: index,
        quantity: 1,
        originalQuantity: quantity,
        price: Number(group.price || 0),
        entryType: group.entryType || 'general',
        requiredGender: group.requiredGender || group.genderRequirement || null,
        status: 'active',
        qrMode: 'jwt',
        qrPayload: qr.qrPayload,
        qrJwt: qr.qrPayload,
        qrExpiresAt: qr.qrExpiresAt,
        scanCountAllowed: group.entryType === 'couple' ? 2 : 1,
        scanCountUsed: 0,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
    }
  }

  return tickets;
}

function buildOrderQrCodes(ticketDocs) {
  return ticketDocs.map((ticket, index) => {
    const qr = createTicketQrJwt(ticket);
    return {
      ticketId: ticket.id,
      tierId: ticket.tierId,
      tierName: ticket.tierName,
      ticketIndex: index,
      qrMode: 'jwt',
      qrCode: qr.qrPayload,
      qrData: qr.qrPayload,
      qrPayload: qr.qrPayload,
      qrExpiresAt: qr.qrExpiresAt,
      isUsed: ticket.status === 'used',
    };
  });
}

async function findPaymentByRazorpayOrderId(db, razorpayOrderId) {
  const snapshot = await db
    .collection('payments')
    .where('razorpayOrderId', '==', razorpayOrderId)
    .limit(2)
    .get();

  if (snapshot.empty) throw codedError('Payment order not found', 'NOT_FOUND');
  if (snapshot.docs.length > 1) throw codedError('Payment order is ambiguous', 'CONFLICT');

  return snapshot.docs[0].data();
}

async function getOrderDocument(db, transaction, orderId) {
  const ref = db.collection('orders').doc(orderId);
  const doc = transaction ? await transaction.get(ref) : await ref.get();
  if (!doc.exists) throw codedError('Order not found', 'NOT_FOUND');
  return { ref, data: { id: doc.id, ...doc.data(), isRSVP: false } };
}

export async function generateTicketsForOrder({ db = getAdminDb(), orderId }) {
  const issuedAt = new Date().toISOString();
  let result = null;

  await db.runTransaction(async (transaction) => {
    const orderLookup = await getOrderDocument(db, transaction, orderId);
    const order = orderLookup.data;

    if (order.status !== 'confirmed' && !PAYMENT_PENDING_STATUSES.has(String(order.status || ''))) {
      throw codedError(`Order is ${order.status}`, 'CONFLICT');
    }

    const ticketDocs = buildTicketDocuments(order, issuedAt);
    const refs = ticketDocs.map((ticket) => db.collection('tickets').doc(ticket.id));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

    const finalTickets = ticketDocs.map((ticket, index) => {
      const existing = snapshots[index].exists
        ? { id: snapshots[index].id, ...snapshots[index].data() }
        : null;
      const merged = existing
        ? {
            ...existing,
            userId: existing.userId || order.userId,
            orderId: existing.orderId || order.id,
            eventId: existing.eventId || order.eventId,
            tierId: existing.tierId || ticket.tierId,
            tierName: existing.tierName || ticket.tierName,
            status: existing.status || 'active',
            updatedAt: issuedAt,
          }
        : ticket;
      const qr = createTicketQrJwt(merged);
      return {
        ...merged,
        qrMode: 'jwt',
        qrPayload: qr.qrPayload,
        qrJwt: qr.qrPayload,
        qrExpiresAt: qr.qrExpiresAt,
      };
    });

    finalTickets.forEach((ticket, index) => {
      if (snapshots[index].exists) {
        transaction.update(refs[index], {
          userId: ticket.userId,
          status: ticket.status,
          qrMode: 'jwt',
          qrPayload: ticket.qrPayload,
          qrJwt: ticket.qrPayload,
          qrExpiresAt: ticket.qrExpiresAt,
          updatedAt: issuedAt,
        });
      } else {
        transaction.set(refs[index], ticket);
      }
    });

    const qrCodes = buildOrderQrCodes(finalTickets);
    transaction.update(orderLookup.ref, {
      status: 'confirmed',
      ticketIds: finalTickets.map((ticket) => ticket.id),
      qrCodes,
      ticketsIssuedAt: order.ticketsIssuedAt || issuedAt,
      confirmedAt: order.confirmedAt || issuedAt,
      updatedAt: issuedAt,
    });

    result = {
      order: {
        ...order,
        status: 'confirmed',
        ticketIds: finalTickets.map((ticket) => ticket.id),
        qrCodes,
        ticketsIssuedAt: order.ticketsIssuedAt || issuedAt,
        confirmedAt: order.confirmedAt || issuedAt,
        updatedAt: issuedAt,
      },
      tickets: finalTickets,
    };
  });

  return result;
}

export async function finalizeRazorpayTicketPurchase({
  db = getAdminDb(),
  razorpayOrderId,
  razorpayPaymentId,
  paymentGatewayConfig = {},
  providerPayment = null,
  requestId = null,
}) {
  return finalizeTicketPayment({
    db,
    source: 'webhook',
    requestId,
    razorpayOrderId,
    razorpayPaymentId,
    webhookVerified: true,
    providerPayment,
    paymentGatewayConfig,
  });
}

function eventFromDoc(doc) {
  if (!doc?.exists) return null;
  const event = { id: doc.id, ...doc.data() };
  return {
    id: event.id,
    title: event.title || event.eventTitle || event.name || null,
    image: event.image || event.poster || event.coverImage || event.posterUrl || null,
    date: normalizeDate(event.startDate || event.startAt || event.date),
    time: event.time || null,
    venue: event.venueName || event.venue || event.location || null,
    hostName: event.hostName || event.host?.name || null,
    accentColor: event.accentColor || event.posterAccentColor || null,
  };
}

function mapOrderForWallet(order, tickets, event) {
  const qrCodes = buildOrderQrCodes(tickets);
  const ticketGroups = normalizeOrderTickets(order).map((ticket) => ({
    ticketId: ticket.ticketId || ticket.tierId || ticket.id,
    tierId: ticket.tierId || ticket.ticketId || ticket.id,
    tierName: ticket.tierName || ticket.name || 'General Entry',
    quantity: Number(ticket.quantity || 1),
    price: Number(ticket.price || 0),
    subtotal: Number(ticket.total ?? ticket.subtotal ?? 0),
    entryType: ticket.entryType || 'general',
    requiredGender: ticket.requiredGender || ticket.genderRequirement || undefined,
    isClaimed: true,
  }));

  return {
    id: order.id,
    userId: order.userId,
    userEmail: order.userEmail || undefined,
    userName: order.userName || undefined,
    eventId: order.eventId,
    eventTitle: order.eventTitle || order.eventName || event?.title || undefined,
    eventDate:
      normalizeDate(order.eventDate || order.eventStartDate || order.startDate) ||
      event?.date ||
      undefined,
    eventStartDate:
      normalizeDate(order.eventStartDate || order.eventDate || order.startDate) ||
      event?.date ||
      undefined,
    eventTime: order.eventTime || event?.time || undefined,
    eventCoverImage:
      order.eventCoverImage ||
      order.eventImage ||
      order.image ||
      order.poster ||
      event?.image ||
      undefined,
    venueLocation:
      order.venueLocation || order.eventLocation || order.venue || event?.venue || undefined,
    hostName: order.hostName || event?.hostName || undefined,
    accentColor: order.accentColor || event?.accentColor || undefined,
    status: order.status,
    tickets: ticketGroups.length
      ? ticketGroups
      : tickets.map((ticket) => ({
          ticketId: ticket.id,
          tierId: ticket.tierId,
          tierName: ticket.tierName || 'General Entry',
          quantity: 1,
          price: Number(ticket.price || 0),
          entryType: ticket.entryType || 'general',
          requiredGender: ticket.requiredGender || undefined,
          isClaimed: true,
        })),
    totalAmount: Number(order.totalAmount || 0),
    currency: order.currency || 'INR',
    createdAt: normalizeDate(order.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDate(order.updatedAt) || undefined,
    confirmedAt: normalizeDate(order.confirmedAt) || undefined,
    qrCodes,
    isClaimed: true,
    isRSVP: Boolean(order.isRSVP),
    source: order.source || undefined,
  };
}

export async function getUserTicketWallet({ db = getAdminDb(), userId }) {
  if (!userId) throw codedError('Unauthorized', 'UNAUTHORIZED');

  const [ticketsSnap, entitlementsSnap] = await Promise.all([
    db.collection('tickets').where('userId', '==', userId).get(),
    db.collection('entitlements').where('ownerUserId', '==', userId).get(),
  ]);
  const tickets = ticketsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const entitlementsByTicketId = new Map(
    entitlementsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((entitlement) => entitlement.ticketDocumentId)
      .map((entitlement) => [entitlement.ticketDocumentId, entitlement]),
  );

  if (!tickets.length) {
    return {
      orders: [],
      tickets: [],
      qrTtlSeconds: WALLET_QR_TTL_SECONDS,
    };
  }

  const orderIds = [...new Set(tickets.map((ticket) => ticket.orderId).filter(Boolean))];
  const orderDocs = await Promise.all(
    orderIds.map((orderId) => db.collection('orders').doc(orderId).get()),
  );
  const orders = orderDocs
    .filter((doc) => doc.exists)
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((order) => order.userId === userId && order.status === 'confirmed');

  const eventIds = [...new Set(orders.map((order) => order.eventId).filter(Boolean))];
  const eventDocs = await Promise.all(
    eventIds.map((eventId) =>
      db
        .collection('events')
        .doc(eventId)
        .get()
        .catch(() => null),
    ),
  );
  const eventMap = new Map();
  eventDocs.forEach((doc) => {
    const event = eventFromDoc(doc);
    if (event) eventMap.set(event.id, event);
  });

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const walletOrders = orders.map((order) => {
    const orderTickets = tickets.filter((ticket) => ticket.orderId === order.id);
    return mapOrderForWallet(order, orderTickets, eventMap.get(order.eventId));
  });

  const walletTickets = tickets
    .filter((ticket) => ordersById.has(ticket.orderId))
    .map((ticket) => {
      const entitlement = entitlementsByTicketId.get(ticket.id);
      const isActive =
        entitlement &&
        String(entitlement.state || '').toUpperCase() === 'ACTIVE' &&
        !['revoked', 'refunded', 'cancelled', 'transferred', 'used'].includes(
          String(ticket.status || '').toLowerCase(),
        );
      const qr = isActive
        ? createTicketQrJwt({ ...ticket, entitlementId: entitlement.id })
        : { qrPayload: null, qrExpiresAt: null };
      return {
        ...ticket,
        entitlementId: entitlement?.id || null,
        qrPayload: qr.qrPayload,
        qrJwt: qr.qrPayload,
        qrExpiresAt: qr.qrExpiresAt,
      };
    });

  return {
    orders: walletOrders.sort((left, right) => {
      const leftTime = Date.parse(left.eventDate || left.createdAt || '');
      const rightTime = Date.parse(right.eventDate || right.createdAt || '');
      return (
        (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
      );
    }),
    tickets: walletTickets,
    qrTtlSeconds: WALLET_QR_TTL_SECONDS,
  };
}

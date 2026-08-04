import { createHmac, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils.js';
import Razorpay from 'razorpay';
import { inngest, Events, sendEvent } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';
import { ENTITLEMENT_STATES } from '../entitlement-engine.js';
import { ensureEventChatMembership } from '../guest-chat-service.js';
import { commitInventory, releaseReservation } from '../inventory-engine.js';
import { getQrSecret } from '../secret-registry.js';
import {
  buildPartnerLedgerEntries,
  writePartnerLedgerInTransaction,
} from '../partner-ledger-service.js';
import { buildCoverWalletDocument } from '../cover-charge-engine.js';
import { FieldValue } from 'firebase-admin/firestore';
// NOTE: generateEntitlementQR is intentionally NOT imported here.
// The rotating QR is generated live by the mobile app at display time.
// Pre-generating it server-side produces a snapshot that expires in 30s.

const PAYMENT_PENDING_STATUSES = new Set(['payment_pending', 'pending_payment']);

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isMockRazorpayPayload(orderId, paymentId, signature) {
  return (
    String(orderId || '').startsWith('order_mock_') ||
    String(paymentId || '').startsWith('pay_mock_') ||
    String(signature || '').startsWith('sig_mock_')
  );
}

export function verifyRazorpayCheckoutSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  keySecret,
  allowMockPayment = false,
}) {
  const isMockPayload = isMockRazorpayPayload(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );

  if (isMockPayload) {
    if (!allowMockPayment) throw codedError('Mock payments are disabled', 'BAD_REQUEST');
    return true;
  }

  if (!keySecret) {
    throw codedError('Payment verification is not configured', 'PAYMENT_NOT_CONFIGURED');
  }

  const verified = validatePaymentVerification(
    {
      order_id: razorpayOrderId,
      payment_id: razorpayPaymentId,
    },
    razorpaySignature,
    keySecret,
  );

  if (!verified) throw codedError('Invalid signature', 'PAYMENT_SIGNATURE_INVALID');
  return true;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signTicketJwt(payload, secret = getQrSecret()) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: 'ticket-v1',
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

function safeDocSegment(value) {
  return String(value || 'GEN')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizeOrderTickets(order) {
  return Array.isArray(order?.tickets) ? order.tickets : [];
}

function buildTicketDocuments(order, event, issuedAt) {
  const ticketDocs = [];

  for (const group of normalizeOrderTickets(order)) {
    const tierId = group.ticketId || group.tierId || group.id || 'GEN';
    const safeTierId = safeDocSegment(tierId);
    const quantity = Math.max(1, Number(group.quantity || 1));

    for (let index = 1; index <= quantity; index += 1) {
      const ticketId = `${order.id}-${tierId}-${index}`;
      const ticketDocId = `TKT-${safeDocSegment(order.id)}-${safeTierId}-${index}`.toUpperCase();
      ticketDocs.push({
        id: ticketDocId,
        ticketId,
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        hostId: order.hostId,
        venueId: order.venueId || null,
        promoterId: order.promoterId || null,
        tierId,
        tierName: group.name || group.tierName || tierId,
        slotIndex: index,
        quantity: 1,
        originalQuantity: quantity,
        entryType: group.entryType || 'general',
        ticketType: Number(group.price || 0) <= 0 ? 'free' : 'paid',
        status: 'active',
        qrMode: 'dynamic_jwt',
        qrPayload: null,
        qrJwt: null,
        scanCountAllowed: group.entryType === 'couple' ? 2 : 1,
        scanCountUsed: 0,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
    }
  }

  return ticketDocs;
}

function buildOrderQrCodes(order, ticketDocs) {
  return normalizeOrderTickets(order).map((group) => {
    const tierId = group.ticketId || group.tierId || group.id || 'GEN';
    const docs = ticketDocs.filter((ticket) => ticket.tierId === tierId);
    return {
      ticketId: tierId,
      ticketName: group.name || group.tierName || tierId,
      quantity: Number(group.quantity || docs.length || 1),
      entryType: group.entryType || 'general',
      isRSVP: false,
      qrMode: 'dynamic_jwt',
      ticketDocumentIds: docs.map((ticket) => ticket.id),
      qrPayloads: [],
      qrPayload: null,
      qrData: null,
      shortCode: null,
    };
  });
}

function deterministicPublicToken(entitlementId) {
  return `stk_${createHmac('sha256', getQrSecret())
    .update(`public-entitlement:${entitlementId}`)
    .digest('base64url')
    .slice(0, 32)}`;
}

function buildEntitlementDocuments(order, event, ticketDocs, issuedAt) {
  const eventSummary = {
    title: event?.title || order.eventName || null,
    startAt: event?.startDate || event?.startAt || null,
    venue: event?.venue || event?.venueName || event?.location || null,
    city: event?.city || null,
    posterUrl: event?.image || event?.posterUrl || null,
  };

  return ticketDocs.map((ticket) => {
    const entitlementId = `ENT-${safeDocSegment(order.id)}-${safeDocSegment(
      ticket.tierId,
    )}-${ticket.slotIndex}`.toUpperCase();
    return {
      id: entitlementId,
      entitlementId,
      ticketDocumentId: ticket.id,
      ticketId: ticket.ticketId,
      qrCode: entitlementId,
      publicToken: deterministicPublicToken(entitlementId),
      checkedIn: false,
      eventId: order.eventId,
      orderId: order.id,
      ownerUserId: order.userId,
      hostId: order.hostId,
      venueId: order.venueId || null,
      promoterId: order.promoterId || null,
      ticketType: ticket.entryType === 'couple' ? 'couple' : ticket.ticketType || 'paid',
      genderConstraint: ticket.genderRequirement || 'none',
      scanCountAllowed: ticket.scanCountAllowed,
      scanCountUsed: 0,
      state: ENTITLEMENT_STATES.ACTIVE,
      issuedAt,
      eventSummary,
      metadata: {
        tierId: ticket.tierId,
        tierName: ticket.tierName,
        index: ticket.slotIndex,
        entryType: ticket.entryType || 'general',
      },
    };
  });
}

export function buildCoverWalletDocumentsForOrder(order, event, issuedAt) {
  const wallets = [];
  for (const group of normalizeOrderTickets(order)) {
    const tierConfig = group.coverChargeConfig;
    if (!tierConfig?.enabled) continue;
    const tierId = group.ticketId || group.tierId || group.id || 'GEN';
    const quantity = Math.max(1, Number(group.quantity || 1));
    for (let unitIndex = 1; unitIndex <= quantity; unitIndex += 1) {
      wallets.push(
        buildCoverWalletDocument({
          orderId: order.id,
          eventId: order.eventId,
          venueId: order.venueId || event?.venueId,
          userId: order.userId,
          tierId,
          unitIndex,
          tierConfig,
          eventStartIso: event?.startAt || event?.startDate,
          tzOffset: event?.timezoneOffset || '+05:30',
          termsAcceptedAt: order.coverChargeTermsAcceptedAt || order.createdAt || issuedAt,
          issuedAt,
        }),
      );
    }
  }
  return wallets;
}

const FINALIZATION_ARTIFACT_FIELDS = {
  ticket: [
    'id',
    'ticketId',
    'orderId',
    'eventId',
    'hostId',
    'venueId',
    'promoterId',
    'tierId',
    'tierName',
    'slotIndex',
    'quantity',
    'originalQuantity',
    'entryType',
    'ticketType',
    'qrMode',
    'scanCountAllowed',
  ],
  entitlement: [
    'id',
    'entitlementId',
    'ticketDocumentId',
    'ticketId',
    'qrCode',
    'publicToken',
    'eventId',
    'orderId',
    'hostId',
    'venueId',
    'promoterId',
    'ticketType',
    'genderConstraint',
    'scanCountAllowed',
    'eventSummary',
    'metadata',
  ],
  coverWallet: [
    'id',
    'orderId',
    'eventId',
    'venueId',
    'tierId',
    'unitIndex',
    'schemaVersion',
    'openingBalancePaise',
    'terminationAtMs',
    'rules',
    'termsAcceptedAt',
    'termsVersion',
    'createdBy',
  ],
};

export function finalizationArtifactMatches(kind, actual, expected) {
  const fields = FINALIZATION_ARTIFACT_FIELDS[kind];
  if (!fields || !actual || !expected) return false;
  return fields.every((field) => isDeepStrictEqual(actual[field] ?? null, expected[field] ?? null));
}

/**
 * Atomically finalizes a zero-value ticket order.
 *
 * A free checkout has no provider payment and therefore cannot use
 * finalizeTicketPayment. It must still use the same authoritative transaction
 * boundary for inventory, ticket/wallet artifacts, and the delivery outbox.
 */
export async function finalizeFreeTicketOrder({
  db = getAdminDb(),
  orderId,
  userId = null,
  requestId = null,
}) {
  if (!orderId) throw codedError('Order id is required', 'BAD_REQUEST');

  const issuedAt = new Date().toISOString();
  let result = null;

  await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw codedError('Order not found', 'NOT_FOUND');

    const order = { id: orderSnapshot.id, ...orderSnapshot.data(), isRSVP: false };
    if (userId && order.userId !== userId) throw codedError('Forbidden', 'FORBIDDEN');
    if (order.status !== 'confirmed') {
      throw codedError(`Order is ${order.status}`, 'ORDER_NOT_FINALIZABLE');
    }
    if (Number(order.totalPaise) !== 0 || Number(order.totalAmount) !== 0) {
      throw codedError('Order is not a zero-value checkout', 'ORDER_NOT_FINALIZABLE');
    }
    if (!order.hostId) {
      throw codedError('Order is missing host attribution', 'ORDER_ATTRIBUTION_MISSING');
    }

    const event = await getEventSnapshot(db, transaction, order.eventId);
    if (!event) throw codedError('Event not found', 'NOT_FOUND');

    const ticketDocs = buildTicketDocuments(order, event, issuedAt);
    if (ticketDocs.length === 0 || ticketDocs.length > 50) {
      throw codedError(
        'Ticket quantity is outside the atomic finalization limit',
        'TICKET_TRANSACTION_LIMIT_EXCEEDED',
      );
    }
    const entitlementDocs = buildEntitlementDocuments(order, event, ticketDocs, issuedAt);
    const coverWalletDocs = buildCoverWalletDocumentsForOrder(order, event, issuedAt);
    const ticketRefs = ticketDocs.map((ticket) => db.collection('tickets').doc(ticket.id));
    const entitlementRefs = entitlementDocs.map((entitlement) =>
      db.collection('entitlements').doc(entitlement.id),
    );
    const coverWalletRefs = coverWalletDocs.map((wallet) =>
      db.collection('cover_wallets').doc(wallet.id),
    );
    const outboxRef = db.collection('domain_event_outbox').doc(`ticket-purchase-${order.id}`);

    const [ticketSnapshots, entitlementSnapshots, coverWalletSnapshots, outboxSnapshot] =
      await Promise.all([
        Promise.all(ticketRefs.map((ref) => transaction.get(ref))),
        Promise.all(entitlementRefs.map((ref) => transaction.get(ref))),
        Promise.all(coverWalletRefs.map((ref) => transaction.get(ref))),
        transaction.get(outboxRef),
      ]);

    for (const [kind, snapshots, expectedDocuments] of [
      ['ticket', ticketSnapshots, ticketDocs],
      ['entitlement', entitlementSnapshots, entitlementDocs],
      ['coverWallet', coverWalletSnapshots, coverWalletDocs],
    ]) {
      snapshots.forEach((snapshot, index) => {
        if (
          snapshot.exists &&
          !finalizationArtifactMatches(kind, snapshot.data(), expectedDocuments[index])
        ) {
          throw codedError(
            `${kind} finalization artifact conflicts with the authoritative order`,
            'FINALIZATION_ARTIFACT_CONFLICT',
          );
        }
      });
    }

    const artifactSnapshots = [
      ...ticketSnapshots,
      ...entitlementSnapshots,
      ...coverWalletSnapshots,
    ];
    const artifactsExist = artifactSnapshots.some((snapshot) => snapshot.exists);
    const artifactsComplete = artifactSnapshots.every((snapshot) => snapshot.exists);
    const isCompleteReplay =
      artifactsComplete &&
      order.fulfillmentStatus === 'authoritative_committed' &&
      Boolean(order.inventoryCommittedAt);

    if (!isCompleteReplay && artifactsExist) {
      throw codedError(
        'Free order has a partial authoritative artifact set',
        'FINALIZATION_ARTIFACT_CONFLICT',
      );
    }

    if (!isCompleteReplay) {
      await commitInventory(transaction, {
        db,
        event,
        items: order.tickets,
        reservationId: order.reservationId || null,
      });

      ticketSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) transaction.create(ticketRefs[index], ticketDocs[index]);
      });
      entitlementSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) {
          transaction.create(entitlementRefs[index], entitlementDocs[index]);
        }
      });
      coverWalletSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) {
          transaction.create(coverWalletRefs[index], coverWalletDocs[index]);
        }
      });
    }

    const qrCodes = buildOrderQrCodes(order, ticketDocs).map((qr) => ({
      ...qr,
      entitlementIds: entitlementDocs
        .filter((entitlement) => entitlement.metadata.tierId === qr.ticketId)
        .map((entitlement) => entitlement.id),
    }));
    const orderUpdate = {
      ticketIds: ticketDocs.map((ticket) => ticket.id),
      entitlementIds: entitlementDocs.map((entitlement) => entitlement.id),
      coverWalletIds: coverWalletDocs.map((wallet) => wallet.id),
      inventoryCommittedAt: order.inventoryCommittedAt || issuedAt,
      qrCodes,
      ticketsIssuedAt: order.ticketsIssuedAt || issuedAt,
      fulfillmentStatus: 'authoritative_committed',
      updatedAt: issuedAt,
    };
    if (!isCompleteReplay) transaction.update(orderRef, orderUpdate);

    if (!outboxSnapshot.exists) {
      transaction.create(outboxRef, {
        id: outboxRef.id,
        type: 'ticket.purchase.confirmed',
        aggregateId: order.id,
        orderId: order.id,
        eventId: order.eventId,
        userId: order.userId,
        hostId: order.hostId,
        venueId: order.venueId || null,
        promoterId: order.promoterId || null,
        coverWalletIds: coverWalletDocs.map((wallet) => wallet.id),
        requestId,
        status: 'pending',
        attempts: 0,
        createdAt: issuedAt,
      });
    }

    result = {
      order: { ...order, ...orderUpdate },
      tickets: ticketDocs,
      entitlements: entitlementDocs,
      coverWallets: coverWalletDocs,
      alreadyFinalized: isCompleteReplay,
      outboxEventId: outboxRef.id,
      outboxDispatchRequired:
        !outboxSnapshot.exists || outboxSnapshot.data()?.status !== 'dispatched',
    };
  });

  if (result.outboxDispatchRequired) {
    dispatchTicketPurchaseOutbox(db, result.outboxEventId).catch((error) => {
      console.error('[ticketing] Failed to dispatch free ticket purchased event:', error);
    });
  }

  return {
    success: true,
    orderId: result.order.id,
    status: 'confirmed',
    alreadyFinalized: result.alreadyFinalized,
    ticketIds: result.tickets.map((ticket) => ticket.id),
    entitlementIds: result.entitlements.map((entitlement) => entitlement.id),
    coverWalletIds: result.coverWallets.map((wallet) => wallet.id),
    outboxEventId: result.outboxEventId,
    order: result.order,
    tickets: result.tickets,
  };
}

async function findPaymentRecordByRazorpayOrderId(db, transaction, razorpayOrderId) {
  const snapshot = await transaction.get(
    db.collection('payments').where('razorpayOrderId', '==', razorpayOrderId).limit(2),
  );

  if (snapshot.empty) {
    throw codedError('Payment order not found', 'NOT_FOUND');
  }

  if (snapshot.docs.length > 1) {
    throw codedError('Payment order is ambiguous', 'CONFLICT');
  }

  const doc = snapshot.docs[0];
  return {
    ref: doc.ref,
    data: doc.data(),
  };
}

async function getPaidOrderForPayment(db, transaction, payment) {
  const orderId = payment?.orderId;
  if (!orderId) throw codedError('Payment record is missing order id', 'CONFLICT');

  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await transaction.get(orderRef);
  if (orderDoc.exists) {
    return {
      ref: orderRef,
      collection: 'orders',
      data: { id: orderDoc.id, ...orderDoc.data(), isRSVP: false },
    };
  }

  throw codedError('Order not found', 'NOT_FOUND');
}

async function getEventSnapshot(db, transaction, eventId) {
  if (!eventId) return null;
  const doc = await transaction.get(db.collection('events').doc(eventId));
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getProviderPayment({
  razorpayOrderId,
  razorpayPaymentId,
  paymentRecord,
  paymentGatewayConfig,
  providerPayment,
}) {
  if (providerPayment) return providerPayment;

  const isMock = isMockRazorpayPayload(razorpayOrderId, razorpayPaymentId, '');
  if (isMock) {
    if (!paymentGatewayConfig.allowMockPayment) {
      throw codedError('Mock payments are disabled', 'BAD_REQUEST');
    }
    return {
      id: razorpayPaymentId,
      order_id: razorpayOrderId,
      amount: Number(
        paymentRecord.amountPaise ?? Math.round(Number(paymentRecord.amount || 0) * 100),
      ),
      currency: String(paymentRecord.currency || 'INR').toUpperCase(),
      status: 'captured',
      captured: true,
    };
  }

  const keyId = paymentGatewayConfig.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = paymentGatewayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw codedError('Payment verification is not configured', 'PAYMENT_NOT_CONFIGURED');
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpay.payments.fetch(razorpayPaymentId);
}

function validateProviderPayment(providerPayment, razorpayOrderId, order) {
  if (providerPayment?.order_id !== razorpayOrderId) {
    throw codedError('Payment does not belong to this Razorpay order', 'PAYMENT_ALREADY_LINKED');
  }
  if (Number(providerPayment?.amount) !== Number(order.totalPaise)) {
    throw codedError('Payment amount mismatch', 'PAYMENT_AMOUNT_MISMATCH');
  }
  if (
    String(providerPayment?.currency || '').toUpperCase() !==
    String(order.currency || 'INR').toUpperCase()
  ) {
    throw codedError('Payment currency mismatch', 'PAYMENT_AMOUNT_MISMATCH');
  }
  if (
    String(providerPayment?.status || '').toLowerCase() !== 'captured' ||
    providerPayment?.captured === false
  ) {
    throw codedError('Payment has not been captured', 'PAYMENT_NOT_CAPTURED');
  }
}

function buildFulfillmentTickets(order) {
  return normalizeOrderTickets(order).map((ticket) => ({
    tierId: ticket.ticketId || ticket.tierId,
    ticketId: ticket.ticketId || ticket.tierId,
    tierName: ticket.name || ticket.tierName,
    name: ticket.name || ticket.tierName,
    quantity: Number(ticket.quantity || 1),
    entryType: ticket.entryType || 'general',
    genderRequirement: ticket.genderRequirement,
  }));
}

export async function dispatchTicketPurchaseOutbox(db, outboxId) {
  const ref = db.collection('domain_event_outbox').doc(outboxId);
  const leaseId = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 60_000).toISOString();
  let outbox = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw codedError('Ticket purchase outbox record not found', 'NOT_FOUND');
    }
    const current = snapshot.data();
    if (current.status === 'dispatched') {
      outbox = { ...current, alreadyDispatched: true };
      return;
    }
    if (
      current.status === 'dispatching' &&
      current.leaseExpiresAt &&
      new Date(current.leaseExpiresAt).getTime() > now.getTime()
    ) {
      outbox = { ...current, leasedByAnotherWorker: true };
      return;
    }
    transaction.update(ref, {
      status: 'dispatching',
      leaseId,
      leaseExpiresAt,
      lastAttemptAt: now.toISOString(),
      attempts: FieldValue.increment(1),
      updatedAt: now.toISOString(),
    });
    outbox = current;
  });

  if (outbox?.alreadyDispatched || outbox?.leasedByAnotherWorker) {
    return {
      success: true,
      alreadyDispatched: Boolean(outbox.alreadyDispatched),
      leasedByAnotherWorker: Boolean(outbox.leasedByAnotherWorker),
    };
  }

  try {
    const orderDoc = await db.collection('orders').doc(outbox.orderId).get();
    if (!orderDoc.exists || orderDoc.data()?.status !== 'confirmed') {
      throw codedError('Outbox order is not confirmed', 'ORDER_NOT_FINALIZABLE');
    }
    const order = { id: orderDoc.id, ...orderDoc.data() };
    const dispatch = await sendEvent(
      Events.TICKET_PURCHASED,
      {
        orderId: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        eventId: order.eventId,
        tickets: buildFulfillmentTickets(order),
        totalAmount: order.totalAmount,
        totalPaise: order.totalPaise,
        ticketsCount: Array.isArray(order.ticketIds) ? order.ticketIds.length : 0,
      },
      { idempotencyKey: outboxId },
    );
    if (!dispatch?.success) {
      throw codedError(
        dispatch?.error || 'Outbox provider rejected event',
        'OUTBOX_DISPATCH_FAILED',
      );
    }

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.leaseId !== leaseId) return;
      transaction.update(ref, {
        status: 'dispatched',
        dispatchedAt: new Date().toISOString(),
        leaseId: null,
        leaseExpiresAt: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });
    });
    return { success: true, alreadyDispatched: false };
  } catch (error) {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data()?.leaseId !== leaseId) return;
      transaction.update(ref, {
        status: 'pending',
        leaseId: null,
        leaseExpiresAt: null,
        lastError: String(error?.message || error).slice(0, 500),
        updatedAt: new Date().toISOString(),
      });
    });
    throw error;
  }
}

export async function retryPendingTicketPurchaseOutbox(db = getAdminDb(), { limit = 50 } = {}) {
  const snapshot = await db
    .collection('domain_event_outbox')
    .where('status', 'in', ['pending', 'dispatching'])
    .limit(Math.min(Math.max(Number(limit) || 1, 1), 100))
    .get();
  const results = [];
  for (const doc of snapshot.docs) {
    try {
      const result = await dispatchTicketPurchaseOutbox(db, doc.id);
      results.push({ outboxId: doc.id, ...result });
    } catch (error) {
      results.push({
        outboxId: doc.id,
        success: false,
        error: String(error?.message || error),
      });
    }
  }
  return {
    processed: results.length,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  };
}

export async function finalizeTicketPayment({
  db = getAdminDb(),
  userId = null,
  source = 'client',
  requestId = null,
  expectedOrderId = null,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature = null,
  webhookVerified = false,
  providerPayment = null,
  paymentGatewayConfig = {},
}) {
  if (source === 'client') {
    if (!userId) throw codedError('Unauthorized', 'UNAUTHORIZED');
    verifyRazorpayCheckoutSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keySecret: paymentGatewayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET,
      allowMockPayment: !!paymentGatewayConfig.allowMockPayment,
    });
  } else if (source === 'webhook' && !webhookVerified) {
    throw codedError('Webhook authenticity was not verified', 'PAYMENT_SIGNATURE_INVALID');
  }

  const paymentQuery = await db
    .collection('payments')
    .where('razorpayOrderId', '==', razorpayOrderId)
    .limit(2)
    .get();
  if (paymentQuery.empty) throw codedError('Payment order not found', 'NOT_FOUND');
  if (paymentQuery.docs.length !== 1) {
    throw codedError('Payment order is ambiguous', 'ORDER_NOT_FINALIZABLE');
  }
  const initialPayment = paymentQuery.docs[0].data();
  const verifiedProviderPayment = await getProviderPayment({
    razorpayOrderId,
    razorpayPaymentId,
    paymentRecord: initialPayment,
    paymentGatewayConfig,
    providerPayment,
  });

  const issuedAt = new Date().toISOString();
  let result = null;

  try {
    await db.runTransaction(async (transaction) => {
      const paymentLookup = await findPaymentRecordByRazorpayOrderId(
        db,
        transaction,
        razorpayOrderId,
      );
      const payment = paymentLookup.data;
      const orderLookup = await getPaidOrderForPayment(db, transaction, payment);
      const order = orderLookup.data;
      const event = await getEventSnapshot(db, transaction, order.eventId);
      if (!event) throw codedError('Event not found', 'NOT_FOUND');

      if (source === 'client' && (payment.userId !== userId || order.userId !== userId)) {
        throw codedError('Forbidden', 'FORBIDDEN');
      }
      if (expectedOrderId && order.id !== expectedOrderId) {
        throw codedError(
          'Payment does not belong to the requested order',
          'PAYMENT_ALREADY_LINKED',
        );
      }
      if (payment.razorpayPaymentId && payment.razorpayPaymentId !== razorpayPaymentId) {
        throw codedError(
          'Payment order already verified with a different payment id',
          'PAYMENT_ALREADY_LINKED',
        );
      }
      if (
        order.status !== 'confirmed' &&
        !PAYMENT_PENDING_STATUSES.has(String(order.status || ''))
      ) {
        throw codedError(`Order is ${order.status}`, 'ORDER_NOT_FINALIZABLE');
      }
      if (!order.hostId) {
        throw codedError('Order is missing host attribution', 'ORDER_ATTRIBUTION_MISSING');
      }
      if (!Number.isSafeInteger(Number(order.totalPaise))) {
        throw codedError('Order is missing integer payment total', 'ORDER_NOT_FINALIZABLE');
      }
      const paymentAmountPaise = Number(
        payment.amountPaise ?? Math.round(Number(payment.amount || 0) * 100),
      );
      if (paymentAmountPaise !== Number(order.totalPaise)) {
        throw codedError('Payment record amount mismatch', 'PAYMENT_AMOUNT_MISMATCH');
      }
      validateProviderPayment(verifiedProviderPayment, razorpayOrderId, order);

      const ticketDocs = buildTicketDocuments(order, event, issuedAt);
      if (ticketDocs.length === 0 || ticketDocs.length > 50) {
        throw codedError(
          'Ticket quantity is outside the atomic finalization limit',
          'TICKET_TRANSACTION_LIMIT_EXCEEDED',
        );
      }
      const entitlementDocs = buildEntitlementDocuments(order, event, ticketDocs, issuedAt);
      const coverWalletDocs = buildCoverWalletDocumentsForOrder(order, event, issuedAt);
      const ticketRefs = ticketDocs.map((ticket) => db.collection('tickets').doc(ticket.id));
      const entitlementRefs = entitlementDocs.map((entitlement) =>
        db.collection('entitlements').doc(entitlement.id),
      );
      const coverWalletRefs = coverWalletDocs.map((wallet) =>
        db.collection('cover_wallets').doc(wallet.id),
      );
      const expectedLedgerPosting = buildPartnerLedgerEntries({
        order,
        event,
        paymentId: razorpayPaymentId,
        createdAt: issuedAt,
      });
      const ledgerRefs = expectedLedgerPosting.entries.map((entry) =>
        db.collection('partner_ledger').doc(entry.id),
      );
      const markerRef = db.collection('partner_ledger_idempotency').doc(order.id);
      const outboxRef = db.collection('domain_event_outbox').doc(`ticket-purchase-${order.id}`);
      const paymentLinkQuery = db
        .collection('payments')
        .where('razorpayPaymentId', '==', razorpayPaymentId)
        .limit(2);

      const [
        ticketSnapshots,
        entitlementSnapshots,
        coverWalletSnapshots,
        ledgerSnapshots,
        markerSnapshot,
        outboxSnapshot,
        paymentLinks,
      ] = await Promise.all([
        Promise.all(ticketRefs.map((ref) => transaction.get(ref))),
        Promise.all(entitlementRefs.map((ref) => transaction.get(ref))),
        Promise.all(coverWalletRefs.map((ref) => transaction.get(ref))),
        Promise.all(ledgerRefs.map((ref) => transaction.get(ref))),
        transaction.get(markerRef),
        transaction.get(outboxRef),
        transaction.get(paymentLinkQuery),
      ]);

      const conflictingPayment = paymentLinks.docs?.find((doc) => doc.data().orderId !== order.id);
      if (conflictingPayment) {
        throw codedError('Payment is already linked to another order', 'PAYMENT_ALREADY_LINKED');
      }
      for (const [kind, snapshots, expectedDocuments] of [
        ['ticket', ticketSnapshots, ticketDocs],
        ['entitlement', entitlementSnapshots, entitlementDocs],
        ['coverWallet', coverWalletSnapshots, coverWalletDocs],
      ]) {
        snapshots.forEach((snapshot, index) => {
          if (
            snapshot.exists &&
            !finalizationArtifactMatches(kind, snapshot.data(), expectedDocuments[index])
          ) {
            throw codedError(
              `${kind} finalization artifact conflicts with the authoritative order`,
              'FINALIZATION_ARTIFACT_CONFLICT',
            );
          }
        });
      }

      const isCompleteReplay =
        order.status === 'confirmed' &&
        payment.status === 'verified' &&
        markerSnapshot.exists &&
        ticketSnapshots.every((doc) => doc.exists) &&
        entitlementSnapshots.every((doc) => doc.exists) &&
        coverWalletSnapshots.every((doc) => doc.exists) &&
        ledgerSnapshots.every((doc, index) => {
          if (!doc.exists) return false;
          const actual = doc.data();
          const expected = expectedLedgerPosting.entries[index];
          return (
            doc.id === expected.id &&
            actual.orderId === expected.orderId &&
            actual.paymentId === expected.paymentId &&
            actual.eventId === expected.eventId &&
            actual.type === expected.type &&
            actual.amountPaise === expected.amountPaise &&
            actual.currency === expected.currency &&
            actual.toPartnerId === expected.toPartnerId &&
            actual.fromPartnerId === expected.fromPartnerId
          );
        });

      if (!isCompleteReplay && order.status === 'confirmed') {
        throw codedError(
          'Confirmed order is missing atomic finalization artifacts',
          'LEDGER_IDEMPOTENCY_CONFLICT',
        );
      }

      if (!isCompleteReplay) {
        await commitInventory(transaction, {
          db,
          event,
          items: order.tickets,
          reservationId: order.reservationId || null,
        });
      }

      const ledger = writePartnerLedgerInTransaction({
        db,
        transaction,
        order,
        event,
        paymentId: razorpayPaymentId,
        createdAt: issuedAt,
        markerSnapshot,
        ticketCount: entitlementDocs.length,
      });

      ticketSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) transaction.create(ticketRefs[index], ticketDocs[index]);
      });
      entitlementSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) {
          transaction.create(entitlementRefs[index], entitlementDocs[index]);
        }
      });
      coverWalletSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) {
          transaction.create(coverWalletRefs[index], coverWalletDocs[index]);
        }
      });

      const qrCodes = buildOrderQrCodes(order, ticketDocs).map((qr) => ({
        ...qr,
        entitlementIds: entitlementDocs
          .filter((entitlement) => entitlement.metadata.tierId === qr.ticketId)
          .map((entitlement) => entitlement.id),
      }));
      const orderUpdate = {
        status: 'confirmed',
        paymentId: razorpayPaymentId,
        paymentOrderId: razorpayOrderId,
        ticketIds: ticketDocs.map((ticket) => ticket.id),
        entitlementIds: entitlementDocs.map((entitlement) => entitlement.id),
        coverWalletIds: coverWalletDocs.map((wallet) => wallet.id),
        ledgerMarkerId: ledger.markerId,
        inventoryCommittedAt: order.inventoryCommittedAt || issuedAt,
        qrCodes,
        ticketsIssuedAt: order.ticketsIssuedAt || issuedAt,
        confirmedAt: order.confirmedAt || issuedAt,
        fulfillmentStatus: 'authoritative_committed',
        updatedAt: issuedAt,
      };
      transaction.update(orderLookup.ref, orderUpdate);
      transaction.update(paymentLookup.ref, {
        status: 'verified',
        razorpayPaymentId,
        providerAmountPaise: Number(verifiedProviderPayment.amount),
        providerCurrency: String(verifiedProviderPayment.currency || 'INR').toUpperCase(),
        verifiedAt: payment.verifiedAt || issuedAt,
        updatedAt: issuedAt,
      });

      if (!outboxSnapshot.exists) {
        transaction.create(outboxRef, {
          id: outboxRef.id,
          type: 'ticket.purchase.confirmed',
          aggregateId: order.id,
          orderId: order.id,
          eventId: order.eventId,
          userId: order.userId,
          hostId: order.hostId,
          venueId: order.venueId || null,
          promoterId: order.promoterId || null,
          coverWalletIds: coverWalletDocs.map((wallet) => wallet.id),
          requestId,
          status: 'pending',
          attempts: 0,
          createdAt: issuedAt,
        });
      }

      result = {
        order: { ...order, ...orderUpdate },
        tickets: ticketDocs,
        entitlements: entitlementDocs,
        coverWallets: coverWalletDocs,
        alreadyFinalized: isCompleteReplay,
        ledgerMarkerId: ledger.markerId,
        outboxEventId: outboxRef.id,
        outboxDispatchRequired:
          !outboxSnapshot.exists || outboxSnapshot.data()?.status !== 'dispatched',
        reservationId: order.reservationId || null,
      };
    });
  } catch (error) {
    const captured =
      String(verifiedProviderPayment?.status || '').toLowerCase() === 'captured' &&
      verifiedProviderPayment?.captured !== false;
    if (captured && initialPayment.orderId) {
      await Promise.allSettled([
        db
          .collection('orders')
          .doc(initialPayment.orderId)
          .update({
            paymentFinalizationStatus: 'payment_received_finalization_pending',
            paymentFinalizationPaymentId: razorpayPaymentId,
            paymentFinalizationLastErrorCode: error?.code || 'TRANSACTION_FAILED',
            paymentFinalizationLastAttemptAt: issuedAt,
            updatedAt: issuedAt,
          }),
        paymentQuery.docs[0].ref.update({
          status: 'captured_finalization_pending',
          razorpayPaymentId,
          providerAmountPaise: Number(verifiedProviderPayment.amount),
          providerCurrency: String(verifiedProviderPayment.currency || 'INR').toUpperCase(),
          finalizationLastErrorCode: error?.code || 'TRANSACTION_FAILED',
          finalizationLastAttemptAt: issuedAt,
          updatedAt: issuedAt,
        }),
      ]);
    }

    const nonRetryableCodes = new Set([
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'PAYMENT_SIGNATURE_INVALID',
      'PAYMENT_NOT_CAPTURED',
      'PAYMENT_AMOUNT_MISMATCH',
      'PAYMENT_ALREADY_LINKED',
      'ORDER_ATTRIBUTION_MISSING',
      'ORDER_NOT_FINALIZABLE',
      'LEDGER_IDEMPOTENCY_CONFLICT',
      'FINALIZATION_ARTIFACT_CONFLICT',
      'TICKET_TRANSACTION_LIMIT_EXCEEDED',
    ]);
    if (nonRetryableCodes.has(error?.code)) throw error;

    const retryError = codedError(
      'Payment was received but finalization must be retried',
      'FINALIZATION_RETRY_REQUIRED',
    );
    retryError.cause = error;
    retryError.orderId = initialPayment.orderId;
    retryError.paymentId = razorpayPaymentId;
    throw retryError;
  }

  const order = result.order;
  let chat = null;
  let chatUnlocked = false;
  let reservationReleased = false;

  if (!result.alreadyFinalized) {
    try {
      const chatResult = await ensureEventChatMembership(db, {
        eventId: order.eventId,
        userId: order.userId,
        userEmail: order.userEmail || null,
        source: 'ticket',
        orderId: order.id,
      });
      chat = { id: chatResult.chat.id, memberId: chatResult.member.id };
      chatUnlocked = true;
    } catch (error) {
      console.warn('[ticketing] Failed to unlock event chat after payment verify:', error.message);
    }

    if (result.reservationId) {
      try {
        reservationReleased = Boolean((await releaseReservation(result.reservationId))?.success);
      } catch (error) {
        console.warn('[ticketing] Failed to release paid cart reservation:', error.message);
      }
    }
  }

  if (result.outboxDispatchRequired) {
    dispatchTicketPurchaseOutbox(db, result.outboxEventId).catch(async (error) => {
      console.error('[ticketing] Failed to dispatch ticket purchased event:', error);
    });
  }

  return {
    success: true,
    orderId: order.id,
    paymentId: razorpayPaymentId,
    status: 'confirmed',
    alreadyFinalized: result.alreadyFinalized,
    alreadyVerified: result.alreadyFinalized,
    ticketIds: result.tickets.map((ticket) => ticket.id),
    entitlementIds: result.entitlements.map((entitlement) => entitlement.id),
    coverWalletIds: result.coverWallets.map((wallet) => wallet.id),
    ledgerMarkerId: result.ledgerMarkerId,
    reservationReleased,
    redisReleased: reservationReleased,
    outboxEventId: result.outboxEventId,
    order,
    tickets: result.tickets,
    ticketsCount: result.tickets.length,
    razorpayOrderId,
    razorpayPaymentId,
    chatUnlocked,
    chat,
  };
}

export async function verifyCheckoutPayment({
  db = getAdminDb(),
  userId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  paymentGatewayConfig = {},
  requestId = null,
}) {
  return finalizeTicketPayment({
    db,
    userId,
    source: 'client',
    requestId,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    paymentGatewayConfig,
  });
}

/**
 * Dead-letter handler: called after a ticketing workflow exhausts all retries.
 * Writes a record to `fulfillment_failures` so ops can observe and reprocess.
 */
export const handleTicketFulfillmentFailure = inngest.createFunction(
  { id: 'ticket-fulfillment-on-failure' },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    if (event.data.function_id !== 'ticket-fulfillment-pipeline') return;
    const db = getAdminDb();
    const { orderId, eventId, userId } = event.data.event?.data || {};
    await db.collection('fulfillment_failures').add({
      functionId: event.data.function_id,
      runId: event.data.run_id,
      orderId: orderId ?? null,
      eventId: eventId ?? null,
      userId: userId ?? null,
      error: event.data.error?.message ?? 'unknown',
      failedAt: new Date().toISOString(),
      status: 'pending_review',
    });
  },
);

/**
 * PRODUCTION WORKFLOW: Ticket Fulfillment Pipeline
 *
 * Triggered after payment confirmation. Handles all post-purchase work:
 * 1. Issue entitlements (QR codes)
 * 2. Generate ticket PDF
 * 3. Send confirmation email
 * 4. Notify promoter (if applicable)
 * 5. Update analytics
 *
 * Each step is independently retriable with automatic backoff.
 */
export const handleTicketFulfillment = inngest.createFunction(
  {
    id: 'ticket-fulfillment-pipeline',
    name: 'Ticket Fulfillment Pipeline',
    retries: 5, // Retry up to 5 times on failure
    throttle: {
      limit: 100, // Max 100 concurrent executions
      period: '1m',
      key: 'event.data.eventId', // Per-event throttling
    },
  },
  { event: Events.TICKET_PURCHASED },
  async ({ event, step }) => {
    const {
      orderId,
      userId,
      userEmail,
      eventId,
      tickets,
      totalAmount,
      ticketsCount,
      promoterCode,
    } = event.data;
    const db = getAdminDb();

    // Entitlements are authoritative transaction artifacts. The workflow may
    // read them for downstream delivery, but it must never issue or repair them.
    const entitlements = await step.run('load-committed-entitlements', async () => {
      const snapshot = await db.collection('entitlements').where('orderId', '==', orderId).get();
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (rows.length !== Number(ticketsCount || 0)) {
        throw codedError('Atomic entitlement set is incomplete', 'FINALIZATION_RETRY_REQUIRED');
      }
      return rows;
    });

    await step.run('mark-post-commit-fulfillment-started', async () => {
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists || orderDoc.data()?.status !== 'confirmed') {
        throw codedError('Order is not atomically finalized', 'FINALIZATION_RETRY_REQUIRED');
      }
      await db.collection('orders').doc(orderId).update({
        fulfillmentStatus: 'post_commit_processing',
        postCommitStartedAt: new Date().toISOString(),
      });
      return { entitlements: entitlements.length };
    });

    // Step 2b: Unlock the event group chat for the ticket holder.
    // This writes one per-user membership row and avoids fan-out to every attendee.
    const chatResult = await step.run('unlock-event-chat', async () => {
      if (!userId || !eventId) return { skipped: true, reason: 'Missing userId or eventId' };
      const result = await ensureEventChatMembership(db, {
        eventId,
        userId,
        userEmail,
        source: 'ticket',
        orderId,
      });
      return { chatId: result.chat.id, memberId: result.member.id };
    });

    // Step 3: Generate PDF ticket (placeholder - integrate with PDF service)
    const pdfResult = await step.run('generate-ticket-pdf', async () => {
      // In production, call your PDF generation service (e.g., Puppeteer, PDFKit, or external API)
      // For now, we return a placeholder URL
      const pdfUrl = `${process.env.APP_BASE_URL || 'https://c1rcle.com'}/api/tickets/${orderId}/download`;

      // Store PDF reference
      await db.collection('orders').doc(orderId).update({
        ticketPdfUrl: pdfUrl,
        pdfGeneratedAt: new Date().toISOString(),
      });

      return { pdfUrl };
    });

    // Step 4: Send confirmation email via your email service
    const emailResult = await step.run('send-confirmation-email', async () => {
      // Fetch event details for email
      const eventDoc = await db.collection('events').doc(eventId).get();
      const eventData = eventDoc.exists ? eventDoc.data() : null;

      if (!eventData || !userEmail) {
        return { skipped: true, reason: 'Missing event data or email' };
      }

      // Import and call your existing email function
      // This is a dynamic import since email service may not be in core
      const emailPayload = {
        to: userEmail,
        templateId: 'ticket_confirmation',
        data: {
          orderId,
          eventName: eventData.title,
          eventDate: eventData.startDate,
          eventLocation: eventData.location,
          ticketCount: entitlements.length,
          totalAmount,
          pdfUrl: pdfResult.pdfUrl,
          entitlementIds: entitlements.map((e) => e.id),
        },
      };

      const emailRef = db.collection('email_queue').doc(`ticket-confirmation-${orderId}`);
      let alreadyQueued = false;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(emailRef);
        if (snapshot.exists) {
          alreadyQueued = true;
          return;
        }
        transaction.create(emailRef, {
          ...emailPayload,
          orderId,
          eventId,
          userId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      });

      return { queued: true, alreadyQueued, to: userEmail };
    });

    // Step 6: Update event stats on the main event document.
    // Runs here (background) rather than in the synchronous fulfillment path to avoid
    // hitting Firestore's ~1 write/s/doc limit during high-volume drops.
    // Inngest throttles this to ≤100 executions/min/event, preventing write bursts.
    await step.run('update-event-stats', async () => {
      const count = ticketsCount ?? entitlements.length;
      const updates = {
        'stats.ticketsSold': FieldValue.increment(count),
        'stats.totalRevenue': FieldValue.increment(totalAmount || 0),
      };

      if (Array.isArray(tickets)) {
        for (const item of tickets) {
          const phase = item.priceLabel || 'Regular';
          const qty = Number(item.quantity) || 1;
          const rev = Number(item.total || item.subtotal || item.price * qty) || 0;
          updates[`stats.salesByPhase.${phase}.ticketsSold`] = FieldValue.increment(qty);
          updates[`stats.salesByPhase.${phase}.revenue`] = FieldValue.increment(rev);
        }
      }

      await db.collection('events').doc(eventId).update(updates);
      return { ticketsSold: count, revenue: totalAmount };
    });

    // Step 7: Update real-time analytics
    await step.run('update-analytics', async () => {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const ticketQty = entitlements.length;

      const mainAnalyticsUpdates = {
        eventId,
        ticketsSold: FieldValue.increment(ticketQty),
        revenue: FieldValue.increment(totalAmount),
        ordersCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (Array.isArray(tickets)) {
        for (const item of tickets) {
          const phase = item.priceLabel || 'Regular';
          const qty = Number(item.quantity) || 1;
          const rev = Number(item.total || item.subtotal || item.price * qty) || 0;
          mainAnalyticsUpdates[`salesByPhase.${phase}.ticketsSold`] = FieldValue.increment(qty);
          mainAnalyticsUpdates[`salesByPhase.${phase}.revenue`] = FieldValue.increment(rev);
        }
      }

      await Promise.all([
        db.collection('event_analytics').doc(eventId).set(mainAnalyticsUpdates, { merge: true }),
        db
          .collection('event_analytics')
          .doc(`${eventId}_${dateKey}`)
          .set(
            {
              eventId,
              date: dateKey,
              ticketsSold: FieldValue.increment(ticketQty),
              revenue: FieldValue.increment(totalAmount),
              ordersCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
      ]);

      return { updated: true };
    });

    await step.run('mark-post-commit-fulfillment-complete', async () => {
      await db
        .collection('orders')
        .doc(orderId)
        .update({
          fulfillmentStatus: 'fulfilled',
          chatUnlocked: !chatResult?.skipped,
          chatId: chatResult?.chatId || null,
          confirmationEmailQueued: Boolean(emailResult?.queued),
          postCommitCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      return { fulfilled: true };
    });

    // Return final status
    return {
      status: 'fulfilled',
      orderId,
      entitlementCount: entitlements.length,
      emailQueued: Boolean(emailResult?.queued),
      fulfilledAt: new Date().toISOString(),
    };
  },
);

/**
 * PRODUCTION WORKFLOW: Event Reminder Notifications
 *
 * Scheduled to run 2 hours before event start.
 * Sends push notifications and emails to all ticket holders.
 */
export const sendEventReminders = inngest.createFunction(
  {
    id: 'send-event-reminders',
    name: 'Event Reminder Notifications',
    retries: 3,
  },
  { event: Events.REMINDER_SCHEDULED },
  async ({ event, step }) => {
    const { eventId, eventName, eventDate, venueAddress } = event.data;
    const db = getAdminDb();

    // Get all confirmed orders for this event
    const orders = await step.run('fetch-attendees', async () => {
      const snapshot = await db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('status', '==', 'confirmed')
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        userEmail: doc.data().userEmail,
        userId: doc.data().userId,
        userName: doc.data().userName,
      }));
    });

    // Send reminders in batches
    const batchSize = 50;
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);

      await step.run(`send-reminder-batch-${Math.floor(i / batchSize)}`, async () => {
        for (const order of batch) {
          await db.collection('notification_queue').add({
            userId: order.userId,
            email: order.userEmail,
            type: 'event_reminder',
            title: `${eventName} starts in 2 hours!`,
            body: `Don't forget! ${eventName} at ${venueAddress}`,
            data: { eventId, orderId: order.id },
            status: 'pending',
            scheduledFor: new Date().toISOString(),
          });
        }
        return { sent: batch.length };
      });
    }

    return {
      status: 'reminders_queued',
      eventId,
      recipientCount: orders.length,
    };
  },
);

/**
 * PRODUCTION WORKFLOW: Post-Event Settlement
 *
 * Runs after an event ends to:
 * 1. Finalize attendance stats
 * 2. Calculate payouts for venue/host/promoters
 * 3. Generate settlement summary
 */
export const processEventSettlement = inngest.createFunction(
  {
    id: 'process-event-settlement',
    name: 'Post-Event Settlement',
    retries: 5,
  },
  { event: Events.EVENT_ENDED },
  async ({ event, step }) => {
    const { eventId } = event.data;
    const db = getAdminDb();

    // Step 1: Finalize attendance
    const attendance = await step.run('finalize-attendance', async () => {
      const entitlements = await db
        .collection('entitlements')
        .where('eventId', '==', eventId)
        .get();

      const stats = {
        total: entitlements.size,
        consumed: 0,
        noShow: 0,
      };

      entitlements.docs.forEach((doc) => {
        const data = doc.data();
        if (data.state === 'CONSUMED') stats.consumed++;
        else stats.noShow++;
      });

      return stats;
    });

    // Step 2: Calculate authoritative finance exclusively from partner_ledger.
    const revenue = await step.run('calculate-revenue', async () => {
      const snapshot = await db.collection('partner_ledger').where('eventId', '==', eventId).get();
      const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const active = entries.filter((entry) => entry.status !== 'reversed');
      const grossRevenuePaise = active
        .filter((entry) => entry.type === 'ticket_revenue')
        .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
      const platformFeePaise = active
        .filter((entry) => entry.type === 'platform_fee')
        .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
      const orderCount = new Set(
        active
          .filter((entry) => entry.type === 'ticket_revenue')
          .map((entry) => entry.orderId)
          .filter(Boolean),
      ).size;
      return { grossRevenuePaise, platformFeePaise, orderCount, entries: active };
    });

    // Step 3: Queue deterministic participant payouts from pending allocations.
    // Ledger rows remain pending until the payout provider confirms settlement.
    await step.run('queue-payouts', async () => {
      const allocationTypes = new Set([
        'host_payout',
        'venue_share',
        'promoter_commission',
        'refund',
      ]);
      const byPartner = new Map();
      for (const entry of revenue.entries) {
        const isPendingAllocation = entry.type !== 'refund' && entry.status === 'pending';
        const isAppliedRefund = entry.type === 'refund' && entry.status !== 'reversed';
        if (
          (!isPendingAllocation && !isAppliedRefund) ||
          !allocationTypes.has(entry.type) ||
          !entry.toPartnerId
        ) {
          continue;
        }
        const current = byPartner.get(entry.toPartnerId) || {
          amountPaise: 0,
          entryIds: [],
          recipientType:
            (entry.allocationType || entry.type) === 'venue_share'
              ? 'venue'
              : (entry.allocationType || entry.type) === 'promoter_commission'
                ? 'promoter'
                : 'host',
        };
        current.amountPaise += Number(entry.amountPaise || 0);
        current.entryIds.push(entry.id);
        byPartner.set(entry.toPartnerId, current);
      }
      const now = new Date().toISOString();
      const payoutRows = [...byPartner.entries()]
        .filter(([, allocation]) => allocation.amountPaise > 0)
        .map(([partnerId, allocation]) => ({
          ref: db.collection('payout_queue').doc(`${eventId}__${partnerId}`),
          partnerId,
          allocation: {
            ...allocation,
            entryIds: [...allocation.entryIds].sort(),
          },
        }));

      return db.runTransaction(async (transaction) => {
        const existingSnapshots = [];
        for (const row of payoutRows) {
          existingSnapshots.push(await transaction.get(row.ref));
        }

        let queued = 0;
        let alreadyQueued = 0;
        for (let index = 0; index < payoutRows.length; index += 1) {
          const row = payoutRows[index];
          const existingSnapshot = existingSnapshots[index];
          const expected = {
            eventId,
            recipientId: row.partnerId,
            recipientType: row.allocation.recipientType,
            amountPaise: row.allocation.amountPaise,
            currency: 'INR',
            ledgerEntryIds: row.allocation.entryIds,
          };

          if (existingSnapshot.exists) {
            const existing = existingSnapshot.data();
            const existingEntryIds = [...(existing.ledgerEntryIds || [])].sort();
            const differs =
              existing.eventId !== expected.eventId ||
              existing.recipientId !== expected.recipientId ||
              existing.recipientType !== expected.recipientType ||
              Number(existing.amountPaise || 0) !== expected.amountPaise ||
              existing.currency !== expected.currency ||
              JSON.stringify(existingEntryIds) !== JSON.stringify(expected.ledgerEntryIds);
            if (!differs) {
              alreadyQueued += 1;
              continue;
            }
            if (existing.status === 'pending_review') {
              transaction.update(row.ref, {
                ...expected,
                updatedAt: now,
              });
              queued += 1;
              continue;
            }
            if (existing.status !== 'pending_review') {
              const error = new Error(
                `Payout queue idempotency conflict for ${eventId}/${row.partnerId}`,
              );
              error.code = 'PAYOUT_IDEMPOTENCY_CONFLICT';
              throw error;
            }
          }

          transaction.create(row.ref, {
            ...expected,
            status: 'pending_review',
            createdAt: now,
            updatedAt: now,
          });
          queued += 1;
        }

        return { queued, alreadyQueued };
      });
    });

    // Step 4: Create a settlement summary. Completion is reserved for provider
    // payout confirmation and must not be inferred from event end.
    await step.run('create-settlement-summary', async () => {
      const { entries: _entries, ...revenueSummary } = revenue;
      await db.collection('event_settlements').doc(eventId).set({
        eventId,
        attendance,
        revenue: revenueSummary,
        status: 'payouts_queued',
        queuedAt: new Date().toISOString(),
      });
      return { recorded: true };
    });

    return {
      status: 'payouts_queued',
      eventId,
      attendance,
      revenue,
    };
  },
);

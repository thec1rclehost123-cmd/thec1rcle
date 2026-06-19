import { createHmac } from 'node:crypto';
import { getAdminDb } from './admin.js';
import { getQrSecret } from './secret-registry.js';
import { releaseReservation } from './inventory-engine.js';

const PAYMENT_PENDING_STATUSES = new Set(['payment_pending', 'pending_payment']);
const WALLET_QR_TTL_SECONDS = 60;

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
  const header = { alg: 'HS256', typ: 'JWT', kid: 'ticket-wallet-v1' };
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
    throw codedError('Invalid webhook signature', 'INVALID_SIGNATURE');
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
      ticketId,
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
  checkoutService,
  razorpayOrderId,
  razorpayPaymentId,
  paymentGatewayConfig = {},
}) {
  const payment = await findPaymentByRazorpayOrderId(db, razorpayOrderId);
  const orderId = payment.orderId;
  if (!orderId) throw codedError('Payment record is missing order id', 'CONFLICT');

  const verification = await checkoutService.verifyPayment({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    userId: null,
    paymentGatewayConfig,
  });

  if (verification?.success === false) {
    return verification;
  }

  const ticketResult = await generateTicketsForOrder({ db, orderId });

  if (ticketResult?.order?.reservationId) {
    await releaseReservation(ticketResult.order.reservationId).catch(() => undefined);
  }

  return {
    success: true,
    alreadyConfirmed: Boolean(verification?.alreadyConfirmed),
    order: ticketResult.order,
    tickets: ticketResult.tickets.map((ticket) => ({
      id: ticket.id,
      ticketId: ticket.ticketId,
      eventId: ticket.eventId,
      tierId: ticket.tierId,
      status: ticket.status,
      qrMode: ticket.qrMode,
      qrExpiresAt: ticket.qrExpiresAt,
    })),
    ticketsCount: ticketResult.tickets.length,
    razorpayOrderId,
    razorpayPaymentId,
  };
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

  const ticketsSnap = await db.collection('tickets').where('userId', '==', userId).get();
  const tickets = ticketsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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
      const qr = createTicketQrJwt(ticket);
      return {
        ...ticket,
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

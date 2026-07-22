import { createHmac, randomInt } from 'node:crypto';
import { getAdminDb } from './admin.js';
import { issueWallet } from './cover-charge-engine.js';
import { releaseReservation } from './inventory-engine.js';

const PAYMENT_PENDING_STATUSES = new Set(['payment_pending', 'pending_payment']);
const WALLET_QR_MODE = 'raw_id';
const WALLET_QR_TTL_SECONDS = null;
const ORDER_COLLECTIONS = ['orders', 'rsvp_orders'];
const BOOKING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BOOKING_CODE_LENGTH = 6;

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
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

function eventTiers(event) {
  if (Array.isArray(event?.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
  if (Array.isArray(event?.tickets)) return event.tickets;
  return [];
}

function tierIdForOrderTicket(ticket) {
  return String(ticket?.ticketId || ticket?.tierId || ticket?.id || '');
}

function findEventTierForOrderTicket(event, ticket) {
  const id = tierIdForOrderTicket(ticket);
  return eventTiers(event).find((tier) => {
    const tierId = String(tier?.id || tier?.ticketId || tier?.tierId || '');
    return tierId && tierId === id;
  });
}

function resolveCoverChargeConfig(orderTicket, eventTier) {
  const addonConfig = Array.isArray(eventTier?.addOns)
    ? eventTier.addOns.find((addon) => addon?.type === 'cover_charge' || addon?.kind === 'cover_charge')
    : null;
  const candidates = [
    orderTicket?.coverChargeConfig,
    orderTicket?.coverWalletConfig,
    orderTicket?.coverCharge,
    eventTier?.coverChargeConfig,
    eventTier?.coverWalletConfig,
    eventTier?.coverCharge,
    addonConfig?.coverChargeConfig,
    addonConfig?.walletConfig,
    addonConfig,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const walletAmountPaise = Number(candidate.walletAmountPaise);
    if (candidate.enabled === false) continue;
    if (!Number.isInteger(walletAmountPaise) || walletAmountPaise <= 0) continue;
    return {
      ...candidate,
      walletAmountPaise,
      presetItems: Array.isArray(candidate.presetItems) ? candidate.presetItems : [],
    };
  }

  return null;
}

async function getEventForOrder(db, transaction, order) {
  if (!order?.eventId) return null;
  const ref = db.collection('events').doc(order.eventId);
  const doc = transaction ? await transaction.get(ref) : await ref.get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function issueCoverWalletForOrderInTransaction({ db, transaction, order, issuedAt }) {
  const tickets = normalizeOrderTickets(order);
  if (!tickets.length || !order?.id || !order?.userId || !order?.eventId) return [];

  const event = await getEventForOrder(db, transaction, order);
  const coverTicket = tickets
    .map((ticket) => ({
      ticket,
      eventTier: findEventTierForOrderTicket(event, ticket),
    }))
    .map(({ ticket, eventTier }) => ({
      ticket,
      eventTier,
      tierConfig: resolveCoverChargeConfig(ticket, eventTier),
    }))
    .find((entry) => entry.tierConfig);

  if (!coverTicket) return [];

  const venueId =
    order.venueId ||
    order.eventVenueId ||
    event?.venueId ||
    event?.venue?.id ||
    coverTicket.eventTier?.venueId ||
    null;
  if (!venueId) {
    throw codedError('Cover wallet venue is missing', 'CONFLICT');
  }

  const eventStartIso =
    normalizeDate(event?.startDate || event?.eventDate || event?.date || event?.startAt) ||
    normalizeDate(order.eventStartDate || order.eventDate || order.startDate) ||
    issuedAt;
  const guestFirstName = String(order.userName || order.customerName || 'Guest')
    .trim()
    .split(/\s+/)[0];

  const wallet = await issueWallet(
    {
      db,
      orderId: order.id,
      eventId: order.eventId,
      venueId,
      userId: order.userId,
      guestFirstName: guestFirstName || 'Guest',
      tierConfig: coverTicket.tierConfig,
      eventStartIso,
      tzOffset: event?.tzOffset || event?.timezoneOffset || '+05:30',
      termsAcceptedAt: order.termsAcceptedAt || issuedAt,
      initialState: 'PENDING',
    },
    transaction,
  );

  return [wallet];
}

function normalizeBookingCode(value) {
  const code = String(value || '')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
  return code.length === BOOKING_CODE_LENGTH &&
    [...code].every((character) => BOOKING_CODE_ALPHABET.includes(character))
    ? code
    : null;
}

function generateBookingCode(excluded = new Set()) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let index = 0; index < BOOKING_CODE_LENGTH; index += 1) {
      code += BOOKING_CODE_ALPHABET[randomInt(BOOKING_CODE_ALPHABET.length)];
    }
    if (!excluded.has(code)) {
      excluded.add(code);
      return code;
    }
  }

  let code = '';
  for (let index = 0; index < BOOKING_CODE_LENGTH; index += 1) {
    code += BOOKING_CODE_ALPHABET[randomInt(BOOKING_CODE_ALPHABET.length)];
  }
  excluded.add(code);
  return code;
}

function getExistingOrderBookingCodeMap(order) {
  const byTicket = new Map();
  const bookingCodes = Array.isArray(order?.bookingCodes) ? order.bookingCodes : [];

  bookingCodes.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const code = normalizeBookingCode(entry.bookingCode || entry.code);
    if (!code) return;
    [entry.ticketId, entry.ticketDocumentId, entry.id].filter(Boolean).forEach((id) => {
      byTicket.set(String(id), code);
    });
  });

  return byTicket;
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

function buildTicketDocuments(order, issuedAt) {
  const tickets = [];
  const usedBookingCodes = new Set();
  const existingBookingCodes = getExistingOrderBookingCodeMap(order);
  const existingPrimaryBookingCode = normalizeBookingCode(order.bookingCode);
  if (existingPrimaryBookingCode) usedBookingCodes.add(existingPrimaryBookingCode);

  for (const group of normalizeOrderTickets(order)) {
    const tierId = group.ticketId || group.tierId || group.id || 'GEN';
    const safeTierId = safeDocSegment(tierId);
    const quantity = Math.max(1, Number(group.quantity || 1));

    for (let index = 1; index <= quantity; index += 1) {
      const ticketId = `${order.id}-${tierId}-${index}`;
      const docId = `TKT-${safeDocSegment(order.id)}-${safeTierId}-${index}`.toUpperCase();
      const existingCode =
        existingBookingCodes.get(docId) ||
        existingBookingCodes.get(ticketId) ||
        (tickets.length === 0 ? existingPrimaryBookingCode : null);
      const bookingCode = existingCode || generateBookingCode(usedBookingCodes);
      usedBookingCodes.add(bookingCode);

      tickets.push({
        id: docId,
        bookingCode,
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
        qrMode: WALLET_QR_MODE,
        qrData: docId,
        qrCode: docId,
        qrPayload: docId,
        qrJwt: null,
        qrExpiresAt: null,
        scanCountAllowed: group.entryType === 'couple' ? 2 : 1,
        scanCountUsed: 0,
        source: order.isRSVP || order.source === 'rsvp' ? 'rsvp' : 'order',
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
    }
  }

  return tickets;
}

function buildOrderQrCodes(ticketDocs) {
  return ticketDocs.map((ticket, index) => {
    const rawQrValue = ticket.qrPayload || ticket.qrData || ticket.id;
    const qrValue =
      typeof rawQrValue === 'string'
        ? rawQrValue
        : typeof rawQrValue?.token === 'string'
          ? rawQrValue.token
          : ticket.id;
    return {
      ticketId: ticket.id,
      tierId: ticket.tierId,
      tierName: ticket.tierName,
      bookingCode: ticket.bookingCode || null,
      ticketIndex: index,
      qrMode: WALLET_QR_MODE,
      qrCode: qrValue,
      qrData: qrValue,
      qrPayload: qrValue,
      qrExpiresAt: null,
      isUsed: ticket.status === 'used',
      // Wallet rows are queried by their current userId, so this QR belongs to
      // the authenticated wallet owner. Share/transfer flows move ownership;
      // an absent flag must not make the buyer's valid QR look unclaimed.
      isClaimed: true,
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

async function getOrderDocument(db, transaction, orderId, orderCollection = null) {
  const collections = orderCollection ? [orderCollection] : ORDER_COLLECTIONS;

  for (const collection of collections) {
    const ref = db.collection(collection).doc(orderId);
    const doc = transaction ? await transaction.get(ref) : await ref.get();
    if (!doc.exists) continue;

    return {
      ref,
      collection,
      data: {
        id: doc.id,
        ...doc.data(),
        isRSVP: collection === 'rsvp_orders' || Boolean(doc.data()?.isRSVP),
        source: collection === 'rsvp_orders' ? 'rsvp' : doc.data()?.source,
      },
    };
  }

  throw codedError('Order not found', 'NOT_FOUND');
}

export async function issueTicketsForOrderInTransaction({
  db,
  transaction,
  orderId,
  orderCollection = null,
  orderLookup = null,
  orderUpdates = {},
  issuedAt = new Date().toISOString(),
  updateOrder = true,
  forceOrderUpdate = false,
}) {
  const lookup = orderLookup || (await getOrderDocument(db, transaction, orderId, orderCollection));
  const order = lookup.data;

  if (order.status !== 'confirmed' && !PAYMENT_PENDING_STATUSES.has(String(order.status || ''))) {
    throw codedError(`Order is ${order.status}`, 'CONFLICT');
  }

  const ticketDocs = buildTicketDocuments(order, issuedAt);
  const refs = ticketDocs.map((ticket) => db.collection('tickets').doc(ticket.id));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  const missingTicketCount = snapshots.filter((doc) => !doc.exists).length;
  const coverWallets = await issueCoverWalletForOrderInTransaction({
    db,
    transaction,
    order,
    issuedAt,
  });

  const finalTickets = ticketDocs.map((ticket, index) => {
    const existing = snapshots[index].exists
      ? { id: snapshots[index].id, ...snapshots[index].data() }
      : null;
    const merged = existing
      ? {
          ...existing,
          bookingCode: normalizeBookingCode(existing.bookingCode) || ticket.bookingCode,
          userId: existing.userId || order.userId,
          orderId: existing.orderId || order.id,
          eventId: existing.eventId || order.eventId,
          tierId: existing.tierId || ticket.tierId,
          tierName: existing.tierName || ticket.tierName,
          status: existing.status || 'active',
          source: existing.source || ticket.source,
          updatedAt: issuedAt,
        }
      : ticket;
    const qrValue = merged.id || ticket.id;
    return {
      ...merged,
      qrMode: WALLET_QR_MODE,
      qrData: qrValue,
      qrCode: qrValue,
      qrPayload: qrValue,
      qrJwt: null,
      qrExpiresAt: null,
    };
  });

  finalTickets.forEach((ticket, index) => {
    if (snapshots[index].exists) {
      transaction.update(refs[index], {
        userId: ticket.userId,
        bookingCode: ticket.bookingCode,
        orderId: ticket.orderId,
        eventId: ticket.eventId,
        tierId: ticket.tierId,
        tierName: ticket.tierName,
        status: ticket.status,
        source: ticket.source || null,
        qrMode: WALLET_QR_MODE,
        qrData: ticket.id,
        qrCode: ticket.id,
        qrPayload: ticket.qrPayload,
        qrJwt: null,
        qrExpiresAt: null,
        updatedAt: issuedAt,
      });
    } else {
      transaction.set(refs[index], ticket);
    }
  });

  const ticketIds = finalTickets.map((ticket) => ticket.id);
  const bookingCodes = finalTickets.map((ticket) => ({
    ticketId: ticket.id,
    ticketDocumentId: ticket.id,
    bookingCode: ticket.bookingCode,
    tierId: ticket.tierId || null,
    tierName: ticket.tierName || null,
  }));
  const qrCodes = buildOrderQrCodes(finalTickets);
  const nextOrderUpdates = {
    status: 'confirmed',
    ...orderUpdates,
    bookingCode: normalizeBookingCode(order.bookingCode) || bookingCodes[0]?.bookingCode || null,
    bookingCodes,
    ticketIds,
    qrCodes,
    ticketsIssuedAt: order.ticketsIssuedAt || issuedAt,
    confirmedAt: order.confirmedAt || issuedAt,
    updatedAt: issuedAt,
  };

  const existingTicketIds = Array.isArray(order.ticketIds) ? order.ticketIds : [];
  const existingOrderBookingCodes = Array.isArray(order.bookingCodes) ? order.bookingCodes : [];
  const missingBookingCodeCount = snapshots.filter(
    (doc) => !doc.exists || !normalizeBookingCode(doc.data()?.bookingCode),
  ).length;
  const needsOrderUpdate =
    forceOrderUpdate ||
    missingTicketCount > 0 ||
    missingBookingCodeCount > 0 ||
    order.status !== 'confirmed' ||
    !normalizeBookingCode(order.bookingCode) ||
    existingOrderBookingCodes.length !== bookingCodes.length ||
    existingTicketIds.length !== ticketIds.length ||
    !order.ticketsIssuedAt ||
    Object.keys(orderUpdates || {}).length > 0;

  if (updateOrder && needsOrderUpdate) {
    transaction.update(lookup.ref, nextOrderUpdates);
  }

  return {
    order: {
      ...order,
      ...nextOrderUpdates,
      isRSVP: lookup.collection === 'rsvp_orders' || Boolean(order.isRSVP),
      source: lookup.collection === 'rsvp_orders' ? 'rsvp' : order.source,
    },
    tickets: finalTickets,
    coverWallets,
    orderUpdates: nextOrderUpdates,
    missingTicketCount,
    createdTicketCount: missingTicketCount,
    collection: lookup.collection,
  };
}

export async function generateTicketsForOrder({
  db = getAdminDb(),
  orderId,
  orderCollection = null,
}) {
  let result = null;

  await db.runTransaction(async (transaction) => {
    result = await issueTicketsForOrderInTransaction({
      db,
      transaction,
      orderId,
      orderCollection,
      updateOrder: true,
    });
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
    await releaseReservation(ticketResult.order.reservationId).catch((error) => {
      console.error(
        '[finalizeRazorpayTicketPurchase] Failed to release reservation:',
        error?.message || error,
      );
    });
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
      bookingCode: ticket.bookingCode || null,
      qrMode: ticket.qrMode,
      qrData: ticket.qrData || ticket.id,
      qrPayload: ticket.qrPayload || ticket.id,
      qrExpiresAt: null,
    })),
    coverWallets: ticketResult.coverWallets || [],
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
    accentColor: event.accentColor || event.dominantColor || event.posterAccentColor || null,
    dominantColor: event.dominantColor || event.accentColor || null,
    backgroundColor: event.backgroundColor || null,
    textColor: event.textColor || null,
  };
}

function mapOrderForWallet(order, tickets, event) {
  const qrCodes = buildOrderQrCodes(tickets);
  const ticketBookingCodes = tickets
    .map((ticket) => ({
      ticketId: ticket.id,
      ticketDocumentId: ticket.id,
      bookingCode: ticket.bookingCode || null,
      tierId: ticket.tierId || null,
      tierName: ticket.tierName || null,
    }))
    .filter((entry) => entry.bookingCode);
  const orderBookingCodes = Array.isArray(order.bookingCodes) ? order.bookingCodes : [];
  const bookingCodes = orderBookingCodes.length ? orderBookingCodes : ticketBookingCodes;
  const bookingCode =
    order.bookingCode || bookingCodes[0]?.bookingCode || tickets[0]?.bookingCode || null;
  // Derive quantities from the ticket rows the authenticated user currently
  // owns. The order snapshot is purchase history and becomes stale after a
  // share or transfer; using it here can expose a QR that no longer belongs to
  // the buyer or can overstate the recipient's ticket count.
  const ticketGroupsByTier = new Map();
  tickets.forEach((ticket) => {
    const tierId = ticket.tierId || ticket.ticketId || ticket.id;
    const existing = ticketGroupsByTier.get(tierId);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal += Number(ticket.price || 0);
      return;
    }
    ticketGroupsByTier.set(tierId, {
      ticketId: ticket.id,
      tierId,
      tierName: ticket.tierName || ticket.ticketType || 'General Entry',
      quantity: 1,
      price: Number(ticket.price || 0),
      subtotal: Number(ticket.price || 0),
      entryType: ticket.entryType || 'general',
      requiredGender: ticket.requiredGender || undefined,
      receivedFrom: ticket.receivedFrom || undefined,
      isClaimed: true,
    });
  });
  const ticketGroups = [...ticketGroupsByTier.values()];

  return {
    id: order.id,
    userId: order.userId,
    userEmail: order.userEmail || undefined,
    userName: order.userName || undefined,
    eventId: order.eventId,
    eventTitle: order.eventTitle || order.eventName || event?.title || undefined,
    // The event document is canonical when an event is rescheduled. Order
    // snapshots remain useful for audit history, but must not make a valid
    // upcoming ticket appear in the past.
    eventDate:
      event?.date ||
      normalizeDate(order.eventDate || order.eventStartDate || order.startDate) ||
      undefined,
    eventStartDate:
      event?.date ||
      normalizeDate(order.eventStartDate || order.eventDate || order.startDate) ||
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
    accentColor: order.accentColor || event?.accentColor || event?.dominantColor || undefined,
    dominantColor: order.dominantColor || event?.dominantColor || event?.accentColor || undefined,
    backgroundColor: order.backgroundColor || event?.backgroundColor || undefined,
    textColor: order.textColor || event?.textColor || undefined,
    status: order.status,
    bookingCode,
    bookingCodes,
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

const CHUNK_SIZE = 30;

async function fetchDocsInChunks(db, collectionName, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const docs = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const snap = await db
      .collection(collectionName)
      .where('__name__', 'in', chunk)
      .get()
      .catch(() => null);
    if (snap) {
      snap.docs.forEach((doc) => docs.push(doc));
    }
  }
  return docs;
}

async function fetchOrderDocsBulk(db, orderIds) {
  const orderDocs = await fetchDocsInChunks(db, 'orders', orderIds);
  const rsvpDocs = await fetchDocsInChunks(db, 'rsvp_orders', orderIds);
  const byId = new Map();
  orderDocs.forEach((doc) => byId.set(doc.id, { id: doc.id, ...doc.data(), isRSVP: false }));
  rsvpDocs.forEach((doc) => {
    if (!byId.has(doc.id)) {
      byId.set(doc.id, { id: doc.id, ...doc.data(), isRSVP: true, source: 'rsvp' });
    }
  });
  return byId;
}

export async function getUserTicketWallet({ db = getAdminDb(), userId }) {
  if (!userId) throw codedError('Unauthorized', 'UNAUTHORIZED');

  // An unordered limit can permanently hide a just-purchased ticket once a
  // user has enough historical wallet rows. Keep the working set bounded but
  // deterministic, with the newest purchases first.
  let ticketDocs;
  let assignmentDocs;
  try {
    const [ticketsSnap, assignmentsSnap] = await Promise.all([
      db
        .collection('tickets')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get(),
      db
        .collection('ticket_assignments')
        .where('redeemerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get(),
    ]);
    ticketDocs = ticketsSnap.docs;
    assignmentDocs = assignmentsSnap.docs;
  } catch (error) {
    // Keep wallet reads available while a newly deployed composite index is
    // still building. Once the index is ready, the bounded query above is used.
    if (error?.code !== 9 && error?.code !== 'FAILED_PRECONDITION') throw error;
    const [fallbackSnap, assignmentFallbackSnap] = await Promise.all([
      db.collection('tickets').where('userId', '==', userId).get(),
      db.collection('ticket_assignments').where('redeemerId', '==', userId).get(),
    ]);
    ticketDocs = fallbackSnap.docs
      .sort((left, right) =>
        String(right.data()?.createdAt || '').localeCompare(String(left.data()?.createdAt || '')),
      )
      .slice(0, 50);
    assignmentDocs = assignmentFallbackSnap.docs
      .sort((left, right) =>
        String(right.data()?.createdAt || '').localeCompare(String(left.data()?.createdAt || '')),
      )
      .slice(0, 50);
  }
  let tickets = ticketDocs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((ticket) => !ticket.status || ticket.status === 'active' || ticket.status === 'used');
  const assignments = assignmentDocs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (assignment) =>
        assignment.status === 'active' || assignment.status === 'used' || !assignment.status,
    );

  if (!tickets.length && !assignments.length) {
    return {
      orders: [],
      tickets: [],
      qrTtlSeconds: WALLET_QR_TTL_SECONDS,
    };
  }

  const orderIds = [
    ...new Set(
      [...tickets, ...assignments].map((ticket) => ticket.orderId).filter(Boolean),
    ),
  ];
  const orderMap = await fetchOrderDocsBulk(db, orderIds);

  const orders = [];
  orderIds.forEach((orderId) => {
    const order = orderMap.get(orderId);
    if (order && order.userId === userId && order.status === 'confirmed') {
      orders.push(order);
    }
  });

  const assignmentOrderIds = new Set(assignments.map((assignment) => assignment.orderId));
  const assignmentOrders = [...assignmentOrderIds]
    .map((orderId) => orderMap.get(orderId))
    .filter((order) => order && order.status === 'confirmed');

  const eventIds = [
    ...new Set(
      [...orders, ...assignmentOrders].map((order) => order.eventId).filter(Boolean),
    ),
  ];
  const [eventDocs, sourceTicketDocs] = await Promise.all([
    fetchDocsInChunks(db, 'events', eventIds),
    fetchDocsInChunks(
      db,
      'tickets',
      assignments.map((assignment) => assignment.originalTicketId),
    ),
  ]);
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

  const sourceTicketsById = new Map(
    sourceTicketDocs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]),
  );
  const assignmentTickets = assignments.map((assignment) => {
    const sourceTicket = sourceTicketsById.get(assignment.originalTicketId) || {};
    const signedQrPayload =
      typeof assignment.qrPayload === 'string'
        ? assignment.qrPayload
        : typeof assignment.qrPayload?.token === 'string'
          ? assignment.qrPayload.token
          : assignment.assignmentId || assignment.id;
    return {
      ...sourceTicket,
      ...assignment,
      id: assignment.assignmentId || assignment.id,
      ticketId: assignment.assignmentId || assignment.id,
      tierId: assignment.tierId || sourceTicket.tierId || null,
      tierName:
        assignment.ticketType || sourceTicket.tierName || sourceTicket.ticketType || 'Transferred Pass',
      bookingCode: sourceTicket.bookingCode || null,
      qrMode: 'signed_assignment',
      qrData: signedQrPayload,
      qrCode: signedQrPayload,
      qrPayload: signedQrPayload,
      userId,
      source: 'transfer',
    };
  });
  assignmentOrders.forEach((order) => {
    const ownedAssignments = assignmentTickets.filter((ticket) => ticket.orderId === order.id);
    if (!ownedAssignments.length) return;
    walletOrders.push(
      mapOrderForWallet(
        {
          ...order,
          userId,
          source: 'transfer',
          bookingCode: ownedAssignments[0]?.bookingCode || null,
          bookingCodes: [],
        },
        ownedAssignments,
        eventMap.get(order.eventId),
      ),
    );
  });

  const walletTickets = tickets
    .filter((ticket) => ordersById.has(ticket.orderId))
    .map((ticket) => {
      const qrValue = ticket.id;
      return {
        ...ticket,
        qrMode: WALLET_QR_MODE,
        qrData: qrValue,
        qrCode: qrValue,
        qrPayload: qrValue,
        bookingCode: ticket.bookingCode || null,
        qrJwt: null,
        qrExpiresAt: null,
      };
    })
    .concat(assignmentTickets);

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

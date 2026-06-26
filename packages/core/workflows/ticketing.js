import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils.js';
import { inngest, Events, sendEvent } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';
import { issueEntitlements } from '../entitlement-engine.js';
import { ensureEventChatMembership } from '../guest-chat-service.js';
import { releaseReservation } from '../inventory-engine.js';
import { issueTicketsForOrderInTransaction } from '../ticket-checkout-wallet-service.js';
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

  if (!verified) throw codedError('Invalid signature', 'INVALID_SIGNATURE');
  return true;
}

function normalizeOrderTickets(order) {
  return Array.isArray(order?.tickets) ? order.tickets : [];
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

async function markFulfillmentDispatchStatus(db, order, updates) {
  try {
    await db
      .collection(order.isRSVP ? 'rsvp_orders' : 'orders')
      .doc(order.id)
      .update({
        ...updates,
        fulfillmentDispatchUpdatedAt: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[ticketing] Failed to record fulfillment dispatch status:', error);
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

export async function verifyCheckoutPayment({
  db = getAdminDb(),
  userId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  paymentGatewayConfig = {},
}) {
  const razorpayOrderId = razorpay_order_id;
  const razorpayPaymentId = razorpay_payment_id;
  const razorpaySignature = razorpay_signature;

  if (!userId) throw codedError('Unauthorized', 'UNAUTHORIZED');

  verifyRazorpayCheckoutSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    keySecret: paymentGatewayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET,
    allowMockPayment: !!paymentGatewayConfig.allowMockPayment,
  });

  const issuedAt = new Date().toISOString();
  let transactionResult;

  await db.runTransaction(async (transaction) => {
    const paymentLookup = await findPaymentRecordByRazorpayOrderId(
      db,
      transaction,
      razorpayOrderId,
    );
    const payment = paymentLookup.data;

    if (payment.userId && payment.userId !== userId) {
      throw codedError('Forbidden', 'FORBIDDEN');
    }

    if (
      payment.status === 'verified' &&
      payment.razorpayPaymentId &&
      payment.razorpayPaymentId !== razorpayPaymentId
    ) {
      throw codedError('Payment order already verified with a different payment id', 'CONFLICT');
    }

    const orderLookup = await getPaidOrderForPayment(db, transaction, payment);
    const order = orderLookup.data;

    if (order.userId && order.userId !== userId) {
      throw codedError('Forbidden', 'FORBIDDEN');
    }

    if (Number(payment.amount) !== Number(order.totalAmount)) {
      throw codedError(
        `Payment amount mismatch: expected ${order.totalAmount}, got ${payment.amount}`,
        'AMOUNT_MISMATCH',
      );
    }

    if (order.status !== 'confirmed' && !PAYMENT_PENDING_STATUSES.has(String(order.status || ''))) {
      throw codedError(`Order is ${order.status}`, 'CONFLICT');
    }

    const alreadyVerified = payment.status === 'verified' || order.status === 'confirmed';
    const ticketResult = await issueTicketsForOrderInTransaction({
      db,
      transaction,
      orderLookup,
      issuedAt,
      orderUpdates: {
        paymentId: razorpayPaymentId,
        paymentOrderId: razorpayOrderId,
        paymentSignature: razorpaySignature,
      },
      forceOrderUpdate: !alreadyVerified,
      updateOrder: true,
    });
    const allTickets = ticketResult.tickets;

    if (payment.status !== 'verified') {
      transaction.update(paymentLookup.ref, {
        status: 'verified',
        razorpayPaymentId,
        verifiedAt: issuedAt,
      });
    }

    transactionResult = {
      alreadyVerified,
      order: ticketResult.order,
      tickets: allTickets,
      reservationId: order.reservationId || null,
    };
  });

  const order = transactionResult.order;
  let chat = null;
  let chatUnlocked = false;
  let redisReleased = false;

  if (!transactionResult.alreadyVerified) {
    try {
      const chatResult = await ensureEventChatMembership(db, {
        eventId: order.eventId,
        userId: order.userId,
        userEmail: order.userEmail || null,
        source: 'ticket',
        orderId: order.id,
      });
      chat = {
        id: chatResult.chat.id,
        memberId: chatResult.member.id,
      };
      chatUnlocked = true;
    } catch (error) {
      console.warn('[ticketing] Failed to unlock event chat after payment verify:', error.message);
    }
  }

  if (!transactionResult.alreadyVerified && transactionResult.reservationId) {
    try {
      const release = await releaseReservation(transactionResult.reservationId);
      redisReleased = !!release?.success;
    } catch (error) {
      console.warn('[ticketing] Failed to release paid cart reservation:', error.message);
    }
  }

  if (!transactionResult.alreadyVerified) {
    sendEvent(
      Events.TICKET_PURCHASED,
      {
        orderId: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        eventId: order.eventId,
        tickets: buildFulfillmentTickets(order),
        totalAmount: order.totalAmount,
        ticketsCount: transactionResult.tickets.length,
        promoterCode: order.promoterCode || null,
      },
      { idempotencyKey: `ticket-purchased-${order.id}` },
    )
      .then(() =>
        markFulfillmentDispatchStatus(db, order, {
          fulfillmentDispatchStatus: 'dispatched',
          fulfillmentDispatchError: null,
        }),
      )
      .catch((error) => {
        console.error('[ticketing] Failed to dispatch ticket purchased event:', error);
        return markFulfillmentDispatchStatus(db, order, {
          fulfillmentDispatchStatus: 'retryable_failed',
          fulfillmentDispatchError: error?.message || 'Ticket purchased dispatch failed',
        });
      });
  }

  return {
    success: true,
    alreadyVerified: transactionResult.alreadyVerified,
    order: transactionResult.order,
    tickets: transactionResult.tickets.map((ticket) => ({
      id: ticket.id,
      ticketId: ticket.ticketId,
      eventId: ticket.eventId,
      tierId: ticket.tierId,
      status: ticket.status,
      qrMode: ticket.qrMode,
    })),
    ticketsCount: transactionResult.tickets.length,
    razorpayOrderId,
    razorpayPaymentId,
    chatUnlocked,
    chat,
    redisReleased,
  };
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

    // Step 1: Issue entitlements (one per human unit / quantity)
    const entitlements = await step.run('issue-entitlements', async () => {
      const order = { id: orderId, userId, eventId };
      const items = tickets.map((t) => ({
        ticketId: t.tierId,
        name: t.tierName,
        quantity: t.quantity,
        entryType: t.entryType || 'general',
        genderRequirement: t.genderRequirement,
      }));
      return await issueEntitlements(order, items);
    });

    // Step 2: Link entitlementIds back to the order.
    // For magic-mode qrCode entries, populate entitlementIds[] so the mobile app
    // can call generateEntitlementQR(id) live at display time.
    await step.run('link-entitlements-to-order', async () => {
      const orderDoc = await db.collection('orders').doc(orderId).get();
      const existingQrCodes = orderDoc.data()?.qrCodes || [];

      // Build a per-tierId bucket of entitlement IDs
      const entsByTier = {};
      for (const ent of entitlements) {
        const tierId = ent.metadata?.tierId;
        if (!tierId) continue;
        if (!entsByTier[tierId]) entsByTier[tierId] = [];
        entsByTier[tierId].push(ent.id);
      }

      // Inject entitlementIds into each magic-mode qrCode entry
      const updatedQrCodes = existingQrCodes.map((qr) => {
        if (qr.qrMode !== 'magic') return qr;
        return { ...qr, entitlementIds: entsByTier[qr.ticketId] || [] };
      });

      await db
        .collection('orders')
        .doc(orderId)
        .update({
          entitlementIds: entitlements.map((e) => e.id),
          qrCodes: updatedQrCodes,
          fulfilledAt: new Date().toISOString(),
          fulfillmentStatus: 'completed',
        });
      return { linked: entitlements.length };
    });

    // Step 2b: Unlock the event group chat for the ticket holder.
    // This writes one per-user membership row and avoids fan-out to every attendee.
    await step.run('unlock-event-chat', async () => {
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
    await step.run('send-confirmation-email', async () => {
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

      // Log the email attempt (actual sending should use your email provider)
      await db.collection('email_queue').add({
        ...emailPayload,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      return { queued: true, to: userEmail };
    });

    // Step 5: Credit promoter if applicable
    if (promoterCode) {
      await step.run('credit-promoter-commission', async () => {
        const promoDoc = await db
          .collection('promo_codes')
          .where('code', '==', promoterCode)
          .limit(1)
          .get();

        if (promoDoc.empty) return { skipped: true, reason: 'Promo code not found' };

        const promo = promoDoc.docs[0].data();
        const promoterId = promo.promoterId;
        const commissionRate = promo.commissionRate || 0.1; // 10% default

        const commission = Math.round(totalAmount * commissionRate * 100) / 100;

        // Write to partner_ledger (canonical) — skip if finance-service already wrote for this order
        const idempotencyRef = db.collection('partner_ledger_idempotency').doc(orderId);
        const idempotencyDoc = await idempotencyRef.get();
        if (!idempotencyDoc.exists) {
          const now = new Date().toISOString();
          await db.collection('partner_ledger').add({
            type: 'promoter_commission',
            toPartnerId: promoterId,
            fromPartnerId: null,
            eventId,
            referenceId: orderId,
            amount: commission,
            currency: 'INR',
            status: 'pending',
            settledAt: null,
            createdAt: now,
          });
          await db.collection('partner_ledger_idempotency').doc(`promo_${orderId}`).set({
            orderId,
            eventId,
            promoterId,
            type: 'promo_commission',
            createdAt: now,
          });
        }

        // Increment promoter stats
        await db
          .collection('promoters')
          .doc(promoterId)
          .update({
            totalSales: FieldValue.increment(totalAmount),
            totalOrders: FieldValue.increment(1),
            pendingCommission: FieldValue.increment(commission),
          });

        return { credited: true, promoterId, commission };
      });
    }

    // Step 6: Update event stats on the main event document.
    // Runs here (background) rather than in the synchronous fulfillment path to avoid
    // hitting Firestore's ~1 write/s/doc limit during high-volume drops.
    // Inngest throttles this to ≤100 executions/min/event, preventing write bursts.
    await step.run('update-event-stats', async () => {
      const count = ticketsCount ?? entitlements.length;
      await db
        .collection('events')
        .doc(eventId)
        .update({
          'stats.ticketsSold': FieldValue.increment(count),
          'stats.totalRevenue': FieldValue.increment(totalAmount || 0),
        });
      return { ticketsSold: count, revenue: totalAmount };
    });

    // Step 7: Update real-time analytics
    await step.run('update-analytics', async () => {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Atomic increment on event stats
      await db
        .collection('event_analytics')
        .doc(`${eventId}_${dateKey}`)
        .set(
          {
            eventId,
            date: dateKey,
            ticketsSold: FieldValue.increment(entitlements.length),
            revenue: FieldValue.increment(totalAmount),
            ordersCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      return { updated: true };
    });

    // Return final status
    return {
      status: 'fulfilled',
      orderId,
      entitlementCount: entitlements.length,
      emailSent: true,
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

    // Step 2: Calculate revenue
    const revenue = await step.run('calculate-revenue', async () => {
      const orders = await db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('status', '==', 'confirmed')
        .get();

      let total = 0;
      let platformFees = 0;
      let taxCollected = 0;

      orders.docs.forEach((doc) => {
        const data = doc.data();
        total += data.totalAmount || 0;
        platformFees += data.platformFee || 0;
        taxCollected += data.taxAmount || 0;
      });

      return { total, platformFees, taxCollected, orderCount: orders.size };
    });

    // Step 3: Queue payouts
    await step.run('queue-payouts', async () => {
      const eventDoc = await db.collection('events').doc(eventId).get();
      const eventData = eventDoc.data();

      const hostPayout = revenue.total - revenue.platformFees - revenue.taxCollected;

      await db.collection('payout_queue').add({
        eventId,
        recipientId: eventData.hostId,
        recipientType: 'host',
        grossAmount: revenue.total,
        platformFees: revenue.platformFees,
        netAmount: hostPayout,
        status: 'pending_review',
        createdAt: new Date().toISOString(),
      });

      return { hostPayout };
    });

    // Step 4: Mark promoter commissions as settled
    await step.run('finalize-promoter-commissions', async () => {
      const now = new Date().toISOString();
      // Settle partner_ledger entries (canonical collection)
      const ledgerSnap = await db
        .collection('partner_ledger')
        .where('eventId', '==', eventId)
        .where('type', '==', 'promoter_commission')
        .where('status', '==', 'pending')
        .get();

      const batch = db.batch();
      ledgerSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'settled', settledAt: now });
      });

      // Also settle any historical promoter_ledger entries (created before migration)
      const legacySnap = await db
        .collection('promoter_ledger')
        .where('eventId', '==', eventId)
        .where('status', '==', 'pending')
        .get();
      legacySnap.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'ready_for_payout', finalizedAt: now });
      });

      await batch.commit();
      return { promoterCommissions: ledgerSnap.size + legacySnap.size };
    });

    // Step 5: Create settlement summary
    await step.run('create-settlement-summary', async () => {
      await db.collection('event_settlements').doc(eventId).set({
        eventId,
        attendance,
        revenue,
        status: 'completed',
        settledAt: new Date().toISOString(),
      });
      return { recorded: true };
    });

    return {
      status: 'settled',
      eventId,
      attendance,
      revenue,
    };
  },
);

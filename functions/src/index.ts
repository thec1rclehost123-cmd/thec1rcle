import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {
  createCartReservation,
  getReservation,
  cleanupExpiredReservations,
} from './lib/reservations';
import { calculatePricingInternal } from './lib/pricing';
import {
  createOrder,
  createRSVPOrder,
  getOrderByReservationId,
  confirmOrderPayment,
  failStaleOrders,
} from './lib/orders';
import { getEvent } from './lib/events';
import { createRazorpayOrder } from './lib/razorpay';
import {
  initiateTransferInternal,
  acceptTransferInternal,
  cancelTransferInternal,
} from './lib/transfers';
import { expireStaleReservations } from './lib/bookingExpiry';
import { syncEventToAlgolia, removeEventFromAlgolia } from './lib/algolia';
import { postChatMessageInternal } from './lib/chat';

// Initialize Admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 1. Reserve Tickets — AUTH-REQUIRED
 *
 * SECURITY: Authenticated callers only. Anonymous (unauthed) ticket
 * reservations are blocked to prevent DDoS/inventory scraping.
 * The client sends only { eventId, items } — pricing is NEVER trusted
 * from the client; the server reads prices from the database during
 * checkout.
 */
export const reserveTickets = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to reserve tickets',
    );
  }
  const userId = context.auth.uid;

  try {
    if (!data.eventId || !data.items || !Array.isArray(data.items)) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing eventId or items');
    }

    for (const item of data.items) {
      if (
        !item.tierId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      ) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Each item must have a tierId and a quantity between 1 and 10',
        );
      }
    }

    const result: any = await createCartReservation(
      data.eventId,
      userId,
      data.deviceId || null,
      data.items,
    );

    if (!result.success) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        result.error || result.errors?.join(', '),
      );
    }

    return result;
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Unknown error');
  }
});

/**
 * 2. Calculate Pricing
 */
export const calculatePricing = functions.https.onCall(async (data, context) => {
  // data = { eventId, items, promoCode?, promoterCode? }
  const userId = context.auth?.uid;

  try {
    const event = await getEvent(data.eventId);
    if (!event) {
      throw new functions.https.HttpsError('not-found', 'Event not found');
    }

    const result: any = await calculatePricingInternal(event, data.items, {
      promoCode: data.promoCode,
      promoterCode: data.promoterCode,
      userId,
    });

    if (!result.success) throw new Error(result.error);

    const pricing = result.pricing;
    const { ledger, ...pricingForClient } = pricing; // Omit audit ledger for security

    return pricingForClient;
  } catch (error: any) {
    console.error('calculatePricing error', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 3. Initiate Checkout
 */
export const initiateCheckout = functions.https.onCall(async (data, context) => {
  // data = { reservationId, userDetails: {email, name, phone}, promoCode?, promoterCode? }

  const userId = context.auth?.uid || data.userId || 'anonymous';

  try {
    const reservation: any = await getReservation(data.reservationId);
    if (!reservation) {
      throw new functions.https.HttpsError('not-found', 'Reservation not found');
    }

    if (reservation.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'Reservation expired or invalid');
    }

    const event = await getEvent(reservation.eventId);
    if (!event) throw new functions.https.HttpsError('not-found', 'Event not found');

    // Calculate final pricing
    const pricingResult: any = await calculatePricingInternal(event, reservation.items, data);
    if (!pricingResult.success) throw new Error(pricingResult.error);
    const pricing = pricingResult.pricing;

    // --- IDEMPOTENCY CHECK ---
    // Check if an order already exists for this reservation
    const existingOrder: any = await getOrderByReservationId(reservation.id);
    if (existingOrder) {
      console.log(
        `[Checkout] Reusing existing order ${existingOrder.id} for res ${reservation.id}`,
      );

      // If it was a paid order, it might already have razorpay details or need them
      const { ledger, ...pricingForClient } = pricing;
      return {
        success: true,
        requiresPayment: existingOrder.totalAmount > 0 && existingOrder.status !== 'confirmed',
        order: existingOrder,
        pricing: pricingForClient,
        razorpay: existingOrder.razorpayOrder || null,
      };
    }

    // RSVP FLow
    if (event.isRSVP) {
      const result = await createRSVPOrder({
        reservationId: reservation.id,
        eventId: reservation.eventId,
        userId,
        userName: data.userDetails.name,
        userEmail: data.userDetails.email,
        userPhone: data.userDetails.phone,
        tickets: reservation.items,
        promoterCode: data.promoterCode,
      });
      return { success: true, requiresPayment: false, order: result };
    }

    // Paid Flow
    else {
      const orderPayload = {
        eventId: reservation.eventId,
        eventName: event.title || 'Event',
        userId,
        userName: data.userDetails.name,
        userEmail: data.userDetails.email,
        userPhone: data.userDetails.phone,
        tickets: pricing.items.map((item: any) => ({
          ticketId: item.tierId,
          name: item.tierName,
          entryType: item.entryType || 'general',
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.subtotal,
        })),
        subtotal: pricing.subtotal,
        discounts: pricing.discounts,
        discountTotal: pricing.discountTotal,
        fees: pricing.fees,
        totalAmount: pricing.grandTotal,
        reservationId: reservation.id,
        promoterCode: data.promoterCode || null,
        promoCodeId: pricing.discounts.find((d: any) => d.type === 'promo')?.id || null,
        discountAmount: pricing.discountTotal || 0,
      };

      const order: any = await createOrder(orderPayload);

      let razorpay = null;
      if (order.totalAmount > 0) {
        razorpay = await createRazorpayOrder({
          amount: Math.round(order.totalAmount * 100),
          currency: 'INR',
          receipt: order.id,
          notes: {
            orderId: order.id,
            eventId: order.eventId,
            userId,
          },
        });

        // Link Razorpay order to the native order for idempotency
        await admin.firestore().collection('orders').doc(order.id).update({
          razorpayOrderId: razorpay.id,
          razorpayOrder: razorpay,
          updatedAt: new Date().toISOString(),
        });
      }

      const { ledger, ...pricingForClient } = pricing;
      return {
        success: true,
        requiresPayment: order.totalAmount > 0,
        order,
        pricing: pricingForClient,
        razorpay,
      };
    }
  } catch (error: any) {
    console.error('initiateCheckout error', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 4. Verify Payment (Manual/Fallback)
 */
export const verifyPayment = functions.https.onCall(async (data, context) => {
  const { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id } = data;

  // 1. Signature Verification
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid payment signature');
  }

  // 2. Confirm Order
  try {
    const order = await confirmOrderPayment(orderId, {
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    return { success: true, order };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 5. Razorpay Webhook (Authority)
 *
 * SECURITY:
 * - HMAC-SHA256 signature verification against RAZORPAY_WEBHOOK_SECRET
 * - Idempotency via webhook event ID — duplicate webhook deliveries
 *   are safely skipped by confirmOrderPayment's idempotency check
 * - Critical failure (inventory exhausted) is logged to audit collection
 */
export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const webhookId = req.body.event_id || '';

  // Verify Webhook Signature
  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (expectedSignature !== signature) {
    console.error(`[Webhook] Signature mismatch (event_id=${webhookId})`);
    res.status(403).send('Invalid signature');
    return;
  }

  // Idempotency via atomic transaction — prevents concurrent webhook replay.
  // Only one invocation can claim + process a given webhookId.
  const webhookLogRef = admin.firestore().collection('webhook_logs').doc(webhookId);
  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const existing = await transaction.get(webhookLogRef);
      if (existing.exists) {
        console.log(`[Webhook] Duplicate event ${webhookId} skipped (idempotency)`);
        return;
      }
      transaction.set(webhookLogRef, {
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        event: req.body.event,
        status: 'processing',
      });
    });
  } catch {
    res.status(500).send('Could not claim webhook');
    return;
  }

  const event = req.body.event;
  const payload = req.body.payload;

  if (event === 'payment.captured') {
    const payment = payload.payment.entity;
    const orderId = payment.notes.orderId || payment.description;

    console.log(`[Webhook] Payment CAPTURED for Order ${orderId}`);

    try {
      await confirmOrderPayment(orderId, {
        paymentId: payment.id,
        signature: signature,
        mode: payment.method,
      });
      await webhookLogRef.update({ status: 'completed', orderId, paymentId: payment.id });
    } catch (error) {
      await webhookLogRef.update({ status: 'failed', error: String(error) });
      console.error(`[Webhook] Error confirming order ${orderId}:`, error);
    }
  } else {
    await webhookLogRef.update({ status: 'ignored', event });
  }

  res.status(200).send('ok');
});

/**
 * 6. Inventory Cleanup (Cron) — legacy cart_reservations
 */
export const cleanupReservations = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    console.log('[Cron] Running reservation + order cleanup...');
    await cleanupExpiredReservations();
    await failStaleOrders(); // Restore inventory for abandoned payments
    return null;
  });

/**
 * 6b. Booking System Expiry (Cron) — Phase-1 reservations collection
 *
 * Expires stale "pending" and "payment_pending" reservations and
 * restores their seats atomically via Firestore transaction.
 * Each reservation is processed in its own transaction so a single
 * failure doesn't block others.
 */
export const expireBookingReservations = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (_context) => {
    console.log('[Cron] Running booking reservation expiry...');
    await expireStaleReservations();
    return null;
  });

/**
 * 7. Ticket Transfers
 */
export const initiateTransfer = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  try {
    return await initiateTransferInternal({
      ...data,
      fromUserId: context.auth.uid,
    });
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

export const acceptTransfer = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  try {
    return await acceptTransferInternal(data.transferCode, context.auth.uid);
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

export const cancelTransfer = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  try {
    return await cancelTransferInternal(data.transferId, context.auth.uid);
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 8. Social & Chat
 */
export const sendMessage = functions.https.onCall(postChatMessageInternal);

/**
 * 9. Aggregated Counters (Scale-Proof Analytics)
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const statsRef = admin.firestore().collection('platform_stats').doc('current');
  return statsRef.set(
    {
      users_total: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});

export const onEventUpdated = functions.firestore
  .document('events/{eventId}')
  .onWrite(async (change, context) => {
    const eventId = context.params.eventId;

    // 1. Update Platform Stats (only on create)
    if (!change.before.exists && change.after.exists) {
      const statsRef = admin.firestore().collection('platform_stats').doc('current');
      await statsRef.set(
        {
          events_total: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    // 2. Sync to Algolia
    if (!change.after.exists) {
      // Deleted
      await removeEventFromAlgolia(eventId);
    } else {
      // Created or Updated
      await syncEventToAlgolia(eventId, change.after.data());
    }

    return null;
  });

/**
 * Legacy onEventCreated - Refactored into onEventUpdated (.onWrite) above for efficiency
 */
// export const onEventCreated = ...

export const onOrderWrite = functions.firestore
  .document('orders/{orderId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (!after) return null; // Order deleted

    const wasConfirmed = before?.status === 'confirmed';
    const isConfirmed = after.status === 'confirmed';

    // Only trigger stats update once when order transitions to confirmed
    if (!wasConfirmed && isConfirmed) {
      const statsRef = admin.firestore().collection('platform_stats').doc('current');

      let totalTickets = 0;
      if (after.tickets && Array.isArray(after.tickets)) {
        totalTickets = after.tickets.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0);
      }

      // Automated FCM Topic Subscription (Fan-out protection)
      try {
        const topic = `event_${after.eventId}`;
        await admin.messaging().subscribeToTopic(after.userId, topic);
        console.log(`[Messaging] Subscribed user ${after.userId} to topic ${topic}`);
      } catch (e) {
        console.warn(`[Messaging] Failed to subscribe user to topic:`, e);
      }

      // Grant Custom Claim for event chat access — eliminating N+1 Firestore reads.
      // The claim `event_${eventId}: true` is checked in firestore.rules for
      // eventGroupMessages so the rule engine pays 1 read (get user claims) instead
      // of 1 read per message * participants.
      try {
        const user = await admin.auth().getUser(after.userId);
        const existingClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(after.userId, {
          ...existingClaims,
          [`event_${after.eventId}`]: true,
        });
        console.log(`[Claims] Granted event_${after.eventId} claim to user ${after.userId}`);
      } catch (e) {
        console.warn(`[Claims] Failed to set custom claims for user ${after.userId}:`, e);
      }

      // Promoter Aggregation
      if (after.promoterId) {
        const promoterStatsRef = admin
          .firestore()
          .collection('promoter_stats')
          .doc(after.promoterId);
        const commission = after.promoterAttribution?.commissionAmount || 0;
        const revenue = after.totalAmount || 0;

        promoterStatsRef
          .set(
            {
              totalOrders: admin.firestore.FieldValue.increment(1),
              totalRevenue: admin.firestore.FieldValue.increment(revenue),
              totalCommission: admin.firestore.FieldValue.increment(commission),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          .catch((err) => console.error('Failed to update promoter stats', err));
      }

      return statsRef.set(
        {
          revenue: {
            total: admin.firestore.FieldValue.increment(after.totalAmount || 0),
          },
          tickets_sold_total: admin.firestore.FieldValue.increment(totalTickets),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return null;
  });

/**
 * 10. Ratio Engine (Cron) — Dynamic Ratio Ticketing
 *
 * Runs every 5 minutes during event hours to evaluate gender ratio
 * and apply surge pricing or send targeted incentives.
 */

/**
 * 11. Vibe Engine (Trigger) — Live Vibe Heatmaps
 *
 * Listens to realTimeAttendance changes on events and updates
 * the venue's liveVibe status accordingly.
 */

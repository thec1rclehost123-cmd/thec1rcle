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
// Algolia is decommissioned/disabled to prevent quota exhaustion (search is served by Meilisearch)
// import { syncEventToAlgolia, removeEventFromAlgolia } from './lib/algolia';
import { postChatMessageInternal } from './lib/chat';

// Initialize Admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

// Validate required secrets at cold start — never silently fall back to empty
if (!process.env.RAZORPAY_KEY_SECRET) {
  console.error('RAZORPAY_KEY_SECRET is not configured — payment verification will fail');
}
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  console.error('RAZORPAY_WEBHOOK_SECRET is not configured — webhook verification will fail');
}

/**
 * 1. Reserve Tickets (DEPRECATED - Use API Gateway /api/v1/checkout/reserve)
 */
export const reserveTickets = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'unimplemented',
    'Deprecated: Use API Gateway /api/v1/checkout/reserve instead',
  );
});

/**
 * 2. Calculate Pricing (DEPRECATED - Use API Gateway /api/v1/checkout/calculate)
 */
export const calculatePricing = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'unimplemented',
    'Deprecated: Use API Gateway /api/v1/checkout/calculate instead',
  );
});

/**
 * 3. Initiate Checkout (DEPRECATED - Use API Gateway /api/v1/checkout/initiate)
 */
export const initiateCheckout = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'unimplemented',
    'Deprecated: Use API Gateway /api/v1/checkout/initiate instead',
  );
});

/**
 * 4. Verify Payment (DEPRECATED - Use API Gateway /api/v1/checkout/verify)
 */
export const verifyPayment = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'unimplemented',
    'Deprecated: Use API Gateway /api/v1/checkout/verify instead',
  );
});

/**
 * 5. Razorpay Webhook (DEPRECATED - Use API Gateway /api/v1/payments/webhook)
 */
export const razorpayWebhook = functions.https.onRequest(async (req, res) => {
  res.status(410).send('Deprecated: Use API Gateway /api/v1/payments/webhook instead');
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

    // 2. Sync to Algolia (Decommissioned/Disabled to prevent quota exhaustion)
    /*
    if (!change.after.exists) {
      // Deleted
      await removeEventFromAlgolia(eventId);
    } else {
      // Created or Updated
      await syncEventToAlgolia(eventId, change.after.data());
    }
    */

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

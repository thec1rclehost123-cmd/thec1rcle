/**
 * Event Cancellation Workflow — Inngest
 *
 * Handles the full lifecycle when an event is cancelled:
 *   1. Fetch all confirmed orders for the event
 *   2. Process refunds via Razorpay (per-order)
 *   3. Revoke entitlements (QR codes become invalid)
 *   4. Update ticket/order statuses
 *   5. Deactivate promoter links
 *   6. Notify all affected ticket holders
 *   7. Update event analytics
 *
 * Each step is independently retriable via Inngest.
 */

import { inngest, Events } from '../inngest-client.js';

// ========================================
// WORKFLOW: Handle Event Cancellation
// ========================================

export const handleEventCancellation = inngest.createFunction(
  {
    id: 'handle-event-cancellation',
    name: 'Handle Event Cancellation & Refunds',
    retries: 5,
    concurrency: [{ limit: 3 }], // max 3 concurrent cancellations
  },
  { event: Events.EVENT_CANCELLED },
  async ({ event, step }) => {
    const {
      eventId,
      eventTitle,
      cancellationReason,
      cancelledBy,
      refundPolicy, // "full" | "partial" | "none"
      partialRefundPercent,
    } = event.data;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚫 EVENT CANCELLATION WORKFLOW`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`📋 Event: ${eventTitle} (${eventId})`);
    console.log(`❌ Reason: ${cancellationReason}`);
    console.log(`💰 Refund Policy: ${refundPolicy}`);
    console.log(`${'═'.repeat(60)}\n`);

    // ── Step 1: Fetch all confirmed orders ──
    const orders = await step.run('fetch-confirmed-orders', async () => {
      const { getAdminDb, isFirebaseConfigured } = await import('../admin.js');

      if (!isFirebaseConfigured()) {
        console.log('[Cancellation] Firebase not configured, skipping order fetch');
        return [];
      }

      const db = getAdminDb();
      const snapshot = await db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('status', 'in', ['confirmed', 'payment_pending', 'pending_payment'])
        .get();

      const rsvpSnapshot = await db
        .collection('rsvp_orders')
        .where('eventId', '==', eventId)
        .where('status', 'in', ['confirmed', 'pending'])
        .get();

      const paidOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        collection: 'orders',
      }));

      const rsvpOrders = rsvpSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        collection: 'rsvp_orders',
      }));

      console.log(`📦 Found ${paidOrders.length} paid orders, ${rsvpOrders.length} RSVP orders`);
      return [...paidOrders, ...rsvpOrders];
    });

    if (orders.length === 0) {
      console.log('✅ No orders to process. Cancellation complete.');
      return { success: true, ordersProcessed: 0, refundsIssued: 0 };
    }

    // ── Step 2: Process refunds for paid orders ──
    const refundResults = await step.run('process-refunds', async () => {
      if (refundPolicy === 'none') {
        console.log('💰 Refund policy: NONE — skipping refunds');
        return { processed: 0, failed: 0, totalRefunded: 0, details: [] };
      }

      const paidOrders = orders.filter(
        (o) =>
          o.collection === 'orders' &&
          o.status === 'confirmed' &&
          o.totalAmount > 0 &&
          o.payment?.razorpayPaymentId,
      );

      if (paidOrders.length === 0) {
        console.log('💰 No paid orders to refund');
        return { processed: 0, failed: 0, totalRefunded: 0, details: [] };
      }

      let processed = 0;
      let failed = 0;
      let totalRefunded = 0;
      const details = [];

      for (const order of paidOrders) {
        try {
          const paymentId = order.payment.razorpayPaymentId;
          let refundAmount = order.totalAmount;

          if (refundPolicy === 'partial' && partialRefundPercent) {
            refundAmount = Math.round(order.totalAmount * (partialRefundPercent / 100));
          }

          // Convert to paise for Razorpay
          const refundAmountPaise = refundAmount * 100;

          // Call Razorpay refund API
          const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
          const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

          if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            console.log(
              `[Refund] Razorpay not configured, marking order ${order.id} for manual refund`,
            );
            details.push({
              orderId: order.id,
              status: 'manual_required',
              amount: refundAmount,
              reason: 'Razorpay not configured',
            });
            failed++;
            continue;
          }

          const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

          const refundResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${auth}`,
              },
              body: JSON.stringify({
                amount: refundAmountPaise,
                speed: 'normal',
                notes: {
                  reason: 'event_cancelled',
                  eventId,
                  orderId: order.id,
                  cancellationReason,
                },
              }),
            },
          );

          if (refundResponse.ok) {
            const refundData = await refundResponse.json();
            console.log(
              `✅ Refund processed for order ${order.id}: ₹${refundAmount} (${refundData.id})`,
            );
            details.push({
              orderId: order.id,
              status: 'refunded',
              amount: refundAmount,
              razorpayRefundId: refundData.id,
            });
            totalRefunded += refundAmount;
            processed++;
          } else {
            const err = await refundResponse.text();
            console.error(`❌ Refund failed for order ${order.id}:`, err);
            details.push({
              orderId: order.id,
              status: 'failed',
              amount: refundAmount,
              error: err,
            });
            failed++;
          }
        } catch (error) {
          console.error(`❌ Refund exception for order ${order.id}:`, error);
          details.push({
            orderId: order.id,
            status: 'error',
            amount: order.totalAmount,
            error: error.message,
          });
          failed++;
        }
      }

      return { processed, failed, totalRefunded, details };
    });

    // ── Step 3: Update all order statuses & revoke entitlements ──
    const statusUpdateResult = await step.run('update-order-statuses', async () => {
      const { getAdminDb, isFirebaseConfigured } = await import('../admin.js');

      if (!isFirebaseConfigured()) return { updated: 0 };

      const db = getAdminDb();
      const now = new Date().toISOString();
      let updated = 0;

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = db.batch();
        const chunk = orders.slice(i, i + batchSize);

        for (const order of chunk) {
          const collection = order.collection || 'orders';
          const orderRef = db.collection(collection).doc(order.id);

          const refundDetail = refundResults.details?.find((d) => d.orderId === order.id);

          batch.update(orderRef, {
            status: 'cancelled',
            cancellationReason: 'event_cancelled',
            refundStatus: refundDetail?.status || 'not_applicable',
            refundAmount: refundDetail?.amount || 0,
            razorpayRefundId: refundDetail?.razorpayRefundId || null,
            cancelledAt: now,
            updatedAt: now,
          });

          updated++;
        }

        await batch.commit();
      }

      // Revoke all entitlements for this event
      const entitlementSnapshot = await db
        .collection('entitlements')
        .where('eventId', '==', eventId)
        .where('state', '!=', 'REVOKED')
        .get();

      if (!entitlementSnapshot.empty) {
        const entitlementBatch = db.batch();
        entitlementSnapshot.docs.forEach((doc) => {
          entitlementBatch.update(doc.ref, {
            state: 'REVOKED',
            revokedAt: now,
            revokedReason: 'EVENT_CANCELLED',
            revokedBy: cancelledBy || 'SYSTEM',
          });
        });
        await entitlementBatch.commit();
        console.log(`🔒 Revoked ${entitlementSnapshot.size} entitlements`);
      }

      console.log(`📋 Updated ${updated} orders to cancelled status`);
      return { updated, entitlementsRevoked: entitlementSnapshot.size };
    });

    // ── Step 4: Deactivate promoter links ──
    await step.run('deactivate-promoter-links', async () => {
      const { getAdminDb, isFirebaseConfigured } = await import('../admin.js');

      if (!isFirebaseConfigured()) return;

      const db = getAdminDb();
      const now = new Date().toISOString();

      const linksSnapshot = await db
        .collection('promoter_links')
        .where('eventId', '==', eventId)
        .get();

      if (linksSnapshot.empty) {
        console.log('🔗 No promoter links to deactivate');
        return;
      }

      const batch = db.batch();
      linksSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isActive: false,
          deactivatedAt: now,
          deactivationReason: 'event_cancelled',
          updatedAt: now,
        });
      });

      await batch.commit();
      console.log(`🔗 Deactivated ${linksSnapshot.size} promoter links`);
    });

    // ── Step 5: Notify all affected users ──
    await step.run('notify-ticket-holders', async () => {
      const { getAdminDb, isFirebaseConfigured } = await import('../admin.js');

      if (!isFirebaseConfigured()) return;

      const db = getAdminDb();
      const now = new Date().toISOString();

      // Get unique user IDs from orders
      const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))];

      if (userIds.length === 0) {
        console.log('📧 No users to notify');
        return;
      }

      // Create notifications in batches
      const batchSize = 500;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = db.batch();
        const chunk = userIds.slice(i, i + batchSize);

        for (const userId of chunk) {
          const notifRef = db.collection('notifications').doc();
          const userOrder = orders.find((o) => o.userId === userId);
          const hasRefund = refundResults.details?.some(
            (d) => d.orderId === userOrder?.id && d.status === 'refunded',
          );

          const refundMsg =
            refundPolicy === 'full'
              ? 'A full refund has been initiated and will be processed within 5-7 business days.'
              : refundPolicy === 'partial'
                ? `A ${partialRefundPercent}% refund has been initiated and will be processed within 5-7 business days.`
                : 'Please contact support for refund information.';

          batch.set(notifRef, {
            id: notifRef.id,
            userId,
            type: 'event_cancelled',
            title: 'Event Cancelled',
            body: `"${eventTitle}" has been cancelled. ${hasRefund ? refundMsg : ''}`,
            data: {
              eventId,
              eventTitle,
              cancellationReason,
              refundPolicy,
              orderId: userOrder?.id,
            },
            read: false,
            createdAt: now,
          });
        }

        await batch.commit();
      }

      console.log(`📧 Notified ${userIds.length} ticket holders`);
    });

    // ── Step 6: Record in ledger ──
    await step.run('record-ledger-entries', async () => {
      if (refundResults.totalRefunded === 0) return;

      try {
        const { initiateRefund, finalizeRefund, MONEY_STATES } =
          await import('../ledger-engine.js');

        for (const detail of refundResults.details) {
          if (detail.status === 'refunded') {
            await initiateRefund(
              detail.orderId,
              detail.amount,
              'Event Cancelled',
              MONEY_STATES.HELD,
            );
            await finalizeRefund(detail.orderId, detail.amount, detail.razorpayRefundId);
          }
        }

        console.log(`📒 Recorded ${refundResults.processed} refund entries in ledger`);
      } catch (error) {
        console.error('❌ Ledger recording failed:', error);
        // Non-critical — don't block the workflow
      }
    });

    // ── Step 7: Update event with cancellation summary ──
    await step.run('update-event-summary', async () => {
      const { getAdminDb, isFirebaseConfigured } = await import('../admin.js');

      if (!isFirebaseConfigured()) return;

      const db = getAdminDb();
      const now = new Date().toISOString();

      await db
        .collection('events')
        .doc(eventId)
        .update({
          cancellationSummary: {
            totalOrders: orders.length,
            totalRefunded: refundResults.totalRefunded,
            refundsProcessed: refundResults.processed,
            refundsFailed: refundResults.failed,
            entitlementsRevoked: statusUpdateResult.entitlementsRevoked || 0,
            notifiedUsers: [...new Set(orders.map((o) => o.userId).filter(Boolean))].length,
            completedAt: now,
          },
          refundStatus: refundResults.failed > 0 ? 'partially_completed' : 'completed',
          updatedAt: now,
        });

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ CANCELLATION WORKFLOW COMPLETE`);
      console.log(`${'═'.repeat(60)}`);
      console.log(`📦 Orders processed: ${orders.length}`);
      console.log(`💰 Refunds issued: ${refundResults.processed}`);
      console.log(`❌ Refunds failed: ${refundResults.failed}`);
      console.log(`💵 Total refunded: ₹${refundResults.totalRefunded}`);
      console.log(`${'═'.repeat(60)}\n`);
    });

    return {
      success: true,
      eventId,
      ordersProcessed: orders.length,
      refundsIssued: refundResults.processed,
      refundsFailed: refundResults.failed,
      totalRefunded: refundResults.totalRefunded,
    };
  },
);

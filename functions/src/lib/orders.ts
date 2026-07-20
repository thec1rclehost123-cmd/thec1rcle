import { db } from './firebase';
import * as admin from 'firebase-admin';
import { getEvent } from './events';
import { generateOrderQRCodes } from './qrStore';
import { getTierInventoryStats } from './reservations';

const ORDERS_COLLECTION = 'orders';
const RSVP_COLLECTION = 'rsvp_orders';

// @ts-ignore
import { executeOrderCreation as coreExecuteOrderCreation } from '@c1rcle/core/order-engine';
// @ts-ignore
import inventoryEngine from '@c1rcle/core/inventory-engine';

export async function createOrder(payload: any) {
  const { eventId, reservationId = null } = payload;

  const event = await getEvent(eventId);
  if (!event) throw new Error('Event not found');

  // Atomic transaction
  return await db.runTransaction(async (transaction: any) => {
    const orderId = reservationId ? `ORD-${reservationId}` : `ORD-${Date.now()}`;
    // Inject dependencies for core engine
    const orderData: any = {
      ...payload,
      id: orderId,
      status: payload.totalAmount === 0 ? 'confirmed' : 'pending_payment',
      ledger: payload.ledger || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Execute unified order creation and inventory commitment
    const finalOrder = await coreExecuteOrderCreation(transaction, {
      db,
      event,
      orderData,
      reservationId,
      inventoryEngine,
    });

    // 2. Generate QR codes if confirmed
    if (finalOrder.status === 'confirmed') {
      finalOrder.qrCodes = generateOrderQRCodes(finalOrder, event);
      finalOrder.confirmedAt = new Date().toISOString();

      // Record promo redemption if applicable
      if (finalOrder.promoCodeId) {
        const { recordRedemption } = await import('./promos');
        await recordRedemption(finalOrder.promoCodeId, orderId, finalOrder.userId, {
          discountAmount: finalOrder.discountAmount || 0,
        });
      }

      // --- PUBLIC DISCOVERY SYNC ---
      const attendeeRef = db
        .collection('public_attendees')
        .doc(`${finalOrder.userId}_${finalOrder.eventId}`);
      const userDoc = await transaction.get(db.collection('users').doc(finalOrder.userId));
      const userData = userDoc.exists ? userDoc.data() : {};

      transaction.set(attendeeRef, {
        userId: finalOrder.userId,
        userName: userData?.displayName || finalOrder.userName || 'C1RCLE Member',
        userAvatar: userData?.photoURL || null,
        eventId: finalOrder.eventId,
        orderId: orderId,
        joinedAt: new Date().toISOString(),
        type: finalOrder.isRSVP ? 'rsvp' : 'purchase',
      });
    }

    return finalOrder;
  });
}

/**
 * Confirms an order via webhook (Idempotent)
 * Includes a "Safety Valve" to handle payments arriving for expired/stale orders.
 */
export async function confirmOrderPayment(
  orderId: string,
  paymentData: { paymentId: string; signature: string; mode?: string },
) {
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  return await db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists) throw new Error('Order not found');

    const order = orderDoc.data()!;

    // 1. IDEMPOTENCY: If already confirmed, don't re-issue
    if (order.status === 'confirmed') {
      console.log(`[Orders] Order ${orderId} already confirmed, skipping.`);
      return order;
    }

    // 2. SAFETY VALVE: Handle Payment for Expired/Timed-out Orders
    const eventRef = db.collection('events').doc(order.eventId);
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists) throw new Error('Event not found for confirmation');

    const event = eventDoc.data()!;

    if (order.status === 'expired') {
      console.log(
        `[Orders] Webhook received for EXPIRED order ${orderId}. Re-verifying sharded inventory...`,
      );

      const orderTickets = order.tickets || [];
      let canRestore = true;

      for (const ot of orderTickets) {
        const stats = await getTierInventoryStats(order.eventId, ot.ticketId);
        const tier = (event.tickets || []).find((t: any) => t.id === ot.ticketId);
        const totalCapacity = Number(tier?.quantity || 0);
        const available = totalCapacity - stats.sold;

        if (ot.quantity > available) {
          canRestore = false;
          break;
        }
      }

      if (!canRestore) {
        console.error(
          `[Orders] INVENTORY EXHAUSTED for expired order ${orderId}. Marking for manual refund.`,
        );
        const refundOrder = {
          ...order,
          status: 'payment_received_stale',
          paymentId: paymentData.paymentId,
          paymentMode: paymentData.mode || 'unknown',
          failureReason:
            'Inventory no longer available after payment timeout. Manual refund required.',
          updatedAt: new Date().toISOString(),
        };
        transaction.update(orderRef, refundOrder);
        return refundOrder;
      }

      const shardId = order.shardId || Math.floor(Math.random() * 10).toString();
      for (const ot of orderTickets) {
        const shardRef = eventRef.collection('ticket_shards').doc(`${ot.ticketId}_${shardId}`);
        transaction.set(
          shardRef,
          {
            soldQuantity: admin.firestore.FieldValue.increment(ot.quantity),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      transaction.update(eventRef, {
        updatedAt: new Date().toISOString(),
      });

      console.log(`[Orders] Sharded inventory successfully re-secured for stale order ${orderId}`);
    }

    // 3. PROCEED TO CONFIRMATION
    const updatedOrder: any = {
      ...order,
      status: 'confirmed',
      paymentId: paymentData.paymentId,
      paymentSignature: paymentData.signature,
      paymentMode: paymentData.mode || 'unknown',
      confirmedAt: new Date().toISOString(),
      confirmationSource: 'razorpay_webhook',
      updatedAt: new Date().toISOString(),
    };

    updatedOrder.qrCodes = generateOrderQRCodes(updatedOrder, event);

    transaction.update(orderRef, updatedOrder);

    // --- PUBLIC DISCOVERY SYNC ---
    const attendeeRef = db
      .collection('public_attendees')
      .doc(`${updatedOrder.userId}_${updatedOrder.eventId}`);

    const userDoc = await transaction.get(db.collection('users').doc(updatedOrder.userId));
    const userData = userDoc.exists ? userDoc.data() : {};

    transaction.set(attendeeRef, {
      userId: updatedOrder.userId,
      userName: userData?.displayName || updatedOrder.userName || 'C1RCLE Member',
      userAvatar: userData?.photoURL || null,
      eventId: updatedOrder.eventId,
      orderId: orderId,
      joinedAt: new Date().toISOString(),
      type: 'purchase',
    });

    return updatedOrder;
  });
}

export async function createRSVPOrder(payload: any) {
  // Simplified RSVP creation without transaction transaction for reducing inventory (usually irrelevant for RSVP unless capped)
  // But adhering to structure
  const event = await getEvent(payload.eventId);
  const orderId = payload.reservationId ? `RSVP-${payload.reservationId}` : `RSVP-${Date.now()}`;
  const orderData: any = {
    ...payload,
    id: orderId,
    status: 'confirmed',
    isRSVP: true,
    createdAt: new Date().toISOString(),
  };

  // Generate QR codes
  if (event) {
    orderData.qrCodes = generateOrderQRCodes(orderData, event);
  }
  let persistedOrder = orderData;

  await db.runTransaction(async (transaction: any) => {
    persistedOrder = await coreExecuteOrderCreation(transaction, {
      db,
      event,
      orderData,
      reservationId: payload.reservationId || null,
      inventoryEngine,
    });
  });

  // --- PUBLIC DISCOVERY SYNC ---
  try {
    const userDoc = await db.collection('users').doc(payload.userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    await db
      .collection('public_attendees')
      .doc(`${payload.userId}_${payload.eventId}`)
      .set({
        userId: payload.userId,
        userName: userData?.displayName || payload.userName || 'C1RCLE Member',
        userAvatar: userData?.photoURL || null,
        eventId: payload.eventId,
        orderId: orderId,
        joinedAt: new Date().toISOString(),
        type: 'rsvp',
      });
  } catch (e) {
    console.error('Public attendee sync failed for RSVP:', e);
  }

  return persistedOrder;
}

/**
 * Get order by reservation ID (Idempotency Helper)
 */
export async function getOrderByReservationId(reservationId: string) {
  if (!reservationId) return null;

  // Check Paid Orders
  const ordersSnapshot = await db
    .collection(ORDERS_COLLECTION)
    .where('reservationId', '==', reservationId)
    .limit(1)
    .get();

  if (!ordersSnapshot.empty) {
    const doc = ordersSnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Check RSVP Orders
  const rsvpsSnapshot = await db
    .collection(RSVP_COLLECTION)
    .where('reservationId', '==', reservationId)
    .limit(1)
    .get();

  if (!rsvpsSnapshot.empty) {
    const doc = rsvpsSnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return null;
}
/**
 * Fails orders that have been stuck in pending_payment for too long (20+ mins)
 * ATOMIC: Restores inventory back to the event pool.
 */
export async function failStaleOrders() {
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const snapshot = await db
    .collection(ORDERS_COLLECTION)
    .where('status', '==', 'pending_payment')
    .where('createdAt', '<', twentyMinsAgo)
    .limit(20)
    .get();

  if (snapshot.empty) {
    console.log(`[Cleanup] No stale pending orders found`);
    return;
  }

  console.log(`[Cleanup] Found ${snapshot.size} stale pending orders to expire and restore`);

  for (const doc of snapshot.docs) {
    const orderId = doc.id;

    try {
      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        const currentOrderDoc = await transaction.get(orderRef);

        if (!currentOrderDoc.exists) return;
        const order = currentOrderDoc.data()!;

        // Safety check: ensure still pending
        if (order.status !== 'pending_payment') return;

        // 1. Mark order as expired
        transaction.update(orderRef, {
          status: 'expired',
          updatedAt: new Date().toISOString(),
          failureReason: 'Payment timeout (20m)',
        });

        // 2. Restore inventory to shards
        const eventRef = db.collection('events').doc(order.eventId);
        const orderTickets = order.tickets || [];
        const shardId = order.shardId || '0';

        for (const ot of orderTickets) {
          const shardRef = eventRef.collection('ticket_shards').doc(`${ot.ticketId}_${shardId}`);
          transaction.set(
            shardRef,
            {
              soldQuantity: admin.firestore.FieldValue.increment(-ot.quantity),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }

        transaction.update(eventRef, {
          updatedAt: new Date().toISOString(),
        });
      });
      console.log(`[Cleanup] Successfully expired order ${orderId} and restored inventory`);
    } catch (e) {
      console.error(`[Cleanup] Failed to expire order ${orderId}:`, e);
    }
  }
}

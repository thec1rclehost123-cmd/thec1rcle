/**
 * THE C1RCLE - Master Order Engine (Phase 1)
 * Centralizes order lifecycle, validation, and status transitions.
 * Location: packages/core/order-engine.js
 */

import { randomBytes } from 'node:crypto';
import { getAdminDb } from './admin.js';

export const PAYMENT_PENDING_ORDER_STATUS = 'payment_pending';

export function isPaymentPendingOrderStatus(status) {
  return status === PAYMENT_PENDING_ORDER_STATUS || status === 'pending_payment';
}

function generateOrderSequence() {
  const part1 = randomBytes(3).toString('hex').toUpperCase();
  const part2 = randomBytes(3).toString('hex').toUpperCase();
  return {
    sequenceRef: null,
    nextValue: null,
    orderIndex: null,
    orderNumber: `ORD-${part1}-${part2}`,
  };
}

/**
 * Validates if an order can be placed based on global and user-specific limits.
 */
export async function validateOrder(event, items, userContext, _options = {}) {
  const { existingTicketCount = 0, hasExistingRSVP = false, userGender = 'any' } = userContext;
  const { isRSVP = false } = event;

  const totalRequested = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const eventTickets = Array.isArray(event?.tickets)
    ? event.tickets
    : Array.isArray(event?.ticketCatalog?.tiers)
      ? event.ticketCatalog.tiers
      : [];

  const normalizeGenderRequirement = (ticket = {}) => {
    const explicitRequirement = String(
      ticket.genderRequirement || ticket.requiredGender || ticket.gender || '',
    ).toLowerCase();

    if (
      explicitRequirement === 'female' ||
      explicitRequirement === 'male' ||
      explicitRequirement === 'couple'
    ) {
      return explicitRequirement;
    }

    const entryType = String(ticket.entryType || '').toLowerCase();
    if (entryType === 'female') return 'female';
    if (entryType === 'stag' || entryType === 'male') return 'male';

    return 'any';
  };

  // 1. RSVP Specific Rules
  if (isRSVP) {
    if (hasExistingRSVP) {
      return { success: false, error: "You have already RSVP'd for this event" };
    }
    if (totalRequested !== 1) {
      return { success: false, error: 'RSVP is limited to 1 ticket per registration' };
    }
  }

  // 1b. Gender Profile Completeness
  const eventHasGenderRestriction = eventTickets.some(
    (t) => normalizeGenderRequirement(t) !== 'any',
  );
  const itemHasGenderRestriction = items.some((i) => normalizeGenderRequirement(i) !== 'any');

  if ((eventHasGenderRestriction || itemHasGenderRestriction) && !userContext.userGender) {
    return {
      success: false,
      error: 'Please complete your profile with your gender to purchase tickets for this event.',
    };
  }

  // 2. Global Order Limits (Paid)
  const minTickets = event.minTicketsPerOrder || 1;
  const maxTickets = event.maxTicketsPerOrder || 10;

  if (totalRequested < minTickets) {
    return { success: false, error: `Minimum ${minTickets} tickets required per order` };
  }

  if (existingTicketCount + totalRequested > maxTickets) {
    const msg =
      existingTicketCount > 0
        ? `You have already purchased ${existingTicketCount} tickets. Maximum ${maxTickets} allowed per account.`
        : `Maximum ${maxTickets} tickets allowed per account.`;
    return { success: false, error: msg };
  }

  // 3. Ticket-level restriction checks
  for (const item of items) {
    const eventTicket = eventTickets.find((ticket) => {
      const candidateIds = [ticket?.id, ticket?.ticketId, ticket?.tierId, ticket?.name].filter(
        Boolean,
      );
      const itemIds = [item?.ticketId, item?.tierId, item?.id, item?.name].filter(Boolean);
      return itemIds.some((value) => candidateIds.includes(value));
    });
    const requiredGender =
      normalizeGenderRequirement(item) !== 'any'
        ? normalizeGenderRequirement(item)
        : normalizeGenderRequirement(eventTicket);

    if (
      requiredGender !== 'any' &&
      requiredGender !== 'couple' &&
      userGender !== 'any' &&
      userGender !== requiredGender
    ) {
      const tierName = eventTicket?.name || item?.name || 'This ticket';
      return {
        success: false,
        error: `${tierName} is restricted to ${requiredGender} attendees only.`,
      };
    }
  }

  return { success: true };
}

/**
 * Generates a consistent Order ID
 */
export function generateOrderId(prefix = 'ORD') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Builds a standardized Order payload
 */
export function buildOrderPayload(params) {
  const { reservation, event, pricing, user, promoterCode, workspaceId } = params;
  const isRSVP = !!event.isRSVP;
  const orderId = generateOrderId(isRSVP ? 'RSVP' : 'ORD');

  const ticketCount = pricing.items.reduce((s, item) => s + item.quantity, 0);

  return {
    id: orderId,
    eventId: event.id,
    eventName: event.title,
    workspaceId: workspaceId || event.workspaceId || null,
    queueId: reservation.queueId || null,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone,
    ticketCount,
    totalPaise: Math.round(pricing.grandTotal * 100),
    tickets: pricing.items.map((item) => ({
      ticketId: item.tierId,
      name: item.tierName,
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.subtotal,
    })),
    subtotal: pricing.subtotal,
    discounts: pricing.discounts,
    discountTotal: pricing.discountTotal,
    fees: pricing.fees,
    totalAmount: pricing.grandTotal,
    status: pricing.isFree || isRSVP ? 'confirmed' : PAYMENT_PENDING_ORDER_STATUS,
    reservationId: reservation.id,
    promoterCode: promoterCode || null,
    createdAt: new Date().toISOString(),
    isRSVP,
  };
}

/**
 * Orchestrates atomic order creation (Firestore Transaction)
 */
export async function executeOrderCreation(
  transaction,
  { db, event, orderData, reservationId = null, inventoryEngine },
) {
  const orderId = orderData.id;
  const orderRef = db.collection(orderData.isRSVP ? 'rsvp_orders' : 'orders').doc(orderId);

  // 1. Transaction-level Idempotency
  const existingOrderDoc = await transaction.get(orderRef);
  if (existingOrderDoc.exists) return existingOrderDoc.data();

  const orderSequence =
    orderData.orderIndex && orderData.orderNumber
      ? {
          orderIndex: orderData.orderIndex,
          orderNumber: orderData.orderNumber,
        }
      : generateOrderSequence();

  // 2. Inventory Adjustment
  if (inventoryEngine && !orderData.isRSVP) {
    // If it was reserved, we "convert" the lock.
    // If not, we deduct directly.
    // This is handled via the inventory engine passed in.
    await inventoryEngine.commitInventory(transaction, {
      event,
      items: orderData.tickets,
      reservationId,
      db,
    });
  }

  // 3. Status logic
  const status =
    orderData.totalAmount === 0 || orderData.isRSVP ? 'confirmed' : PAYMENT_PENDING_ORDER_STATUS;
  if (orderSequence.sequenceRef) {
    transaction.set(
      orderSequence.sequenceRef,
      {
        lastOrderIndex: orderSequence.nextValue,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  const finalOrder = {
    ...orderData,
    ...orderSequence,
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'confirmed') {
    finalOrder.confirmedAt = finalOrder.updatedAt;
  }

  // 4. Persistence
  transaction.set(orderRef, finalOrder);

  // 5. Reservation Conversion
  if (reservationId) {
    const resRef = db.collection('cart_reservations').doc(reservationId);
    transaction.update(resRef, {
      status: 'converted',
      orderId: orderId,
      convertedAt: finalOrder.updatedAt,
    });
  }

  return finalOrder;
}

/**
 * Transitions an order to confirmed status after payment
 */
export function prepareOrderConfirmation(order, paymentData) {
  if (order.status === 'confirmed') return null;

  return {
    ...order,
    status: 'confirmed',
    paymentId: paymentData.paymentId,
    paymentSignature: paymentData.signature || null,
    paymentMode: paymentData.mode || 'unknown',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getOrderById(orderId) {
  if (!orderId) return null;
  const db = getAdminDb();
  const [orderDoc, rsvpDoc] = await Promise.all([
    db.collection('orders').doc(orderId).get(),
    db.collection('rsvp_orders').doc(orderId).get(),
  ]);
  if (orderDoc.exists) {
    const data = orderDoc.data();
    return {
      id: orderDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt,
    };
  }
  if (rsvpDoc.exists) {
    const data = rsvpDoc.data();
    return {
      id: rsvpDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt,
    };
  }
  return null;
}

export async function getUserOrders(userId, limit = 50) {
  if (!userId) return [];
  const db = getAdminDb();
  const max = Math.max(1, Math.min(Number(limit) || 50, 100));

  const [ordersSnapshot, rsvpSnapshot] = await Promise.all([
    db.collection('orders').where('userId', '==', userId).limit(max).get(),
    db.collection('rsvp_orders').where('userId', '==', userId).limit(max).get(),
  ]);

  return [
    ...ordersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), isRSVP: false })),
    ...rsvpSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), isRSVP: true })),
  ]
    .sort((a, b) => {
      const left = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const right = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return right - left;
    })
    .slice(0, max);
}

export async function cancelOrder(orderId) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'cancelled') return order;

  const db = getAdminDb();
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const eventRef = db.collection('events').doc(order.eventId);
    const orderRef = db.collection('orders').doc(orderId);

    const [eventDoc, bundlesSnapshot, assignmentsSnapshot, entitlementsSnapshot] =
      await Promise.all([
        transaction.get(eventRef),
        transaction.get(db.collection('share_bundles').where('orderId', '==', orderId)),
        transaction.get(db.collection('ticket_assignments').where('orderId', '==', orderId)),
        transaction.get(db.collection('entitlements').where('orderId', '==', orderId)),
      ]);

    if (eventDoc.exists) {
      const currentEvent = eventDoc.data();
      const usesTicketCatalog = !!currentEvent.ticketCatalog;
      const sourceTiers = usesTicketCatalog
        ? currentEvent.ticketCatalog?.tiers || []
        : currentEvent.tickets || [];
      const updatedTiers = [...sourceTiers];

      order.tickets.forEach((orderTicket) => {
        const tierIndex = updatedTiers.findIndex((t) => t.id === orderTicket.ticketId);
        if (tierIndex >= 0) {
          const tier = updatedTiers[tierIndex];
          const inv = tier.inventory || {};
          if (inv.soldQuantity !== undefined) {
            updatedTiers[tierIndex] = {
              ...tier,
              inventory: {
                ...inv,
                soldQuantity: Math.max(0, (inv.soldQuantity || 0) - orderTicket.quantity),
              },
            };
          } else {
            updatedTiers[tierIndex] = {
              ...tier,
              remaining: (Number(tier.remaining ?? tier.quantity) || 0) + orderTicket.quantity,
            };
          }
        }
      });

      if (usesTicketCatalog) {
        transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers, updatedAt: now });
      } else {
        transaction.update(eventRef, { tickets: updatedTiers, updatedAt: now });
      }
    }

    transaction.update(orderRef, { status: 'cancelled', updatedAt: now });

    bundlesSnapshot.forEach((bundleDoc) => {
      transaction.update(bundleDoc.ref, { status: 'cancelled', updatedAt: now });
    });

    assignmentsSnapshot.forEach((assignmentDoc) => {
      transaction.update(assignmentDoc.ref, { status: 'voided', updatedAt: now });
    });

    entitlementsSnapshot.forEach((entDoc) => {
      transaction.update(entDoc.ref, {
        state: 'REVOKED',
        revokedAt: now,
        revokedReason: 'ORDER_CANCELLED',
        revokedBy: 'SYSTEM',
      });
    });
  });

  return { ...order, status: 'cancelled', updatedAt: now };
}

export async function cleanupStaleOrders(userId = null, batchSize = 10) {
  const db = getAdminDb();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const effectiveBatchSize = Math.max(1, Math.min(Number(batchSize) || 10, 100));
  let query = db
    .collection('orders')
    .where('status', '==', PAYMENT_PENDING_ORDER_STATUS)
    .where('createdAt', '<', fifteenMinutesAgo)
    .limit(effectiveBatchSize + 1);

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snapshot = await query.get();
  const hasMore = snapshot.docs.length > effectiveBatchSize;
  const docsToProcess = hasMore ? snapshot.docs.slice(0, effectiveBatchSize) : snapshot.docs;
  let cleaned = 0;

  for (const doc of docsToProcess) {
    try {
      await cancelOrder(doc.id);
      cleaned++;
    } catch (err) {
      console.error(`[Order Engine] Failed to cleanup stale order ${doc.id}:`, err);
    }
  }

  if (hasMore) {
    console.warn(
      `[Order Engine] cleanupStaleOrders: more than ${effectiveBatchSize} stale orders found. Run again to continue.`,
    );
  }

  if (cleaned > 0) {
    console.log(`[Order Engine] Cleaned up ${cleaned} stale pending orders`);
  }

  return { cleaned, hasMore: hasMore || false };
}

export default {
  validateOrder,
  generateOrderId,
  executeOrderCreation,
  prepareOrderConfirmation,
  getOrderById,
  cancelOrder,
  cleanupStaleOrders,
};

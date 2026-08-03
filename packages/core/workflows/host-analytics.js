import { inngest, Events } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';
import { FieldValue } from 'firebase-admin/firestore';

export function buildHostTicketPurchaseStats({ order, marker, ledgerRows }) {
  if (!order?.id || order.status !== 'confirmed' || !order.hostId) {
    throw new Error('Confirmed order with host attribution is required');
  }
  if (
    !marker ||
    marker.orderId !== order.id ||
    marker.entryCount !== marker.entryIds?.length ||
    !Array.isArray(ledgerRows) ||
    ledgerRows.length !== marker.entryIds.length ||
    !marker.entryIds.every((id) => ledgerRows.some((row) => row.id === id))
  ) {
    throw new Error('Complete canonical ledger posting is required');
  }
  const revenueEntry = ledgerRows.find(
    (row) => row.type === 'ticket_revenue' && row.orderId === order.id,
  );
  if (!Number.isSafeInteger(revenueEntry?.amountPaise) || revenueEntry.amountPaise < 0) {
    throw new Error('Canonical ticket revenue entry is required');
  }
  const ticketCount = Array.isArray(order.entitlementIds) ? order.entitlementIds.length : 0;
  if (ticketCount <= 0) throw new Error('Confirmed order entitlements are required');
  const phaseBreakdown = {};
  if (Array.isArray(order.tickets)) {
    for (const t of order.tickets) {
      const phase = t.priceLabel || 'Regular';
      const qty = Number(t.quantity) || 1;
      const rev = Number(t.total || t.subtotal || t.price * qty) || 0;
      if (!phaseBreakdown[phase]) phaseBreakdown[phase] = { ticketsSold: 0, revenue: 0 };
      phaseBreakdown[phase].ticketsSold += qty;
      phaseBreakdown[phase].revenue += rev;
    }
  }

  return {
    hostId: order.hostId,
    orderId: order.id,
    ticketCount,
    grossPaise: revenueEntry.amountPaise,
    phaseBreakdown,
  };
}

/**
 * PRODUCTION WORKFLOW: Sync Host Statistics
 *
 * Precomputes and updates the host_stats collection to avoid
 * sequential Firestore reads during dashboard loads.
 */
export const syncHostStats = inngest.createFunction(
  {
    id: 'sync-host-stats',
    name: 'Sync Host Statistics',
    // Throttle to avoid excessive writes during peak order times
    throttle: {
      limit: 10,
      period: '1s',
      key: 'event.data.hostId',
    },
  },
  [
    { event: Events.TICKET_PURCHASED },
    { event: Events.EVENT_PUBLISHED },
    { event: Events.EVENT_CANCELLED },
    { event: Events.EVENT_STARTED },
    { event: Events.EVENT_ENDED },
    { event: Events.HOST_STATS_SYNC },
  ],
  async ({ event, step }) => {
    const db = getAdminDb();
    let hostId = event.data.hostId;
    let purchaseStats = null;

    if (event.name === Events.TICKET_PURCHASED) {
      purchaseStats = await step.run('load-ledger-backed-purchase-stats', async () => {
        const orderId = event.data.orderId;
        const [orderDoc, markerDoc] = await Promise.all([
          db.collection('orders').doc(orderId).get(),
          db.collection('partner_ledger_idempotency').doc(orderId).get(),
        ]);
        if (!orderDoc.exists || !markerDoc.exists) {
          throw new Error('Atomic order and ledger marker are required');
        }
        const marker = markerDoc.data();
        const ledgerDocs = await Promise.all(
          marker.entryIds.map((id) => db.collection('partner_ledger').doc(id).get()),
        );
        return buildHostTicketPurchaseStats({
          order: { id: orderDoc.id, ...orderDoc.data() },
          marker,
          ledgerRows: ledgerDocs
            .filter((doc) => doc.exists)
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })),
        });
      });
      hostId = purchaseStats.hostId;
    }

    if (!hostId) return { skipped: true, reason: 'No hostId identified' };

    await step.run('update-host-stats', async () => {
      const statsRef = db.collection('host_stats').doc(hostId);

      // For ticket purchases, we can use atomic increments
      if (event.name === Events.TICKET_PURCHASED) {
        const updates = {
          totalTicketsSold: FieldValue.increment(purchaseStats.ticketCount),
          totalRevenuePaise: FieldValue.increment(purchaseStats.grossPaise),
          totalRevenue: FieldValue.increment(purchaseStats.grossPaise / 100),
          lastUpdatedAt: new Date().toISOString(),
        };
        for (const [phase, data] of Object.entries(purchaseStats.phaseBreakdown || {})) {
          updates[`salesByPhase.${phase}.ticketsSold`] = FieldValue.increment(data.ticketsSold);
          updates[`salesByPhase.${phase}.revenue`] = FieldValue.increment(data.revenue);
        }
        await statsRef.set(updates, { merge: true });
      } else {
        // For event lifecycle changes, it's safer to re-calculate counts
        const eventsSnapshot = await db
          .collection('events')
          .where('creatorId', '==', hostId)
          .where('isDeleted', '==', false)
          .get();

        const now = new Date().toISOString();
        let activeCount = 0;
        let upcomingCount = 0;

        eventsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (['scheduled', 'live'].includes(data.lifecycle)) {
            activeCount++;
          }
          if (data.lifecycle === 'scheduled' && data.startDate > now) {
            upcomingCount++;
          }
        });

        await statsRef.set(
          {
            activeEventsCount: activeCount,
            upcomingEventsCount: upcomingCount,
            lastUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      return { hostId, updated: true };
    });
  },
);

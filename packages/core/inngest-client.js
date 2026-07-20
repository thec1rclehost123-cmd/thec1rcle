import { Inngest } from 'inngest';
import { telemetry } from './telemetry.js';

/**
 * Inngest Client for C1RCLE
 * Production-ready configuration with environment-based setup
 */
export const inngest = new Inngest({
  id: 'c1rcle-app',
  name: 'C1RCLE Platform',
  // In production, INNGEST_EVENT_KEY is automatically read from env
  // In development, events are sent to the local dev server
});

/**
 * Event Catalog
 * All event names used across the platform for type safety and consistency
 */
export const Events = {
  // Ticketing Events
  TICKET_PURCHASED: 'ticket/purchased',
  TICKET_ISSUED: 'ticket/issued',
  TICKET_REFUNDED: 'ticket/refunded',
  TICKET_TRANSFERRED: 'ticket/transferred',

  // Event Lifecycle
  EVENT_PUBLISHED: 'event/published',
  EVENT_CANCELLED: 'event/cancelled',
  EVENT_STARTED: 'event/started',
  EVENT_ENDED: 'event/ended',

  // Inventory Management
  SURGE_DETECTED: 'surge/detected',
  INVENTORY_LOW: 'inventory/low',
  INVENTORY_SOLD_OUT: 'inventory/sold-out',

  // Payouts & Finance
  PAYOUT_REQUESTED: 'payout/requested',
  PAYOUT_PROCESSED: 'payout/processed',
  SETTLEMENT_DUE: 'settlement/due',

  // Notifications
  REMINDER_SCHEDULED: 'reminder/scheduled',
  NOTIFICATION_SEND: 'notification/send',

  // Partner Events
  PARTNER_ONBOARDED: 'partner/onboarded',
  VENUE_APPROVED: 'venue/approved',

  // Search & Discovery
  SEARCH_SYNC_EVENT: 'search/sync-event',
  SEARCH_SYNC_VENUE: 'search/sync-venue',
  PUBLIC_DISCOVERY_SYNC: 'discovery/sync-read-models',

  // Analytics & Maintenance
  HOST_STATS_SYNC: 'analytics/host-stats-sync',
  VENUE_CLICK: 'venue/click',
  HOST_CLICK: 'host/click',
  MAINTENANCE_PING: 'maintenance/ping',
};

/**
 * Helper to send events with structured data
 * @param {string} eventName - Event name from Events catalog
 * @param {object} data - Event payload
 * @param {object} options - Optional: user, idempotency key, etc.
 */
export async function sendEvent(eventName, data, options = {}) {
  const { idempotencyKey, user } = options;

  const event = {
    name: eventName,
    data,
    ...(user && { user }),
    ...(idempotencyKey && { id: idempotencyKey }),
  };

  try {
    // Inngest SDK has built-in timeout/retry. If the dev server is unreachable,
    // the SDK will reject naturally — no need for a separate race timeout that
    // could fire prematurely and cause duplicate ticket issuance.
    const result = await inngest.send(event);
    return { success: true, ids: result.ids };
  } catch (error) {
    telemetry.error(`[Inngest] Failed to send event ${eventName}`, error, { eventName, data });

    // Development Fallback: Execute ticket fulfillment manually if Inngest is missing
    if (eventName === Events.TICKET_PURCHASED && process.env.NODE_ENV !== 'production') {
      telemetry.track('INNGEST_FALLBACK_TRIGGERED', { orderId: data.orderId });
      try {
        const { issueEntitlements, generateEntitlementQR } =
          await import('./entitlement-engine.js');
        const { getAdminDb } = await import('./admin.js');

        const db = getAdminDb();
        const order = {
          id: data.orderId,
          userId: data.userId,
          eventId: data.eventId,
          isRSVP: false,
        };
        const items = (data.tickets || []).map((t) => ({
          ticketId: t.tierId || t.ticketId,
          name: t.tierName || t.name,
          quantity: t.quantity,
          entryType: t.entryType || 'general',
          genderRequirement: t.genderRequirement,
        }));

        const issuedEntitlements = await issueEntitlements(order, items);
        const entitlementIds = issuedEntitlements.map((e) => e.id);

        await db.collection('orders').doc(data.orderId).update({
          entitlementIds,
          fulfilledAt: new Date().toISOString(),
          fulfillmentStatus: 'completed_fallback',
        });

        // Update stats and analytics as part of the dev fallback
        const { FieldValue } = await import('firebase-admin/firestore');
        const count = issuedEntitlements.length;
        const totalAmount = data.totalAmount || 0;

        // 1. Update event document stats
        await db
          .collection('events')
          .doc(data.eventId)
          .update({
            'stats.ticketsSold': FieldValue.increment(count),
            'stats.totalRevenue': FieldValue.increment(totalAmount),
          })
          .catch((err) => telemetry.error(`[Fallback] Failed to update event stats`, err));

        // 2. Update real-time analytics
        const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        await db
          .collection('event_analytics')
          .doc(`${data.eventId}_${dateKey}`)
          .set(
            {
              eventId: data.eventId,
              date: dateKey,
              ticketsSold: FieldValue.increment(count),
              revenue: FieldValue.increment(totalAmount),
              ordersCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          .catch((err) => telemetry.error(`[Fallback] Failed to update event_analytics`, err));

        // 3. Update host statistics if hostId is found
        const eventDoc = await db.collection('events').doc(data.eventId).get();
        if (eventDoc.exists) {
          const eventData = eventDoc.data();
          const hostId = eventData.creatorId || eventData.hostId;
          if (hostId) {
            await db
              .collection('host_stats')
              .doc(hostId)
              .set(
                {
                  totalTicketsSold: FieldValue.increment(count),
                  totalRevenue: FieldValue.increment(totalAmount),
                  lastUpdatedAt: new Date().toISOString(),
                },
                { merge: true },
              )
              .catch((err) => telemetry.error(`[Fallback] Failed to update host stats`, err));
          }
        }

        telemetry.track('INNGEST_FALLBACK_SUCCESS', {
          orderId: data.orderId,
          count: entitlementIds.length,
        });
      } catch (fallbackError) {
        telemetry.error(`[Fallback] Failed to issue tickets for ${data.orderId}`, fallbackError, {
          orderId: data.orderId,
        });
      }
    }

    // Development Fallback: Execute venue click manually if Inngest is missing
    if (eventName === Events.VENUE_CLICK && process.env.NODE_ENV !== 'production') {
      try {
        const { getAdminDb } = await import('./admin.js');
        const { computeVenueHeatScore } = await import('./guest-discovery-engine.js');

        const db = getAdminDb();
        const { venueId, timestamp } = data;

        // Run the logic directly
        const eventsSnap = await db.collection('events').where('venueId', '==', venueId).get();
        let ticketSalesCount = 0;
        eventsSnap.forEach((doc) => {
          const eventData = doc.data() || {};
          ticketSalesCount += eventData.ticketsStats?.totalSold ?? 0;
        });

        const venueSummaryRef = db.collection('venue_summary').doc(venueId);
        await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(venueSummaryRef);
          if (!doc.exists) return;

          const summaryData = doc.data() || {};
          const newClickCount = Number(summaryData.clickCount || 0) + 1;
          const newRecentClickCount = Number(summaryData.recentClickCount || 0) + 1;
          const followersCount = Number(summaryData.followersCount || 0);

          const newHeatScore = computeVenueHeatScore({
            followersCount,
            clickCount: newClickCount,
            ticketSalesCount,
            recentClickCount: newRecentClickCount,
          });

          transaction.update(venueSummaryRef, {
            clickCount: newClickCount,
            recentClickCount: newRecentClickCount,
            ticketSalesCount,
            lastVisitedAt: timestamp || new Date().toISOString(),
            heatScore: newHeatScore,
            updatedAt: new Date().toISOString(),
          });
        });
        console.log(`[Inngest Fallback] Successfully processed venue click for ${venueId}`);
      } catch (fallbackError) {
        console.error('[Inngest Fallback] Failed to process venue click manually', fallbackError);
      }
    }

    // Development Fallback: Execute host click manually if Inngest is missing
    if (eventName === Events.HOST_CLICK && process.env.NODE_ENV !== 'production') {
      try {
        const { getAdminDb } = await import('./admin.js');
        const { computeHostHeatScore } = await import('./guest-discovery-engine.js');

        const db = getAdminDb();
        const { hostId, timestamp } = data;

        // Run the logic directly
        const eventsSnap = await db.collection('events').where('hostId', '==', hostId).get();
        let ticketSalesCount = 0;
        eventsSnap.forEach((doc) => {
          const eventData = doc.data() || {};
          ticketSalesCount += eventData.ticketsStats?.totalSold ?? 0;
        });

        const hostSummaryRef = db.collection('host_summary').doc(hostId);
        await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(hostSummaryRef);
          if (!doc.exists) return;

          const summaryData = doc.data() || {};
          const newClickCount = Number(summaryData.clickCount || 0) + 1;
          const newRecentClickCount = Number(summaryData.recentClickCount || 0) + 1;
          const followersCount = Number(summaryData.followersCount || 0);

          const newHeatScore = computeHostHeatScore({
            followersCount,
            clickCount: newClickCount,
            ticketSalesCount,
            recentClickCount: newRecentClickCount,
          });

          transaction.update(hostSummaryRef, {
            clickCount: newClickCount,
            recentClickCount: newRecentClickCount,
            ticketSalesCount,
            lastVisitedAt: timestamp || new Date().toISOString(),
            heatScore: newHeatScore,
            updatedAt: new Date().toISOString(),
          });
        });
        console.log(`[Inngest Fallback] Successfully processed host click for ${hostId}`);
      } catch (fallbackError) {
        console.error('[Inngest Fallback] Failed to process host click manually', fallbackError);
      }
    }

    // We log as a warning and return success: false instead of throwing,
    // so background events don't crash critical flows.
    return { success: false, error: error.message };
  }
}

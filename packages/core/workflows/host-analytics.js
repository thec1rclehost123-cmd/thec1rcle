import { inngest, Events } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';

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

    // If ticket purchased, we need to find the hostId from event
    if (event.name === Events.TICKET_PURCHASED) {
      const eventId = event.data.eventId;
      const eventDoc = await step.run('fetch-event-host', async () => {
        const doc = await db.collection('events').doc(eventId).get();
        return doc.exists ? doc.data() : null;
      });
      if (eventDoc) hostId = eventDoc.creatorId;
    }

    if (!hostId) return { skipped: true, reason: 'No hostId identified' };

    await step.run('update-host-stats', async () => {
      const statsRef = db.collection('host_stats').doc(hostId);

      // For ticket purchases, we can use atomic increments
      if (event.name === Events.TICKET_PURCHASED) {
        const { tickets, totalAmount } = event.data;
        const ticketCount = tickets.reduce((acc, t) => acc + t.quantity, 0);

        await statsRef.set(
          {
            totalTicketsSold: db.FieldValue.increment(ticketCount),
            totalRevenue: db.FieldValue.increment(totalAmount),
            lastUpdatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
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

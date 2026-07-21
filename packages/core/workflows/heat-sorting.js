import { inngest, Events } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';
import { computeVenueHeatScore, computeHostHeatScore } from '../guest-discovery-engine.js';

/**
 * PRODUCTION WORKFLOW: Recalculate Event Heat Scores
 *
 * Periodically updates the heatScore for all active events.
 * Triggered by a cron expression (e.g., every 30 minutes).
 */
export const recalculateHeatScores = inngest.createFunction(
  {
    id: 'recalculate-heat-scores',
    name: 'Recalculate Heat Scores',
  },
  { cron: '0 * * * *' }, // Every 1 hour
  async ({ step }) => {
    const db = getAdminDb();

    const events = await step.run('fetch-active-events', async () => {
      const snapshot = await db
        .collection('events')
        .where('lifecycle', 'in', ['scheduled', 'live'])
        .where('isDeleted', '==', false)
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    });

    // Batch update heat scores in chunks of 500 to stay under Firestore's batch limits
    await step.run('update-heat-scores', async () => {
      const now = new Date();
      const batchLimit = 500;

      for (let i = 0; i < events.length; i += batchLimit) {
        const chunk = events.slice(i, i + batchLimit);
        const batch = db.batch();

        for (const event of chunk) {
          // Formula: (Tickets Sold * 10) + (Heat Signal * 5) - (Days to Event penalty)
          // Simplified for Phase 2:
          const ticketsSold = event.ticketsStats?.totalSold ?? 0;
          const views = event.analytics?.views || 0;

          // Base score
          let score = ticketsSold * 10 + views * 0.5;

          // Recency/Urgency: More heat if event is soon (but not past)
          const eventStart = new Date(event.startDate);
          const diffDays = (eventStart - now) / (1000 * 60 * 60 * 24);

          if (diffDays > 0 && diffDays < 7) {
            score += (7 - diffDays) * 20; // Up to 140 points for urgency
          }

          batch.update(db.collection('events').doc(event.id), {
            heatScore: score,
            heatScoreUpdatedAt: now.toISOString(),
          });
        }

        await batch.commit();
      }

      return { updated: events.length };
    });
  },
);

/**
 * PRODUCTION WORKFLOW: Process Venue Click
 *
 * Triggered by venue/click events. Recalculates popular analytics and heatScore.
 */
export const processVenueClick = inngest.createFunction(
  {
    id: 'process-venue-click',
    name: 'Process Venue Click',
  },
  { event: 'venue/click' },
  async ({ event, step }) => {
    const { venueId, visitorId, timestamp } = event.data;
    const db = getAdminDb();

    // 1. Fetch ticket sales count from events collection
    const ticketSalesCount = await step.run('fetch-ticket-sales-count', async () => {
      const eventsSnap = await db.collection('events').where('venueId', '==', venueId).get();
      let totalSales = 0;
      eventsSnap.forEach((doc) => {
        const eventData = doc.data() || {};
        totalSales += eventData.ticketsStats?.totalSold ?? 0;
      });
      return totalSales;
    });

    // 2. Perform atomic transaction to update clicks and recalculate heatScore
    await step.run('update-venue-popularity', async () => {
      const venueSummaryRef = db.collection('venue_summary').doc(venueId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(venueSummaryRef);
        if (!doc.exists) return;

        const data = doc.data() || {};
        const newClickCount = Number(data.clickCount || 0) + 1;
        const newRecentClickCount = Number(data.recentClickCount || 0) + 1;
        const followersCount = Number(data.followersCount || 0);

        // Compute heatScore
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
    });

    return { success: true };
  },
);

/**
 * PRODUCTION WORKFLOW: Process Host Click
 *
 * Triggered by host/click events. Recalculates popular analytics and heatScore.
 */
export const processHostClick = inngest.createFunction(
  {
    id: 'process-host-click',
    name: 'Process Host Click',
  },
  { event: 'host/click' },
  async ({ event, step }) => {
    const { hostId, visitorId, timestamp } = event.data;
    const db = getAdminDb();

    // 1. Fetch ticket sales count from events collection
    const ticketSalesCount = await step.run('fetch-ticket-sales-count', async () => {
      const eventsSnap = await db.collection('events').where('hostId', '==', hostId).get();
      let totalSales = 0;
      eventsSnap.forEach((doc) => {
        const eventData = doc.data() || {};
        totalSales += eventData.ticketsStats?.totalSold ?? 0;
      });
      return totalSales;
    });

    // 2. Perform atomic transaction to update clicks and recalculate heatScore
    await step.run('update-host-popularity', async () => {
      const hostSummaryRef = db.collection('host_summary').doc(hostId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(hostSummaryRef);
        if (!doc.exists) return;

        const data = doc.data() || {};
        const newClickCount = Number(data.clickCount || 0) + 1;
        const newRecentClickCount = Number(data.recentClickCount || 0) + 1;
        const followersCount = Number(data.followersCount || 0);

        // Compute heatScore
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
    });

    return { success: true };
  },
);

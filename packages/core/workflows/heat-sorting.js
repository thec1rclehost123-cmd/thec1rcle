import { inngest, Events } from "../inngest-client.js";
import { getAdminDb } from "../admin.js";

/**
 * PRODUCTION WORKFLOW: Recalculate Event Heat Scores
 * 
 * Periodically updates the heatScore for all active events.
 * Triggered by a cron expression (e.g., every 30 minutes).
 */
export const recalculateHeatScores = inngest.createFunction(
    {
        id: "recalculate-heat-scores",
        name: "Recalculate Heat Scores",
    },
    { cron: "*/30 * * * *" }, // Every 30 minutes
    async ({ step }) => {
        const db = getAdminDb();

        const events = await step.run("fetch-active-events", async () => {
            const snapshot = await db.collection("events")
                .where("lifecycle", "in", ["scheduled", "live"])
                .where("isDeleted", "==", false)
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        // Batch update heat scores
        await step.run("update-heat-scores", async () => {
            const batch = db.batch();
            const now = new Date();

            for (const event of events) {
                // Formula: (Tickets Sold * 10) + (Heat Signal * 5) - (Days to Event penalty)
                // Simplified for Phase 2:
                const ticketsSold = event.ticketsStats?.totalSold || 0;
                const views = event.analytics?.views || 0;

                // Base score
                let score = (ticketsSold * 10) + (views * 0.5);

                // Recency/Urgency: More heat if event is soon (but not past)
                const eventStart = new Date(event.startDate);
                const diffDays = (eventStart - now) / (1000 * 60 * 60 * 24);

                if (diffDays > 0 && diffDays < 7) {
                    score += (7 - diffDays) * 20; // Up to 140 points for urgency
                }

                batch.update(db.collection("events").doc(event.id), {
                    heatScore: score,
                    heatScoreUpdatedAt: now.toISOString()
                });
            }

            await batch.commit();
            return { updated: events.length };
        });
    }
);

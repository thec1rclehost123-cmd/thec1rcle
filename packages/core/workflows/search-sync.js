import { inngest, Events } from "../inngest-client.js";
import { getAdminDb } from "../admin.js";
import { indexEvent, indexVenue, removeEventFromIndex } from "../search.js";

/**
 * PRODUCTION WORKFLOW: Sync Event to Search Index
 * 
 * Triggered when an event is published, updated, or cancelled.
 * Ensures Meilisearch stays in sync with Firestore.
 */
export const syncEventToSearch = inngest.createFunction(
    {
        id: "sync-event-to-search",
        name: "Sync Event to Meilisearch",
        retries: 3,
        concurrency: {
            limit: 10, // Max 10 concurrent syncs
        },
    },
    { event: Events.SEARCH_SYNC_EVENT },
    async ({ event, step }) => {
        const { eventId, action } = event.data;
        const db = getAdminDb();

        // Handle removal
        if (action === "remove") {
            await step.run("remove-from-index", async () => {
                await removeEventFromIndex(eventId);
                return { removed: true };
            });

            return { status: "removed", eventId };
        }

        // Fetch full event data
        const eventData = await step.run("fetch-event", async () => {
            const doc = await db.collection("events").doc(eventId).get();
            if (!doc.exists) throw new Error(`Event ${eventId} not found`);

            const data = doc.data();

            // Enrich with venue data
            if (data.venueId) {
                const venueDoc = await db.collection("venues").doc(data.venueId).get();
                if (venueDoc.exists) {
                    const venueData = venueDoc.data();
                    data.venueName = venueData.name;
                    data.venueCity = venueData.city;
                }
            }

            // Enrich with host data
            if (data.hostId) {
                const hostDoc = await db.collection("hosts").doc(data.hostId).get();
                if (hostDoc.exists) {
                    data.hostName = hostDoc.data().brandName;
                }
            }

            return { id: doc.id, ...data };
        });

        // Index to Meilisearch
        await step.run("index-event", async () => {
            const result = await indexEvent(eventData);
            return result;
        });

        return {
            status: "indexed",
            eventId,
            title: eventData.title
        };
    }
);

/**
 * PRODUCTION WORKFLOW: Sync Venue to Search Index
 */
export const syncVenueToSearch = inngest.createFunction(
    {
        id: "sync-venue-to-search",
        name: "Sync Venue to Meilisearch",
        retries: 3,
    },
    { event: Events.SEARCH_SYNC_VENUE },
    async ({ event, step }) => {
        const { venueId } = event.data;
        const db = getAdminDb();

        const venueData = await step.run("fetch-venue", async () => {
            const doc = await db.collection("venues").doc(venueId).get();
            if (!doc.exists) throw new Error(`Venue ${venueId} not found`);

            const data = doc.data();

            // Count upcoming events
            const eventsSnapshot = await db.collection("events")
                .where("venueId", "==", venueId)
                .where("status", "==", "published")
                .get();

            data.upcomingEventCount = eventsSnapshot.size;
            data.eventCount = eventsSnapshot.size;

            return { id: doc.id, ...data };
        });

        await step.run("index-venue", async () => {
            await indexVenue(venueData);
            return { indexed: true };
        });

        return {
            status: "indexed",
            venueId,
            name: venueData.name
        };
    }
);

/**
 * PRODUCTION WORKFLOW: Auto-sync on Event Publish
 * 
 * Listens for EVENT_PUBLISHED and triggers search index sync
 */
export const autoSyncOnPublish = inngest.createFunction(
    {
        id: "auto-sync-on-publish",
        name: "Auto-Sync Event on Publish",
        retries: 2,
    },
    { event: Events.EVENT_PUBLISHED },
    async ({ event, step }) => {
        const { eventId } = event.data;

        // Trigger search sync
        await step.run("trigger-search-sync", async () => {
            await inngest.send({
                name: Events.SEARCH_SYNC_EVENT,
                data: { eventId, action: "index" },
            });
            return { dispatched: true };
        });

        // Schedule the reminder for 2 hours before event
        await step.run("schedule-reminder", async () => {
            const db = getAdminDb();
            const eventDoc = await db.collection("events").doc(eventId).get();
            const eventData = eventDoc.data();

            if (!eventData?.startDate) return { skipped: true };

            const eventStart = new Date(eventData.startDate);
            const reminderTime = new Date(eventStart.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

            // Only schedule if reminder time is in the future
            if (reminderTime > new Date()) {
                await inngest.send({
                    name: Events.REMINDER_SCHEDULED,
                    data: {
                        eventId,
                        eventName: eventData.title,
                        eventDate: eventData.startDate,
                        venueAddress: eventData.venueAddress || eventData.location,
                    },
                    ts: reminderTime.getTime(), // Schedule for future
                });
                return { scheduled: true, reminderTime: reminderTime.toISOString() };
            }

            return { skipped: true, reason: "Event too soon for reminder" };
        });

        return { status: "synced", eventId };
    }
);

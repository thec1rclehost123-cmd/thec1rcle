import { NextResponse } from "next/server";
import {
    indexEvent,
    removeEventFromIndex,
    initializeSearchIndexes,
    fullSyncEvents
} from "@c1rcle/core/search";
import { getAdminDb, isFirebaseConfigured } from "@c1rcle/core/admin";

/**
 * POST /api/search/sync
 * 
 * Sync events to Meilisearch
 * Used by admin panel and automated workflows
 * 
 * Body:
 * - action: "index" | "remove" | "init" | "full-sync"
 * - eventId: (for index/remove) Single event ID
 * - event: (for index) Full event object
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { action } = body;

        // Initialize indexes (run once during deployment)
        if (action === "init") {
            const results = await initializeSearchIndexes();
            return NextResponse.json({
                success: true,
                action: "init",
                results,
            });
        }

        // Index a single event
        if (action === "index") {
            const { event, eventId } = body;

            // If only eventId provided, fetch from Firestore
            let eventToIndex = event;
            if (!eventToIndex && eventId && isFirebaseConfigured()) {
                const db = getAdminDb();
                const doc = await db.collection("events").doc(eventId).get();
                if (doc.exists) {
                    eventToIndex = { id: doc.id, ...doc.data() };
                }
            }

            if (!eventToIndex) {
                return NextResponse.json({ error: "Event not found" }, { status: 404 });
            }

            const result = await indexEvent(eventToIndex);
            return NextResponse.json({
                success: true,
                action: "index",
                eventId: eventToIndex.id,
                ...result,
            });
        }

        // Remove event from index
        if (action === "remove") {
            const { eventId } = body;
            if (!eventId) {
                return NextResponse.json({ error: "eventId required" }, { status: 400 });
            }

            const result = await removeEventFromIndex(eventId);
            return NextResponse.json({
                success: true,
                action: "remove",
                eventId,
                ...result,
            });
        }

        // Full sync from Firestore
        if (action === "full-sync") {
            if (!isFirebaseConfigured()) {
                return NextResponse.json({ error: "Firestore not configured" }, { status: 500 });
            }

            const db = getAdminDb();

            const getEventsFromDb = async () => {
                const snapshot = await db.collection("events")
                    .where("status", "in", ["published", "live"])
                    .get();

                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            };

            const results = await fullSyncEvents(getEventsFromDb);

            return NextResponse.json({
                success: true,
                action: "full-sync",
                batches: results,
                totalIndexed: results.reduce((sum, b) => sum + b.count, 0),
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("[Search Sync] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { listEvents } from "@/lib/server/eventStore";
import { getEventSalesStats } from "@/lib/server/orderStore";
import { listPartnerships } from "@/lib/server/partnershipStore";

/**
 * GET /api/host/overview
 * Fetches summary statistics and recent events for a host
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        // 1. Fetch host's events (recent 20)
        // Note: listEvents uses 'host' param which compares against 'host' label in firestore.
        // We need filtering by hostId. The listEvents function has a 'host' parameter.
        // Let's check if it supports hostId.

        const db = getAdminDb();
        const eventsSnapshot = await db.collection("events")
            .where("creatorId", "==", hostId)
            .orderBy("startDate", "desc")
            .limit(20)
            .get();

        const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Aggregate Stats
        let totalRevenue = 0;
        let totalTickets = 0;
        let pendingItems = events.filter((e: any) => e.lifecycle === "submitted").length;

        const statsPromises = events.map(async (event) => {
            const stats = await getEventSalesStats(event.id);
            return {
                revenue: stats.revenue || 0,
                ticketsSold: stats.ticketsSold || 0
            };
        });

        const allStats = await Promise.all(statsPromises);
        allStats.forEach(s => {
            totalRevenue += s.revenue;
            totalTickets += s.ticketsSold;
        });

        // 3. Active Promoters (Count active partnerships)
        // This is a simplification; ideally we count unique promoters across all events.
        const partnerships = await db.collection("partnerships")
            .where("hostId", "==", hostId)
            .where("status", "==", "active")
            .get();

        return NextResponse.json({
            stats: {
                revenue: totalRevenue,
                ticketsSold: totalTickets,
                activePromoters: partnerships.size,
                pendingItems: pendingItems
            },
            upcomingEvents: events.slice(0, 5).map((e: any) => ({
                id: e.id,
                name: e.title,
                date: e.date,
                startDate: e.startDate,
                venue_name: e.venue || "TBD",
                status: e.status,
                lifecycle: e.lifecycle,
                poster_url: e.image || e.poster
            }))
        });

    } catch (error: any) {
        console.error("[Host Overview API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { getEventSalesStats } from "@/lib/server/orderStore";

/**
 * GET /api/host/ops/tonight
 * Fetches real-time entry stats for the host's current active event
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        // 1. Get current active event for host
        // We'll use a simple query: live or starting today
        const db = getAdminDb();
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();

        const eventsSnapshot = await db.collection("events")
            .where("creatorId", "==", hostId)
            .where("startDate", ">=", startOfDay)
            .orderBy("startDate", "asc")
            .limit(1)
            .get();

        if (eventsSnapshot.empty) {
            return NextResponse.json({ event: null });
        }

        const event = { id: eventsSnapshot.docs[0].id, ...eventsSnapshot.docs[0].data() };

        // 2. Get real-time stats
        const stats = await getEventSalesStats(event.id);

        return NextResponse.json({
            event: {
                id: event.id,
                title: event.title || event.name,
                venue: event.venue || "TBD",
                status: event.status
            },
            stats: {
                ticketsSold: stats.ticketsSold || 0,
                checkedIn: stats.checkedIn || 0,
                revenue: stats.revenue || 0,
                scansPerHour: [10, 25, 45, 120, 85, 40] // Mocked timeline for UI
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

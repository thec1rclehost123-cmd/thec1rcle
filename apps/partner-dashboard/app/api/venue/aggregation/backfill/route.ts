import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { updateVenueDailyStats, appendLatestOrderFeed, updateEventLiveStats } from "@/lib/server/aggregation-engine";

const MAX_ORDERS_PER_BACKFILL = 5000;

/**
 * POST /api/venue/aggregation/backfill?venueId=
 *
 * Rebuilds venue_daily_stats, event_live_stats, and latest_orders_feed from
 * raw orders. Safe to run multiple times — uses set(merge:true) / idempotent writes.
 *
 * Requires OWNER role. Run once after deploy to seed the read models.
 *
 * Body (optional):
 *   { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 *   Defaults to last 365 days.
 */
export async function POST(request: NextRequest) {
    const ctx = await requireVenueAccess(request, "events:create"); // OWNER / MANAGER only
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!["OWNER", "MANAGER"].includes(ctx.baseRole)) {
        return NextResponse.json({ error: "Owner or Manager role required for backfill" }, { status: 403 });
    }

    const { venueId } = ctx;
    const db = getAdminDb();

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setFullYear(defaultStart.getFullYear() - 1);

    const startDate = body.startDate ? new Date(body.startDate) : defaultStart;
    const endDate   = body.endDate   ? new Date(body.endDate)   : now;

    const startIso = startDate.toISOString();
    const endIso   = endDate.toISOString();

    try {
        // Fetch confirmed orders within the date window (bounded)
        const [ordersSnap, rsvpSnap] = await Promise.all([
            db.collection("orders")
                .where("venueId", "==", venueId)
                .where("status", "==", "confirmed")
                .where("createdAt", ">=", startIso)
                .where("createdAt", "<=", endIso)
                .limit(MAX_ORDERS_PER_BACKFILL)
                .get(),
            db.collection("rsvp_orders")
                .where("venueId", "==", venueId)
                .where("status", "==", "confirmed")
                .where("createdAt", ">=", startIso)
                .where("createdAt", "<=", endIso)
                .limit(MAX_ORDERS_PER_BACKFILL)
                .get(),
        ]);

        // Aggregate by date and event
        const dailyMap  = new Map<string, { revenue: number; ticketsSold: number; rsvpCount: number }>();
        const eventMap  = new Map<string, { revenue: number; ticketsSold: number }>();
        const feedItems: Parameters<typeof appendLatestOrderFeed>[0][] = [];

        function processDoc(doc: FirebaseFirestore.QueryDocumentSnapshot, source: "ticket" | "rsvp") {
            const d  = doc.data();
            const dt = d.createdAt as string;
            if (!dt) return;

            const dateStr = dt.slice(0, 10); // YYYY-MM-DD
            const eventId = (d.eventId as string) || "";
            const amount  = Number(d.totalAmount ?? d.amount ?? 0);
            const tickets = Array.isArray(d.tickets)
                ? d.tickets.reduce((s: number, t: any) => s + Number(t?.quantity || 1), 0)
                : Number(d.quantity || 1);

            // Daily stats accumulator
            const prev = dailyMap.get(dateStr) || { revenue: 0, ticketsSold: 0, rsvpCount: 0 };
            dailyMap.set(dateStr, {
                revenue:     prev.revenue + amount,
                ticketsSold: prev.ticketsSold + (source === "ticket" ? tickets : 0),
                rsvpCount:   prev.rsvpCount + (source === "rsvp" ? 1 : 0),
            });

            // Event stats accumulator
            if (eventId) {
                const ep = eventMap.get(eventId) || { revenue: 0, ticketsSold: 0 };
                eventMap.set(eventId, {
                    revenue:     ep.revenue + amount,
                    ticketsSold: ep.ticketsSold + tickets,
                });
            }

            // Feed entry (most recent 50 will be kept by the feed endpoint's orderBy)
            feedItems.push({
                orderId:      doc.id,
                venueId,
                userId:       (d.userId ?? d.buyerId ?? "") as string,
                customerName: (d.customerName ?? d.userName ?? d.buyerName ?? "Guest") as string,
                eventId,
                eventName:    (d.eventName ?? d.eventTitle ?? "") as string,
                amount,
                ticketsCount: tickets,
                status:       "confirmed",
                source,
                createdAt:    dt,
            });
        }

        for (const doc of ordersSnap.docs)  processDoc(doc, "ticket");
        for (const doc of rsvpSnap.docs)    processDoc(doc, "rsvp");

        // Write daily stats (idempotent — replaces existing values with computed totals)
        const dailyWrites = Array.from(dailyMap.entries()).map(([date, totals]) =>
            updateVenueDailyStats(venueId, date, totals)
        );

        // Write event stats
        const eventWrites = Array.from(eventMap.entries()).map(([eventId, totals]) =>
            updateEventLiveStats(eventId, totals)
        );

        // Write feed entries (idempotent by orderId)
        const feedWrites = feedItems.map(entry => appendLatestOrderFeed(entry));

        await Promise.all([...dailyWrites, ...eventWrites, ...feedWrites]);

        return NextResponse.json({
            ok:          true,
            venueId,
            dateRange:   { start: startIso, end: endIso },
            ordersCount: ordersSnap.size + rsvpSnap.size,
            daysWritten: dailyMap.size,
            eventsWritten: eventMap.size,
            feedEntries: feedItems.length,
            truncated:   ordersSnap.size === MAX_ORDERS_PER_BACKFILL || rsvpSnap.size === MAX_ORDERS_PER_BACKFILL,
        });

    } catch (err: any) {
        console.error("[aggregation/backfill] Error:", err.message);
        return NextResponse.json({ error: "Backfill failed", detail: err.message }, { status: 500 });
    }
}

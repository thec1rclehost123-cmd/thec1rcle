import { NextRequest, NextResponse } from "next/server";
import { getEventGuestlist, getEventSalesStats } from "@/lib/server/orderStore";
import { getEventPromoterSummary } from "@/lib/server/promoterLinkStore";
import { getEvent } from "@/lib/server/eventStore";

/**
 * GET /api/club/overview/tonight
 * Fetches real-time stats for tonight's event for the dashboard overview
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) {
            return NextResponse.json({ error: "eventId is required" }, { status: 400 });
        }

        const event = await getEvent(eventId);
        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        // Fetch parallel stats
        const [guestlist, promoterSummary, salesStats] = await Promise.all([
            getEventGuestlist(eventId),
            getEventPromoterSummary(eventId),
            getEventSalesStats(eventId)
        ]);

        return NextResponse.json({
            expected: guestlist.length, // All people on guestlist (confirmed + pending + claimed)
            confirmed: guestlist.filter(g => g.status === 'confirmed' || g.status === 'checked_in').length,
            guestlistCount: guestlist.filter(g => g.type === 'guestlist' || g.type === 'rsvp').length,
            promotersCount: promoterSummary.totalPromoters,
            revenue: salesStats.revenue,
            ticketsSold: salesStats.ticketsSold,
            checkedIn: guestlist.filter(g => g.status === 'checked_in').length
        });

    } catch (error: any) {
        console.error("[Overview API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

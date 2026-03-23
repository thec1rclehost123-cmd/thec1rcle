import { NextRequest, NextResponse } from "next/server";
import { getEventGuestlist, getEventSalesStats } from "@/lib/server/orderStore";
import { getEventPromoterSummary } from "@/lib/server/promoterLinkStore";
import { getEvent } from "@/lib/server/eventStore";
import { requireAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/overview/tonight
 * Fetches real-time stats for tonight's event for the dashboard overview
 */
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) return fail("eventId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        const event = await getEvent(eventId, token);
        if (!event) return fail("Event not found", 404);

        const [guestlist, promoterSummary, salesStats] = await Promise.all([
            getEventGuestlist(eventId, 50, token),
            getEventPromoterSummary(eventId, token),
            getEventSalesStats(eventId, token)
        ]);

        return NextResponse.json({
            expected: guestlist.length,
            confirmed: guestlist.filter((g: any) => g.status === 'confirmed' || g.status === 'checked_in').length,
            guestlistCount: guestlist.filter((g: any) => g.type === 'guestlist' || g.type === 'rsvp').length,
            promotersCount: promoterSummary.totalPromoters,
            revenue: salesStats.revenue,
            ticketsSold: salesStats.ticketsSold,
            checkedIn: guestlist.filter((g: any) => g.status === 'checked_in').length
        });
    } catch (error: any) {
        console.error("[Overview API] Error:", error);
        return fail("Failed to fetch tonight's overview");
    }
}

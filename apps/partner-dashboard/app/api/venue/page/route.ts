import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import {
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,
    getVenueUpcomingEvents,
    getVenuePastEvents
} from "@/lib/server/venuePageStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/page
 * Get venue page data
 * Query params:
 *   - venueId: Venue ID
 *   - dashboard: "true" for dashboard view (includes inactive items)
 *   - events: "true" to include upcoming events
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId");
        const isDashboard = searchParams.get("dashboard") === "true";
        const includeEvents = searchParams.get("events") === "true";

        const decodedToken = await verifyAuth(req);

        if (!venueId && isDashboard && decodedToken) {
            venueId = (decodedToken as any).partnerId;
        }

        if (!venueId) return fail("venueId is required", 400);

        if (isDashboard) {
            if (!decodedToken) return fail("Unauthorized", 401);

            const hasAccess = await verifyPartnerAccess(req, venueId);
            if (!hasAccess) return fail("Forbidden: You don't have access to this venue", 403);
        }

        const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim() || "";

        const pageData = isDashboard
            ? await getVenuePageDataForDashboard(venueId, token)
            : await getVenuePageData(venueId, token);

        if (!pageData) return fail("Venue not found", 404);

        let events: any[] = [];
        let pastEvents: any[] = [];
        if (includeEvents) {
            [events, pastEvents] = await Promise.all([
                getVenueUpcomingEvents(venueId, token),
                getVenuePastEvents(venueId, token)
            ]);
        }

        return NextResponse.json({ ...pageData, events, pastEvents });
    } catch (error: any) {
        console.error("[API /venue/page GET]", error);
        return fail("Failed to fetch venue page");
    }
}

/**
 * POST /api/venue/page
 * Update venue basic details
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, updates } = body;

        if (!venueId || !updates) return fail("venueId and updates are required", 400);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden", 403);

        const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim() || "";
        const result = await updateVenueDetails(venueId, updates, token);

        return ok({ result }, "Venue updated");
    } catch (error: any) {
        console.error("[API /venue/page POST]", error);
        return fail("Failed to update venue");
    }
});

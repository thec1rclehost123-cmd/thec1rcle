import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import {
    getVenuePageData,
    getVenuePageDataForDashboard,
    updateVenueDetails,
    getVenueUpcomingEvents,
    getVenuePastEvents
} from "@/lib/server/venuePageStore";

/**
 * GET /api/venue/page
 * 
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

        // Auto-resolve venueId if missing in dashboard mode
        if (!venueId && isDashboard && decodedToken) {
            venueId = (decodedToken as any).partnerId;
        }

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        // For dashboard view, verify user has access to this venue
        if (isDashboard) {
            if (!decodedToken) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const hasAccess = await verifyPartnerAccess(req, venueId);
            if (!hasAccess) {
                return NextResponse.json({ error: "Forbidden: You don't have access to this venue" }, { status: 403 });
            }
        }

        // Get page data
        const pageData = isDashboard
            ? await getVenuePageDataForDashboard(venueId)
            : await getVenuePageData(venueId);

        if (!pageData) {
            return NextResponse.json({ error: "Venue not found" }, { status: 404 });
        }

        // Optionally include events
        let events = [];
        let pastEvents = [];
        if (includeEvents) {
            [events, pastEvents] = await Promise.all([
                getVenueUpcomingEvents(venueId),
                getVenuePastEvents(venueId)
            ]);
        }

        return NextResponse.json({
            ...pageData,
            events,
            pastEvents
        });
    } catch (error: any) {
        console.error("[API /venue/page GET]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/venue/page
 * 
 * Update venue basic details
 */
export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { venueId, updates } = body;

        if (!venueId || !updates) {
            return NextResponse.json({ error: "venueId and updates are required" }, { status: 400 });
        }

        // Verify access
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const user = {
            uid: decodedToken.uid,
            name: decodedToken.name || decodedToken.email || "User"
        };

        const result = await updateVenueDetails(venueId, updates);

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("[API /venue/page POST]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

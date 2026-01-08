import { NextRequest, NextResponse } from "next/server";
import {
    getVenueAnalytics,
    getVenueAudienceAnalytics,
    getVenueFunnelAnalytics,
    getVenueOpsAnalytics,
    getVenuePartnerAnalytics,
    getVenueStrategyAnalytics,
    getEventTimeline,
    getEventStudioInsights
} from "@/lib/server/analyticsStore";


/**
 * GET /api/venue/analytics/[type]
 * Fetches specific analytics for a venue
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { type: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId") || searchParams.get("venueId");
        const range = searchParams.get("range") || "30d";
        const { type } = params;

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        let analytics;
        switch (type) {
            case "overview":
                analytics = await getVenueAnalytics(venueId, range);
                break;
            case "audience":
                analytics = await getVenueAudienceAnalytics(venueId, range);
                break;
            case "funnel":
                analytics = await getVenueFunnelAnalytics(venueId, range);
                break;
            case "ops":
                analytics = await getVenueOpsAnalytics(venueId, range);
                break;
            case "partners":
                analytics = await getVenuePartnerAnalytics(venueId, range);
                break;
            case "strategy":
                analytics = await getVenueStrategyAnalytics(venueId, range);
                break;
            case "timeline":
                const eventId = searchParams.get("eventId");
                if (!eventId) return NextResponse.json({ error: "eventId required for timeline" }, { status: 400 });
                analytics = await getEventTimeline(eventId);
                break;
            case "insights":
                const eId = searchParams.get("eventId");
                if (!eId) return NextResponse.json({ error: "eventId required for insights" }, { status: 400 });
                analytics = await getEventStudioInsights(eId);
                break;

            default:
                return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
        }

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error(`[Venue Analytics API][${params.type}] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

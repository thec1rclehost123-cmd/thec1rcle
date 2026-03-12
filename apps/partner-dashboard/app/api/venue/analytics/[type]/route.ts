import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

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
        const venueId = searchParams.get("venueId") || searchParams.get("partnerId");
        const range = searchParams.get("range") || "30d";
        const { type } = params;

        console.log(`📡 [API/Analytics] Request: type=${type}, venueId=${venueId}, range=${range}`);

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        let analytics;
        switch (type) {
            case "overview":
                analytics = await getVenueAnalytics(venueId, range, token);
                break;
            case "audience":
                analytics = await getVenueAudienceAnalytics(venueId, range, token);
                break;
            case "reach":
            case "funnel":
                analytics = await getVenueFunnelAnalytics(venueId, range, token);
                break;
            case "engagement":
            case "ops":
                analytics = await getVenueOpsAnalytics(venueId, range, token);
                break;
            case "revenue":
                // Standard venue overview covers revenue totals
                analytics = await getVenueAnalytics(venueId, range, token);
                break;
            case "attribution":
            case "partners":
                analytics = await getVenuePartnerAnalytics(venueId, range, token);
                break;
            case "strategy":
                analytics = await getVenueStrategyAnalytics(venueId, token);
                break;
            case "timeline":
                const eventId = searchParams.get("eventId");
                if (!eventId) return NextResponse.json({ error: "eventId required for timeline" }, { status: 400 });
                analytics = await getEventTimeline(eventId, token);
                break;
            case "insights":
                const eId = searchParams.get("eventId");
                if (!eId) return NextResponse.json({ error: "eventId required for insights" }, { status: 400 });
                analytics = await getEventStudioInsights(eId, token);
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

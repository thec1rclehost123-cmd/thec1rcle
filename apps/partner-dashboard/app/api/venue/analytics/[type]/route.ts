import { NextRequest } from "next/server";
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
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/analytics/[type]
 * Fetches specific analytics for a venue
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    const type = ctx?.params?.type || "";
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId") || searchParams.get("partnerId");
        const range = searchParams.get("range") || "30d";

        if (!venueId) return fail("venueId is required", 400);

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
                analytics = await getVenueAnalytics(venueId, range, token);
                break;
            case "attribution":
            case "partners":
                analytics = await getVenuePartnerAnalytics(venueId, range, token);
                break;
            case "strategy":
                analytics = await getVenueStrategyAnalytics(venueId, token);
                break;
            case "timeline": {
                const eventId = searchParams.get("eventId");
                if (!eventId) return fail("eventId required for timeline", 400);
                analytics = await getEventTimeline(eventId, token);
                break;
            }
            case "insights": {
                const eId = searchParams.get("eventId");
                if (!eId) return fail("eventId required for insights", 400);
                analytics = await getEventStudioInsights(eId, token);
                break;
            }
            default:
                return fail("Invalid analytics type", 400);
        }

        return ok({ analytics });
    } catch (error: any) {
        console.error(`[Venue Analytics API][${type}] Error:`, error);
        return fail("Failed to fetch analytics");
    }
});

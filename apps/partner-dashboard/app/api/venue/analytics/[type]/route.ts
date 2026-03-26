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
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/analytics/[type]
 * Fetches specific analytics for a venue
 * RBAC: analytics:read — OWNER or staff with explicit permission
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
    const venueCtx = await requireVenueAccess(req, "analytics:read");
    if ("error" in venueCtx) return NextResponse.json({ error: venueCtx.error }, { status: venueCtx.status });

    try {
        const { searchParams } = new URL(req.url);
        const venueId = venueCtx.venueId;
        const range = searchParams.get("range") || "30d";

        // Next.js 15+ Dynamic API: params is a Promise
        const params = await ctx?.params;
        const type = params?.type || "";

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

        // Cache: live/insights data freshest (30s), overview/audience moderate (60s), historical long (5min)
        const cacheSeconds = ["timeline", "insights"].includes(type) ? 30
            : type === "overview" ? 60
            : 300;
        return NextResponse.json(
            { success: true, analytics, message: "" },
            { headers: { "Cache-Control": `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}` } }
        );
    } catch (error: any) {
        console.error(`[Venue Analytics API] Error:`, error);
        return fail("Failed to fetch analytics");
    }
}

import { NextRequest, NextResponse } from "next/server";
import {
    getHostAnalytics,
    getHostPerformanceAnalytics,
    getHostAudienceAnalytics,
    getHostReliabilityAnalytics,
    getHostPartnerAnalytics,
    getHostStrategyAnalytics
} from "@/lib/server/analyticsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/host/analytics/[type]
 * Fetches specific analytics for a host
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const range = searchParams.get("range") || "30d";
        const type = ctx?.params?.type as string;

        if (!hostId) return fail("hostId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        let analytics;
        switch (type) {
            case "overview":
                analytics = await getHostAnalytics(hostId, range, token);
                break;
            case "performance":
                analytics = await getHostPerformanceAnalytics(hostId, token);
                break;
            case "audience":
                analytics = await getHostAudienceAnalytics(hostId, token);
                break;
            case "reliability":
                analytics = await getHostReliabilityAnalytics(hostId, token);
                break;
            case "partners":
                analytics = await getHostPartnerAnalytics(hostId, range, token);
                break;
            case "strategy":
                analytics = await getHostStrategyAnalytics(hostId, token);
                break;
            default:
                return fail("Invalid analytics type", 400);
        }

        const cacheSeconds = type === "overview" ? 60 : 300;
        return NextResponse.json(
            { success: true, ...analytics, message: "" },
            { headers: { "Cache-Control": `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}` } }
        );
    } catch (error: any) {
        console.error(`[Host Analytics API][${ctx?.params?.type}] Error:`, error);
        return fail("Failed to fetch analytics");
    }
});

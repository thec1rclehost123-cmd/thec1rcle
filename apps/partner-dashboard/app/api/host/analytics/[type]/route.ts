import { NextRequest, NextResponse } from "next/server";
import {
    getHostAnalytics,
    getHostPerformanceAnalytics,
    getHostAudienceAnalytics,
    getHostReliabilityAnalytics,
    getHostPartnerAnalytics,
    getHostStrategyAnalytics
} from "@/lib/server/analyticsStore";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/host/analytics/[type]
 * Fetches specific analytics for a host
 */
export async function GET(req: NextRequest, context: { params: Promise<{ type: string }> }) {
    const ctx = await requireHostAccess(req, "VIEW_ANALYTICS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { type } = await context.params;
        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        let analytics;
        switch (type) {
            case "overview":
                analytics = await getHostAnalytics(ctx.hostId, range, token);
                break;
            case "performance":
                analytics = await getHostPerformanceAnalytics(ctx.hostId, token);
                break;
            case "audience":
                analytics = await getHostAudienceAnalytics(ctx.hostId, token);
                break;
            case "reliability":
                analytics = await getHostReliabilityAnalytics(ctx.hostId, token);
                break;
            case "partners":
                analytics = await getHostPartnerAnalytics(ctx.hostId, range, token);
                break;
            case "strategy":
                analytics = await getHostStrategyAnalytics(ctx.hostId, token);
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
        console.error("[Host Analytics API] Error:", error);
        return fail("Failed to fetch analytics");
    }
}

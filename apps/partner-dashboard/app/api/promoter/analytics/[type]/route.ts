import { NextRequest } from "next/server";
import {
    getPromoterAnalytics,
    getPromoterEventPerformance,
    getPromoterAudienceAnalytics,
    getPromoterFunnelAnalytics,
    getPromoterTrustAnalytics,
    getPromoterStrategyAnalytics
} from "@/lib/server/analyticsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/analytics/[type]
 * Fetches specific analytics for a promoter
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const range = searchParams.get("range") || "30d";
        const type = ctx?.params?.type as string;

        if (!promoterId) return fail("promoterId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        let analytics;
        switch (type) {
            case "overview":
                analytics = await getPromoterAnalytics(promoterId, range, token);
                break;
            case "performance":
                analytics = await getPromoterEventPerformance(promoterId, range, token);
                break;
            case "audience":
                analytics = await getPromoterAudienceAnalytics(promoterId, range, token);
                break;
            case "funnel":
                analytics = await getPromoterFunnelAnalytics(promoterId, range, token);
                break;
            case "trust":
                analytics = await getPromoterTrustAnalytics(promoterId, token);
                break;
            case "strategy":
                analytics = await getPromoterStrategyAnalytics(promoterId, range, token);
                break;
            default:
                return fail("Invalid analytics type", 400);
        }

        return ok(analytics);
    } catch (error: any) {
        console.error(`[Promoter Analytics API][${ctx?.params?.type}] Error:`, error);
        return fail("Failed to fetch analytics");
    }
});

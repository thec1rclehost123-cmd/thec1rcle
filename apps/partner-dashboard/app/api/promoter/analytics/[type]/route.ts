import { NextRequest, NextResponse } from "next/server";
import {
    getPromoterAnalytics,
    getPromoterEventPerformance,
    getPromoterAudienceAnalytics,
    getPromoterFunnelAnalytics,
    getPromoterTrustAnalytics,
    getPromoterStrategyAnalytics
} from "@/lib/server/analyticsStore";

/**
 * GET /api/promoter/analytics/[type]
 * Fetches specific analytics for a promoter
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { type: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const range = searchParams.get("range") || "30d";
        const { type } = params;

        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        let analytics;
        switch (type) {
            case "overview":
                analytics = await getPromoterAnalytics(promoterId, range);
                break;
            case "performance":
                analytics = await getPromoterEventPerformance(promoterId, range);
                break;
            case "audience":
                analytics = await getPromoterAudienceAnalytics(promoterId, range);
                break;
            case "funnel":
                analytics = await getPromoterFunnelAnalytics(promoterId, range);
                break;
            case "trust":
                analytics = await getPromoterTrustAnalytics(promoterId, range);
                break;
            case "strategy":
                analytics = await getPromoterStrategyAnalytics(promoterId, range);
                break;
            default:
                return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
        }

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error(`[Promoter Analytics API][${params.type}] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

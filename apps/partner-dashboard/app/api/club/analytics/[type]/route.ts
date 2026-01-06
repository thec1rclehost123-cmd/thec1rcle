import { NextRequest, NextResponse } from "next/server";
import {
    getClubAnalytics,
    getClubAudienceAnalytics,
    getClubFunnelAnalytics,
    getClubOpsAnalytics,
    getClubPartnerAnalytics,
    getClubStrategyAnalytics
} from "@/lib/server/analyticsStore";

/**
 * GET /api/club/analytics/[type]
 * Fetches specific analytics for a venue
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { type: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const range = searchParams.get("range") || "30d";
        const { type } = params;

        if (!clubId) {
            return NextResponse.json({ error: "clubId is required" }, { status: 400 });
        }

        let analytics;
        switch (type) {
            case "overview":
                analytics = await getClubAnalytics(clubId, range);
                break;
            case "audience":
                analytics = await getClubAudienceAnalytics(clubId, range);
                break;
            case "funnel":
                analytics = await getClubFunnelAnalytics(clubId, range);
                break;
            case "ops":
                analytics = await getClubOpsAnalytics(clubId, range);
                break;
            case "partners":
                analytics = await getClubPartnerAnalytics(clubId, range);
                break;
            case "strategy":
                analytics = await getClubStrategyAnalytics(clubId, range);
                break;
            default:
                return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
        }

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error(`[Club Analytics API][${params.type}] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import {
    getHostAnalytics,
    getHostPerformanceAnalytics,
    getHostAudienceAnalytics,
    getHostReliabilityAnalytics,
    getHostPartnerAnalytics,
    getHostStrategyAnalytics
} from "@/lib/server/analyticsStore";

/**
 * GET /api/host/analytics/[type]
 * Fetches specific analytics for a host
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { type: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const range = searchParams.get("range") || "30d";
        const { type } = params;

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        let analytics;
        switch (type) {
            case "overview":
                analytics = await getHostAnalytics(hostId, range);
                break;
            case "performance":
                analytics = await getHostPerformanceAnalytics(hostId, range);
                break;
            case "audience":
                analytics = await getHostAudienceAnalytics(hostId, range);
                break;
            case "reliability":
                analytics = await getHostReliabilityAnalytics(hostId, range);
                break;
            case "partners":
                analytics = await getHostPartnerAnalytics(hostId, range);
                break;
            case "strategy":
                analytics = await getHostStrategyAnalytics(hostId, range);
                break;
            default:
                return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
        }

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error(`[Host Analytics API][${params.type}] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

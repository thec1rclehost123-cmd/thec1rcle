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
                return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
        }

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error(`[Host Analytics API][${params.type}] Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

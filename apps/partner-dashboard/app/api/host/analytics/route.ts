import { NextRequest, NextResponse } from "next/server";
import { getHostAnalytics } from "@/lib/server/analyticsStore";

/**
 * GET /api/host/analytics
 * Fetches performance analytics for a host
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const range = searchParams.get("range") || "30d";

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        const analytics = await getHostAnalytics(hostId, range);

        return NextResponse.json(analytics);

    } catch (error: any) {
        console.error("[Host Analytics API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

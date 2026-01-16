import { NextRequest, NextResponse } from "next/server";
import { getVenueOverviewStats } from "@/lib/server/analyticsStore";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId") || searchParams.get("venueId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const stats = await getVenueOverviewStats(venueId);
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("[Venue Summary API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

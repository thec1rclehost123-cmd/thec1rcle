import { NextRequest, NextResponse } from "next/server";
import { getHostOverviewStats } from "@/lib/server/analyticsStore";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        const stats = await getHostOverviewStats(hostId);
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error("[Host Summary API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

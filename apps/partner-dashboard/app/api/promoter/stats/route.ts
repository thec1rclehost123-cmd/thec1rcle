import { NextRequest, NextResponse } from "next/server";
import { getPromoterAnalytics } from "@/lib/server/analyticsStore";

/**
 * GET /api/promoter/stats
 * Fetches combined stats and timeline for a promoter
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const range = searchParams.get("range") || "30d";

        if (!promoterId) {
            return NextResponse.json(
                { error: "promoterId is required" },
                { status: 400 }
            );
        }

        const analytics = await getPromoterAnalytics(promoterId, range);

        return NextResponse.json({ ...analytics });
    } catch (error: any) {
        console.error("[Promoter Stats API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getPromoterStats } from "@/lib/server/promoterLinkStore";

/**
 * GET /api/promoter/stats
 * Get promoter statistics
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");

        if (!promoterId) {
            return NextResponse.json(
                { error: "promoterId is required" },
                { status: 400 }
            );
        }

        const stats = await getPromoterStats(promoterId);

        return NextResponse.json({ stats });
    } catch (error: any) {
        console.error("[Promoter Stats API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}

import { NextRequest } from "next/server";
import { getPromoterAnalytics } from "@/lib/server/analyticsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/stats
 * Fetches combined stats and timeline for a promoter
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const range = searchParams.get("range") || "30d";

        if (!promoterId) return fail("promoterId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const analytics = await getPromoterAnalytics(promoterId, range, token);

        return ok(analytics);
    } catch (error: any) {
        console.error("[Promoter Stats API] GET Error:", error);
        return fail("Failed to fetch stats");
    }
});

import { NextRequest } from "next/server";
import { getHostAnalytics } from "@/lib/server/analyticsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/host/analytics
 * Fetches performance analytics for a host
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const range = searchParams.get("range") || "30d";

        if (!hostId) return fail("hostId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const analytics = await getHostAnalytics(hostId, range, token);

        return ok(analytics);
    } catch (error: any) {
        console.error("[Host Analytics API] Error:", error);
        return fail("Failed to fetch analytics");
    }
});

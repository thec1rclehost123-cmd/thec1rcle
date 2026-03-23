import { NextRequest } from "next/server";
import { getHostOverviewStats } from "@/lib/server/analyticsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        if (!hostId) return fail("hostId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const stats = await getHostOverviewStats(hostId, token);
        return ok({ stats });
    } catch (error: any) {
        console.error("[Host Summary API] Error:", error);
        return fail("Failed to fetch host summary");
    }
});

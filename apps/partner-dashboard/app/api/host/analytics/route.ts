import { NextRequest, NextResponse } from "next/server";
import { getHostAnalytics } from "@/lib/server/analyticsStore";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/host/analytics
 * Fetches performance analytics for a host
 */
export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req, "VIEW_ANALYTICS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const range = searchParams.get("range") || "30d";
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const analytics = await getHostAnalytics(ctx.hostId, range);
        return ok(analytics);
    } catch (error: any) {
        console.error("[Host Analytics API] Error:", error);
        return fail("Failed to fetch analytics");
    }
}

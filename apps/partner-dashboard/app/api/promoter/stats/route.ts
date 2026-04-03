import { NextRequest } from "next/server";
import { getPromoterStats } from "@/lib/server/promoterLinkStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/stats
 * Fetches combined stats and timeline for a promoter
 */
export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    try {
        const stats = await getPromoterStats(ctx.promoterId);
        return ok(stats);
    } catch (error: any) {
        console.error("[Promoter Stats API] GET Error:", error);
        return fail("Failed to fetch stats");
    }
}

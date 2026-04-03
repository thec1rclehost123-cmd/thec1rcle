import { NextRequest, NextResponse } from "next/server";
import { getPromoterLinkAnalytics, listPromoterLinks } from "@/lib/server/promoterLinkStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/links/[id]/analytics
 * Returns funnel + commission data for a specific link.
 * Verifies ownership before returning data.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    try {
        const { id: linkId } = await params;

        // Ownership check
        const [link] = await listPromoterLinks({ linkId, promoterId: ctx.promoterId, limit: 1 });

        if (!link) return fail("Link not found", 404);

        const analytics = await getPromoterLinkAnalytics(linkId);

        return NextResponse.json(analytics);
    } catch (error: any) {
        console.error("[Promoter Links Analytics] GET Error:", error);
        // Soft-fail so drawer still renders
        return NextResponse.json({
            link: null,
            funnel: { clicks: 0, conversions: 0, revenue: 0 },
            commissions: []
        });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getPromoterLinkAnalytics, listPromoterLinks } from "@/lib/server/promoterLinkStore";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/links/[id]/analytics
 * Returns funnel + commission data for a specific link.
 * Verifies ownership before returning data.
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const linkId = ctx?.params?.id as string;
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        // Ownership check
        const links = await listPromoterLinks({ linkId }, token);
        const link = Array.isArray(links) ? links.find((l: any) => l.id === linkId) : null;

        if (link && link.promoterId && link.promoterId !== auth.uid) {
            return fail("Forbidden", 403);
        }

        const analytics = await getPromoterLinkAnalytics(linkId, token);

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
});

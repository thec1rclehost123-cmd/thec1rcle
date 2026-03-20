import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getPromoterLinkAnalytics, listPromoterLinks } from "@/lib/server/promoterLinkStore";

/**
 * GET /api/promoter/links/[id]/analytics
 * Returns funnel + commission data for a specific link.
 * Verifies ownership before returning data.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: linkId } = params;
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        // Ownership check
        const links = await listPromoterLinks({ linkId }, token);
        const link = Array.isArray(links) ? links.find((l: any) => l.id === linkId) : null;

        if (link && link.promoterId && link.promoterId !== decodedToken.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const analytics = await getPromoterLinkAnalytics(linkId, token);

        return NextResponse.json(analytics);
    } catch (error: any) {
        console.error("[Promoter Links Analytics] GET Error:", error);
        return NextResponse.json(
            {
                link: null,
                funnel: { clicks: 0, conversions: 0, revenue: 0 },
                commissions: []
            },
            { status: 200 } // soft-fail so drawer still renders
        );
    }
}

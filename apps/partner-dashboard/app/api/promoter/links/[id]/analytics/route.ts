import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/promoter/links/[id]/analytics
 * Returns funnel + commission data for a specific link.
 * Verifies ownership before returning data.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { id: linkId } = await params;
    const { searchParams } = new URL(req.url);
    searchParams.set("promoterId", ctx.promoterId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/links/${linkId}/analytics?${searchParams.toString()}`, {});
}

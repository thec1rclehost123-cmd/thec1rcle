/**
 * THE C1RCLE - Host Overview API (BFF Proxy)
 * Delegates to API Gateway for host dashboard summary
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/host/overview?hostId=XXX
 * Fetches summary statistics and recent events for a host
 */
export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/host/overview?${searchParams.toString()}`, {});
}

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    // Forward to gateway — promoterId is resolved from the auth token on the gateway side
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoters/promoter/guests/assign`, {
        method: "POST",
    });
}

import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/promoter-requests?${searchParams}`, {});
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    const { connectionId, action } = body;
    if (!connectionId || !action) {
        return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "connectionId and action are required" } }, { status: 400 });
    }
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/promoter-connections/${connectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ hostId: ctx.hostId, action }),
    });
}

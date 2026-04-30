import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/host/profile?${searchParams}`, {});
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => null);
    if (!body) return fail("Request body required", 400);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/host/profile`, {
        method: "PATCH",
        body: JSON.stringify({ hostId: ctx.hostId, patch: body }),
    });
}

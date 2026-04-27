import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { search } = new URL(req.url);
    const searchParams = new URLSearchParams(search);
    searchParams.set("promoterId", ctx.promoterId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/settings/notifications?${searchParams.toString()}`, {});
}

export async function PATCH(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/settings/notifications`, {
        method: "PATCH",
        body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
    });
}

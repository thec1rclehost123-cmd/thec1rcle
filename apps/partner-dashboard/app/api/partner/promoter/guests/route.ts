import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("promoterId", ctx.promoterId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/guests?${searchParams}`, {});
}

export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/guests`, {
        method: "POST",
        body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
    });
}

export async function DELETE(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/guests`, {
        method: "DELETE",
        body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
    });
}

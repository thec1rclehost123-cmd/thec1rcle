import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(request.url);
    searchParams.set("promoterId", ctx.promoterId);
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/promoter/finance/bank-accounts?${searchParams.toString()}`, {});
}

export async function POST(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await request.json().catch(() => ({}));
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/promoter/finance/bank-accounts`, {
        method: "POST",
        body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
    });
}

export async function DELETE(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await request.json().catch(() => ({}));
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/promoter/finance/bank-accounts`, {
        method: "DELETE",
        body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
    });
}

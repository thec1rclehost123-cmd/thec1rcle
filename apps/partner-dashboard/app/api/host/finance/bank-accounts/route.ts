import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req, "VIEW_FINANCIALS");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/finance/bank-accounts?${searchParams}`, {});
}

export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_FINANCIALS");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/finance/bank-accounts`, {
        method: "POST",
        body: JSON.stringify({ hostId: ctx.hostId, ...body }),
    });
}

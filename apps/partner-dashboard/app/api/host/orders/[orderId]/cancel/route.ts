import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_ORDERS");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/host/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ hostId: ctx.hostId, ...body }),
    });
}

import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params;
    const ctx = await requireVenueAccess(req, "manage_orders");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ venueId: ctx.venueId, ...body }),
    });
}

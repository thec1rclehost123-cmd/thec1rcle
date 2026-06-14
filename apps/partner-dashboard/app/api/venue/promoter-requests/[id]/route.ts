import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireVenueAccess(req, "manage_promoters");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/venues/promoter-connections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ venueId: ctx.venueId, ...body }),
    });
}

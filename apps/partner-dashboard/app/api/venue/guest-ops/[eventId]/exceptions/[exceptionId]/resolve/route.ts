import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string; exceptionId: string }> }) {
    const { eventId, exceptionId } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/guest-ops/${eventId}/exceptions/${exceptionId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ venueId: ctx.venueId, ...body }),
    });
}

import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";

export async function GET(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "settings:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(req.url);
    searchParams.set("venueId", ctx.venueId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue?${searchParams.toString()}`, {});
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "settings:edit");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const body = await req.json().catch(() => null);
    if (!body?.patch) return fail("patch required", 400);

    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue`, {
        method: "PATCH",
        body: JSON.stringify({ venueId: ctx.venueId, updates: body.patch }),
    });
}

import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/server/apiResponse";
import { tryProxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getVenueSettings, updateVenueSettings } from "@/lib/server/venueSettingsStore";

export async function GET(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "settings:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(req.url);
    const proxied = await tryProxyToGateway(
        req,
        `${GATEWAY_URL}/api/v1/venue-settings/venue?${searchParams.toString()}`,
        {}
    );
    if (proxied) return NextResponse.json(proxied);

    const settings = await getVenueSettings(ctx.venueId);
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "settings:edit");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const body = await req.json().catch(() => null);
    if (!body?.patch) return fail("patch required", 400);

    const proxied = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue`, {
        method: "PATCH",
        body: JSON.stringify({ venueId: ctx.venueId, patch: body.patch }),
    });
    if (proxied) return NextResponse.json(proxied);

    const settings = await updateVenueSettings(ctx.venueId, body.patch, {
        uid: ctx.uid,
        displayName: ctx.uid,
    });
    return NextResponse.json({ settings });
}

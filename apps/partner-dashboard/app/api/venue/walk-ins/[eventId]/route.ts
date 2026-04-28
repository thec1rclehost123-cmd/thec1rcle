import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("venueId", ctx.venueId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/walk-ins/${eventId}?${searchParams}`, {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/walk-ins/${eventId}?logId=${searchParams.get("logId") ?? ""}`, {
        method: "PATCH",
        body: JSON.stringify({ venueId: ctx.venueId, ...body }),
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("venueId", ctx.venueId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/walk-ins/${eventId}?${searchParams}`, {
        method: "DELETE",
    });
}

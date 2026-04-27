import { NextRequest, NextResponse } from "next/server";
import { requireManagementRole } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
    const { profileId } = await params;
    const ctx = await requireManagementRole(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("venueId", ctx.venueId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/staff-profiles/${profileId}?${searchParams}`, {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
    const { profileId } = await params;
    const ctx = await requireManagementRole(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/staff-profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify({ venueId: ctx.venueId, ...body }),
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
    const { profileId } = await params;
    const ctx = await requireManagementRole(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/staff-profiles/${profileId}`, {
        method: "DELETE",
        body: JSON.stringify({ venueId: ctx.venueId }),
    });
}

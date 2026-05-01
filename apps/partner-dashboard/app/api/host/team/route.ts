import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/team?${searchParams}`, {});
}

export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => null);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/team`, {
        method: "POST",
        body: JSON.stringify({ hostId: ctx.hostId, ...body }),
    });
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    const membershipId = searchParams.get("membershipId");
    const body = await req.json().catch(() => null);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/team/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ hostId: ctx.hostId, ...body }),
    });
}

export async function DELETE(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    const membershipId = searchParams.get("membershipId");
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/team/${membershipId}`, {
        method: "DELETE",
        body: JSON.stringify({ hostId: ctx.hostId }),
    });
}

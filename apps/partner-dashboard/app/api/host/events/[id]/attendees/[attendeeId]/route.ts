import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; attendeeId: string }> }) {
    const { id, attendeeId } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/events/${id}/attendees/${attendeeId}?${searchParams}`, {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; attendeeId: string }> }) {
    const { id, attendeeId } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/events/${id}/attendees/${attendeeId}`, {
        method: "PATCH",
        body: JSON.stringify({ hostId: ctx.hostId, ...body }),
    });
}

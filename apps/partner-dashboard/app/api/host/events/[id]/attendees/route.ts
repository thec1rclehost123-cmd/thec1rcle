import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/host/events/${id}/attendees?${searchParams}`, {});
}

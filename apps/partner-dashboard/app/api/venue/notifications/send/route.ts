/**
 * THE C1RCLE - Send Venue Notification API (BFF Proxy)
 * Delegates push notification sending to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/venue/notifications/send
 * Sends a push notification to all followers of a venue
 */
export async function POST(req: NextRequest) {
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/send`, {
        method: "POST",
        body: JSON.stringify({ venueId: ctx.venueId, ...body })
    });
}

/**
 * THE C1RCLE - Host Broadcast API (BFF Proxy)
 * Sends push notifications to all host followers via API Gateway
 * Gateway handles FCM delivery and notification storage
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/host/broadcast
 * Body: { title, message }  (hostId resolved from RBAC context)
 */
export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    try {
        const body = await req.json();
        const { title, message, hostId: bodyHostId } = body;
        const hostId = ctx.hostId || bodyHostId;

        if (!hostId || !title || !message) return fail("title and message are required", 400);

        return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/broadcast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                senderId: hostId,
                senderRole: "host",
                title,
                body: message,
                type: "host_broadcast",
                targetAudience: "followers",
            }),
        });
    } catch (error: any) {
        console.error("[Host Broadcast API] Error:", error);
        return fail("Failed to send broadcast");
    }
}

/**
 * GET /api/host/broadcast?hostId=XXX
 * Returns broadcast history for the host
 */
export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const hostId = ctx.hostId;

    return proxyToGateway(
        req,
        `${GATEWAY_URL}/api/v1/notifications/broadcast?senderId=${hostId}&senderRole=host`,
        {}
    );
}

/**
 * THE C1RCLE - Host Broadcast API (BFF Proxy)
 * Sends push notifications to all host followers via API Gateway
 * Gateway handles FCM delivery and notification storage
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function gatewayRequest(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

/**
 * POST /api/host/broadcast
 * Body: { hostId, title, message }
 */
export const POST = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    try {
        const body = await req.json();
        const { hostId, title, message } = body;

        if (!hostId || !title || !message) return fail("hostId, title, and message are required", 400);

        return gatewayRequest(`${GATEWAY_URL}/api/v1/notifications/broadcast`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: req.headers.get("Authorization") || ""
            },
            body: JSON.stringify({
                senderId: hostId,
                senderRole: "host",
                title,
                body: message,
                type: "host_broadcast",
                targetAudience: "followers"
            })
        });
    } catch (error: any) {
        console.error("[Host Broadcast API] Error:", error);
        return fail("Failed to send broadcast");
    }
});

/**
 * GET /api/host/broadcast?hostId=XXX
 * Returns broadcast history for the host
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId");
    if (!hostId) return fail("hostId is required", 400);

    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/notifications/broadcast?senderId=${hostId}&senderRole=host`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
});

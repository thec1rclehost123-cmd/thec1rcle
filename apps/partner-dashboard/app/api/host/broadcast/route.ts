/**
 * THE C1RCLE - Host Broadcast API (BFF Proxy)
 * Sends push notifications to all host followers via API Gateway
 * Gateway handles FCM delivery and notification storage
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function gatewayRequest(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

/**
 * POST /api/host/broadcast
 * Body: { hostId, title, message }
 * Gateway sends FCM to all followers' devices + stores notification in Firestore
 */
export async function POST(req: NextRequest) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { hostId, title, message } = body;

        if (!hostId || !title || !message) {
            return NextResponse.json(
                { error: "hostId, title, and message are required" },
                { status: 400 }
            );
        }

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/host/broadcast?hostId=XXX
 * Returns broadcast history for the host
 */
export async function GET(req: NextRequest) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId");

    if (!hostId) {
        return NextResponse.json({ error: "hostId is required" }, { status: 400 });
    }

    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/notifications/broadcast?senderId=${hostId}&senderRole=host`,
        {
            headers: {
                Authorization: req.headers.get("Authorization") || ""
            }
        }
    );
}

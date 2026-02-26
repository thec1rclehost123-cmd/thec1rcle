/**
 * THE C1RCLE - Send Venue Notification API (BFF Proxy)
 * Delegates push notification sending to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/venue/notifications/send
 * Sends a push notification to all followers of a venue
 */
export async function POST(req: NextRequest) {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const res = await fetch(`${GATEWAY_URL}/api/v1/notifications/send`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

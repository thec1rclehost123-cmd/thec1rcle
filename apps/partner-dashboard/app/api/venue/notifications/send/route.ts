/**
 * THE C1RCLE - Send Venue Notification API (BFF Proxy)
 * Delegates push notification sending to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/venue/notifications/send
 * Sends a push notification to all followers of a venue
 */
export const POST = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);

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
});

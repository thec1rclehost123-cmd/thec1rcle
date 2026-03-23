/**
 * THE C1RCLE - Venue Notifications API (BFF Proxy)
 * Delegates to API Gateway for aggregated notification feed
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function gatewayRequest(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

/**
 * GET /api/venue/notifications?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return ok({ notifications: [] });
    const { searchParams } = new URL(req.url);
    try {
        return await gatewayRequest(
            `${GATEWAY_URL}/api/v1/notifications?${searchParams.toString()}`,
            { headers: { Authorization: req.headers.get("Authorization") || "" } }
        );
    } catch {
        return ok({ notifications: [] });
    }
});

/**
 * PATCH /api/venue/notifications
 * Mark notification(s) as read or perform quick actions
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const body = await req.json();
    try {
        return await gatewayRequest(`${GATEWAY_URL}/api/v1/notifications/read`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
            body: JSON.stringify(body)
        });
    } catch {
        return fail("Service unavailable", 503);
    }
});

/**
 * POST /api/venue/notifications
 * Perform a quick action on a notification
 */
export const POST = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const body = await req.json();
    try {
        return await gatewayRequest(`${GATEWAY_URL}/api/v1/notifications/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
            body: JSON.stringify(body)
        });
    } catch {
        return fail("Service unavailable", 503);
    }
});

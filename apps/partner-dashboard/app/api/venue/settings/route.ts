/**
 * THE C1RCLE - Venue Settings API (BFF Proxy)
 * Delegates to API Gateway for venue configuration
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
 * GET /api/venue/settings?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const { searchParams } = new URL(req.url);
    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/venue-settings/venue?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
});

/**
 * PATCH /api/venue/settings
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const body = await req.json();
    return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/venue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify(body)
    });
});

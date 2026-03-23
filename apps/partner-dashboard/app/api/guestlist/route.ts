/**
 * THE C1RCLE - Guest List API (BFF Proxy)
 * Delegates to API Gateway for guest list management
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/guestlist?eventId=XXX
 * Get guest list for an event
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);

    const { searchParams } = new URL(req.url);
    const res = await fetch(
        `${GATEWAY_URL}/api/v1/scan/guestlist?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
});

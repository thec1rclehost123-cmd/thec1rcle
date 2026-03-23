/**
 * THE C1RCLE - Host Overview API (BFF Proxy)
 * Delegates to API Gateway for host dashboard summary
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/host/overview?hostId=XXX
 * Fetches summary statistics and recent events for a host
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);

    const { searchParams } = new URL(req.url);
    const res = await fetch(`${GATEWAY_URL}/api/v1/venue-settings/host/overview?${searchParams.toString()}`, {
        headers: { Authorization: req.headers.get("Authorization") || "" }
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
});

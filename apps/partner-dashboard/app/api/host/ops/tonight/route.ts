/**
 * THE C1RCLE - Host Ops Tonight API (BFF Proxy)
 * Delegates to API Gateway for current night's event stats
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/host/ops/tonight?hostId=XXX
 * Returns real-time entry stats for the host's active event today
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

/**
 * THE C1RCLE - Door Entry API (BFF Proxy)
 * Delegates walk-up door entry creation to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/door-entry
 * Create a door entry (walk-up sale + instant scan)
 */
export const POST = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) {
        return fail("Service unavailable", 503);
    }

    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/door-entry`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
});

/**
 * GET /api/door-entry?eventId=XXX
 * Get door entry stats for an event
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) {
        return fail("Service unavailable", 503);
    }

    const { searchParams } = new URL(req.url);
    return proxyToGateway(
        req,
        `${GATEWAY_URL}/api/v1/scan/door-entry?${searchParams.toString()}`,
        {}
    );
});

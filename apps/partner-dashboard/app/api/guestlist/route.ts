/**
 * THE C1RCLE - Guest List API (BFF Proxy)
 * Delegates to API Gateway for guest list management
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/guestlist?eventId=XXX
 * Get guest list for an event
 */
export const GET = withAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/guestlist?${searchParams.toString()}`, {});
});


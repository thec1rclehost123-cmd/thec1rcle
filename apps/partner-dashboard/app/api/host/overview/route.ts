/**
 * THE C1RCLE - Host Overview API (BFF Proxy)
 * Delegates to API Gateway for host dashboard summary
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/host/overview?hostId=XXX
 * Fetches summary statistics and recent events for a host
 */
export const GET = withAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/host/overview?${searchParams.toString()}`, {});
});


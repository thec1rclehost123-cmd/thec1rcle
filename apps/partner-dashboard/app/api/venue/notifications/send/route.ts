/**
 * THE C1RCLE - Send Venue Notification API (BFF Proxy)
 * Delegates push notification sending to the API Gateway
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/venue/notifications/send
 * Sends a push notification to all followers of a venue
 */
export const POST = withAuth(async (req: NextRequest) => {
    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/send`, {
        method: "POST",
        body: JSON.stringify(body)
    });
});


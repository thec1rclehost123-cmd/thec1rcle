/**
 * THE C1RCLE - Venue Notifications API (BFF Proxy)
 * Delegates to API Gateway for aggregated notification feed
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { tryProxyToGateway, proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { ok } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/notifications?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    const data = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications?${new URL(req.url).searchParams.toString()}`, {});
    return ok({ notifications: data?.notifications || [] });
});

/**
 * PATCH /api/venue/notifications
 * Mark notification(s) as read or perform quick actions
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/read`, {
        method: "PATCH",
        body: JSON.stringify(body)
    });
});

/**
 * POST /api/venue/notifications
 * Perform a quick action on a notification
 */
export const POST = withAuth(async (req: NextRequest) => {
    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/notifications/action`, {
        method: "POST",
        body: JSON.stringify(body)
    });
});


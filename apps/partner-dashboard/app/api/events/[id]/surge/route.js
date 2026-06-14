/**
 * THE C1RCLE - Surge Pricing API (BFF Proxy)
 * Delegates event surge control to the API Gateway
 */
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/events/[id]/surge
 * Get surge status and analytics for an event
 */
export async function GET(request, { params }) {
    const { id: eventId } = await params;
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/events/${eventId}/surge`, {});
}

/**
 * POST /api/events/[id]/surge
 * Toggle surge or admit users
 */
export async function POST(request, { params }) {
    const { id: eventId } = await params;
    const body = await request.json();
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/events/${eventId}/surge`, {
        method: "POST",
        body: JSON.stringify(body)
    });
}


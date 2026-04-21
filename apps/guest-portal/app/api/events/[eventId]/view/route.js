import { proxyGatewayJson } from "../../../../../lib/server/gatewayBridge.js";

export async function POST(request, { params }) {
    const { eventId } = await params;
    return proxyGatewayJson(request, `/events/${encodeURIComponent(eventId)}/view`, {
        method: "POST",
        requireAuth: false,
        body: {},
    });
}

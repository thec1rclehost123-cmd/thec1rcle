import { proxyGatewayJson } from "../../../../../lib/server/gatewayBridge.js";

export async function GET(request, { params }) {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const path = `/events/${encodeURIComponent(eventId)}/queue${query ? `?${query}` : ""}`;
    return proxyGatewayJson(request, path, {
        method: "GET",
        requireAuth: false,
    });
}

export async function POST(request, { params }) {
    const { eventId } = await params;
    return proxyGatewayJson(request, `/events/${encodeURIComponent(eventId)}/queue`, {
        method: "POST",
        requireAuth: false,
    });
}

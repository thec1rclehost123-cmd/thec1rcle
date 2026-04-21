import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function GET(request, { params }) {
    const { orderId } = await params;
    return proxyGatewayJson(request, `/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "GET",
        requireAuth: true,
    });
}

export async function POST(request, { params }) {
    const { orderId } = await params;
    return proxyGatewayJson(request, `/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        requireAuth: true,
    });
}

import { proxyGatewayJson } from "@/lib/server/gatewayBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const suffix = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";

    return proxyGatewayJson(request, `/tickets/share${suffix}`, {
        requireAuth: true,
    });
}

export async function POST(request) {
    return proxyGatewayJson(request, "/tickets/share", {
        requireAuth: true,
    });
}

export async function DELETE(request) {
    return proxyGatewayJson(request, "/tickets/share", {
        requireAuth: true,
    });
}

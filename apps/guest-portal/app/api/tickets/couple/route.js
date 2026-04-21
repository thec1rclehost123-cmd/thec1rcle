import { proxyGatewayJson } from "@/lib/server/gatewayBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const bundleId = searchParams.get("bundleId");
    const suffix = bundleId ? `?bundleId=${encodeURIComponent(bundleId)}` : "";

    return proxyGatewayJson(request, `/tickets/pair${suffix}`, {
        requireAuth: true,
    });
}

export async function DELETE(request) {
    return proxyGatewayJson(request, "/tickets/pair", {
        requireAuth: true,
    });
}

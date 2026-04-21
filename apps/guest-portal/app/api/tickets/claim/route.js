import { proxyGatewayJson } from "@/lib/server/gatewayBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const suffix = token ? `?token=${encodeURIComponent(token)}` : "";

    return proxyGatewayJson(request, `/tickets/claim${suffix}`, {
        requireAuth: false,
    });
}

export async function POST(request) {
    return proxyGatewayJson(request, "/tickets/claim/share", {
        requireAuth: true,
    });
}

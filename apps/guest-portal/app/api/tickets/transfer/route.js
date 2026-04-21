import { proxyGatewayJson } from "@/lib/server/gatewayBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const suffix = code ? `?code=${encodeURIComponent(code)}` : "";

    return proxyGatewayJson(request, `/transfer${suffix}`, {
        requireAuth: false,
    });
}

export async function POST(request) {
    return proxyGatewayJson(request, "/tickets/transfer", {
        requireAuth: true,
    });
}

export async function PATCH(request) {
    return proxyGatewayJson(request, "/tickets/transfer", {
        requireAuth: true,
    });
}

export async function DELETE(request) {
    return proxyGatewayJson(request, "/tickets/transfer", {
        requireAuth: true,
    });
}

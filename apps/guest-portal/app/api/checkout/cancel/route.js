import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(request) {
    return proxyGatewayJson(request, "/checkout/cancel", {
        method: "POST",
        requireAuth: true,
    });
}

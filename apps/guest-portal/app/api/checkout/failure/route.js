import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(request) {
    return proxyGatewayJson(request, "/checkout/failure", {
        method: "POST",
    });
}

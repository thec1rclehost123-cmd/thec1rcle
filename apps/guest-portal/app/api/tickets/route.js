import { proxyGatewayJson } from "../../../lib/server/gatewayBridge.js";

export async function GET(request) {
    return proxyGatewayJson(request, "/tickets", {
        requireAuth: true,
    });
}

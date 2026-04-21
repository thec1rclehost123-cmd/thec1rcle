import { proxyGatewayJson } from "@/lib/server/gatewayBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
    return proxyGatewayJson(request, "/tickets/transfer/pending", {
        requireAuth: true,
    });
}

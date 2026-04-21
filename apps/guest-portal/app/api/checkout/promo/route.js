import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export const dynamic = "force-dynamic";

export async function POST(request) {
    return proxyGatewayJson(request, "/checkout/promo", {
        method: "POST",
    });
}

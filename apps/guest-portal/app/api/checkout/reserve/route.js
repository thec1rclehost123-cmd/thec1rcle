import { proxyGatewayJson } from "@/lib/server/gatewayBridge";
import { withRateLimit } from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

async function handler(request) {
    return proxyGatewayJson(request, "/checkout/reserve", {
        method: "POST",
        requireAuth: true,
    });
}

export const POST = withRateLimit(handler, 10);

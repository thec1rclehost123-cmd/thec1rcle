import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { withRateLimit } from "@/lib/server/rateLimit";

async function handler(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/reservations`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

// 5 reservation attempts per minute per IP
export const POST = withRateLimit(handler, 5);

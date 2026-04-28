import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest) {
    const body = await req.text();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/payments/payout-webhook`, {
        method: "POST",
        body,
    });
}

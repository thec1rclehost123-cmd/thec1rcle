import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const { search } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/kyc${search}`, {});
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/kyc`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

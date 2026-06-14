import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/profile`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/profile`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

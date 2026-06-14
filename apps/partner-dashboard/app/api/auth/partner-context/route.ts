import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/partner-context`, {});
}

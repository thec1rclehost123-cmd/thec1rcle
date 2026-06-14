import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { withAuth } from "@/lib/server/withAuth";

export const POST = withAuth(async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/kyc/verify-aadhaar`, {
        method: "POST",
        body: JSON.stringify(body),
    });
});

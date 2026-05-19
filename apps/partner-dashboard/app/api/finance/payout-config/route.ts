import { NextRequest, NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    const decoded = await verifyAuth(req);
    if (!decoded) {
        return NextResponse.json(
            { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: req.headers.get("x-request-id") || crypto.randomUUID() } },
            { status: 401 }
        );
    }
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/finance/payout-config`, {});
}

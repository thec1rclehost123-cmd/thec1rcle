import { NextRequest, NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    const decoded = await verifyAuth(req);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/debug/venue-events`, {});
}

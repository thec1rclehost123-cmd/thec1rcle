import { NextRequest, NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { verifyAuth } from "@/lib/server/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const decoded = await verifyAuth(req);
    if (!decoded) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/${id}/repair`, { method: "POST" });
}

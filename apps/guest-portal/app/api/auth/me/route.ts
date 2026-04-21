import { NextRequest, NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        return await proxyGatewayJson(req, "/auth/me", {
            method: "GET",
            requireAuth: true,
        });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

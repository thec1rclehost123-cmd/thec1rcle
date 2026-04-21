import { NextRequest, NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(req: NextRequest) {
    try {
        return await proxyGatewayJson(req, "/auth/onboard", {
            method: "POST",
            requireAuth: true,
        });
    } catch (error: any) {
        console.error("[Auth API] POST /onboard Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

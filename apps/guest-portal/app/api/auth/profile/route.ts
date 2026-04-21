import { NextRequest, NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(req: NextRequest) {
    try {
        return await proxyGatewayJson(req, "/users/profile", {
            method: "POST",
            requireAuth: true,
        });
    } catch (error: any) {
        console.error("[Auth API] POST /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        return await proxyGatewayJson(req, "/profiles", {
            method: "PATCH",
            requireAuth: true,
        });
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

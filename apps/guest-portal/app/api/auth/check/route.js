import { NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(req) {
    try {
        return await proxyGatewayJson(req, "/auth/check", {
            method: "POST",
            requireAuth: false,
            allowSessionCookie: false,
        });
    } catch (err) {
        console.error("Auth check error:", err);
        return NextResponse.json({ error: "Check protocol failed" }, { status: 500 });
    }
}

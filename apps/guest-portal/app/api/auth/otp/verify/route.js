import { NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(req) {
    try {
        return await proxyGatewayJson(req, "/auth/otp/verify", {
            method: "POST",
            requireAuth: false,
            allowSessionCookie: false,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message || "Protocol mismatch." }, { status: 400 });
    }
}

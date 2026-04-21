import { NextResponse } from "next/server";
import { proxyGatewayJson } from "@/lib/server/gatewayBridge";

export async function POST(req) {
    try {
        return await proxyGatewayJson(req, "/auth/otp/send", {
            method: "POST",
            requireAuth: false,
            allowSessionCookie: false,
        });
    } catch (err) {
        const errorMessage = err?.message || "An unexpected error occurred during OTP dispatch.";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

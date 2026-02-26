/**
 * THE C1RCLE - Scanner Auth API (BFF Proxy)
 * Delegates to API Gateway for event code validation and management
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function gatewayRequest(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

/**
 * POST /api/scan/auth
 * Validate an event code (called from Scanner App — no user auth required)
 */
export async function POST(req: NextRequest) {
    if (!GATEWAY_URL) {
        return NextResponse.json({ valid: false, error: "Service unavailable" }, { status: 503 });
    }
    const body = await req.json();
    return gatewayRequest(`${GATEWAY_URL}/api/v1/scan/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

/**
 * GET /api/scan/auth?eventId=XXX
 * List event codes for an event (requires auth)
 */
export async function GET(req: NextRequest) {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/scan/auth?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
}

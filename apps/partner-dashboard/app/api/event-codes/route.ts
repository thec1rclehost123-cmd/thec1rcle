/**
 * THE C1RCLE - Event Codes API (BFF Proxy)
 * Delegates to API Gateway for scanner code management
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
 * GET /api/event-codes?eventId=XXX
 */
export async function GET(req: NextRequest) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/scan/codes?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
}

/**
 * POST /api/event-codes
 * Create a new scanner access code
 */
export async function POST(req: NextRequest) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    return gatewayRequest(`${GATEWAY_URL}/api/v1/scan/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ ...body, createdBy: { uid: auth.uid, name: (auth as any).name || (auth as any).email } })
    });
}

/**
 * DELETE /api/event-codes?id=XXX
 * Revoke a scanner access code
 */
export async function DELETE(req: NextRequest) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const codeId = searchParams.get("id");
    if (!codeId) return NextResponse.json({ error: "id required" }, { status: 400 });

    return gatewayRequest(`${GATEWAY_URL}/api/v1/scan/codes/${codeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ revokedBy: { uid: auth.uid, name: (auth as any).name || (auth as any).email } })
    });
}

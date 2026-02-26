/**
 * THE C1RCLE - Scanner Stats API (BFF Proxy)
 * Delegates to API Gateway for real-time scan statistics
 */
import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/scan/stats?code=C1R-XXXXXX
 */
export async function GET(req: NextRequest) {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const res = await fetch(`${GATEWAY_URL}/api/v1/scan/stats?${searchParams.toString()}`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

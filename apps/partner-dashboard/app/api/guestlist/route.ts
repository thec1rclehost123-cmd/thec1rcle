/**
 * THE C1RCLE - Guest List API (BFF Proxy)
 * Delegates to API Gateway for guest list management
 */
import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/guestlist?eventId=XXX
 * Get guest list for an event (called from scanner app)
 */
export async function GET(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const res = await fetch(`${GATEWAY_URL}/api/v1/scan/guestlist?${searchParams.toString()}`);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

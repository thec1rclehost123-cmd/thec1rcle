/**
 * THE C1RCLE - Door Entry API (BFF Proxy)
 * Delegates walk-up door entry creation to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/door-entry
 * Create a door entry (walk-up sale + instant scan)
 */
export async function POST(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }
  const body = await req.json();
  const res = await fetch(`${GATEWAY_URL}/api/v1/scan/door-entry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

/**
 * GET /api/door-entry?eventId=XXX
 * Get door entry stats for an event
 */
export async function GET(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const res = await fetch(`${GATEWAY_URL}/api/v1/scan/door-entry?${searchParams.toString()}`);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

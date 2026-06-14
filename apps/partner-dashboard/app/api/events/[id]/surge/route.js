/**
 * THE C1RCLE - Surge Pricing API (BFF Proxy)
 * Delegates event surge control to the API Gateway
 */
import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * GET /api/events/[id]/surge
 * Get surge status and analytics for an event
 */
export async function GET(request, { params }) {
  if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { id: eventId } = params;
  const res = await fetch(`${GATEWAY_URL}/api/v1/events/${eventId}/surge`, {
    headers: { Authorization: request.headers.get("Authorization") || "" },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

/**
 * POST /api/events/[id]/surge
 * Toggle surge or admit users
 */
export async function POST(request, { params }) {
  if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { id: eventId } = params;
  const body = await request.json();
  const res = await fetch(`${GATEWAY_URL}/api/v1/events/${eventId}/surge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: request.headers.get("Authorization") || "",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

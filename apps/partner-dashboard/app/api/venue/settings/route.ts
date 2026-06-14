/**
 * THE C1RCLE - Venue Settings API (BFF Proxy)
 * Delegates to API Gateway for venue configuration
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
 * GET /api/venue/settings?venueId=XXX
 */
export async function GET(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/venue?${searchParams.toString()}`, {
    headers: { Authorization: req.headers.get("Authorization") || "" },
  });
}

/**
 * PATCH /api/venue/settings
 */
export async function PATCH(req: NextRequest) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/venue`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
    },
    body: JSON.stringify(body),
  });
}

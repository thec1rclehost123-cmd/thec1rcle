/**
 * THE C1RCLE - Host Settings API (BFF Proxy)
 * Delegates to API Gateway for host configuration
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
 * GET /api/host/settings?hostId=XXX
 */
export async function GET(req: NextRequest) {
  if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/host?${searchParams.toString()}`, {
    headers: { Authorization: req.headers.get("Authorization") || "" },
  });
}

/**
 * POST /api/host/settings
 * Update host settings
 */
export async function POST(req: NextRequest) {
  if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/host`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
    },
    body: JSON.stringify(body),
  });
}

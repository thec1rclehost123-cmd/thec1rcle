/**
 * THE C1RCLE - Promoter Link Click API (BFF Proxy)
 * Delegates click tracking to the API Gateway
 */
import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link
 */
export async function POST(req) {
  if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const body = await req.json();
  const res = await fetch(`${GATEWAY_URL}/api/v1/promoter-connections/links/click`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

/**
 * THE C1RCLE - Single Reservation API (BFF Proxy)
 * Delegates to API Gateway for individual reservation updates
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * PATCH /api/venue/reservations/[id]
 * Update a reservation status (approve / reject / cancel)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!GATEWAY_URL) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const res = await fetch(`${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

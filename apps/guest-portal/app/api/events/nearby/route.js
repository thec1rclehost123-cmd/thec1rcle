/**
 * THE C1RCLE - Nearby Events API (BFF Proxy)
 * Delegates geo-distance event query to API Gateway
 */
import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/nearby?lat=XX&lng=XX&radius=50&limit=20
 * Returns events within a given radius sorted by distance
 */
export async function GET(request) {
  if (!GATEWAY_URL) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const res = await fetch(`${GATEWAY_URL}/api/v1/events/nearby?${searchParams.toString()}`, {
    headers: { Authorization: request.headers.get('Authorization') || '' },
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

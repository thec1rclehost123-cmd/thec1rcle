/**
 * THE C1RCLE - Reservations API (BFF Proxy)
 * Delegates to API Gateway for reservation management
 */
import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/reservations
 * Create a new reservation request
 */
export async function POST(request) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const body = await request.json();
    const res = await fetch(`${GATEWAY_URL}/api/v1/venue-settings/venue/reservations`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": request.headers.get("Authorization") || ""
        },
        body: JSON.stringify(body)
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

/**
 * GET /api/reservations?venueId=xxx&status=pending
 * List reservations for a venue
 */
export async function GET(request) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const { searchParams } = new URL(request.url);
    const res = await fetch(`${GATEWAY_URL}/api/v1/venue-settings/venue/reservations?${searchParams.toString()}`, {
        headers: { "Authorization": request.headers.get("Authorization") || "" }
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}

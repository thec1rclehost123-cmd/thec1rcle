/**
 * THE C1RCLE - Venue Reservations API (BFF Proxy)
 * Delegates to API Gateway for table reservation management
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function gatewayRequest(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}

/**
 * GET /api/venue/reservations?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const { searchParams } = new URL(req.url);
    return gatewayRequest(
        `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
});

/**
 * PATCH /api/venue/reservations
 * Update reservation status
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const body = await req.json();
    const { reservationId, ...updates } = body;
    if (!reservationId) return fail("reservationId required", 400);

    return gatewayRequest(`${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify(updates)
    });
});

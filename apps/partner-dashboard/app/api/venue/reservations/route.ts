/**
 * THE C1RCLE - Venue Reservations API (BFF Proxy)
 * Delegates to API Gateway for table reservation management
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/reservations?venueId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations?${new URL(req.url).searchParams.toString()}`, {});
});

/**
 * PATCH /api/venue/reservations
 * Update reservation status
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    const body = await req.json();
    const { reservationId, ...updates } = body;
    if (!reservationId) return fail("reservationId required", 400);

    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${reservationId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
    });
});


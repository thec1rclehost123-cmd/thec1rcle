/**
 * THE C1RCLE - Single Reservation API (BFF Proxy)
 * Delegates to API Gateway for individual reservation updates
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * PATCH /api/venue/reservations/[id]
 * Update a reservation status (approve / reject / cancel)
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);

    const id = ctx?.params?.id || "";
    const body = await req.json();

    const res = await fetch(`${GATEWAY_URL}/api/v1/venue-settings/venue/reservations/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || ""
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
});

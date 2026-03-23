/**
 * THE C1RCLE - Door Entry API (BFF Proxy)
 * Delegates walk-up door entry creation to the API Gateway
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/door-entry
 * Create a door entry (walk-up sale + instant scan)
 */
export const POST = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) {
        return fail("Service unavailable", 503);
    }

    const body = await req.json();
    const res = await fetch(`${GATEWAY_URL}/api/v1/scan/door-entry`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.get("Authorization") || "",
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
});

/**
 * GET /api/door-entry?eventId=XXX
 * Get door entry stats for an event
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) {
        return fail("Service unavailable", 503);
    }

    const { searchParams } = new URL(req.url);
    const res = await fetch(
        `${GATEWAY_URL}/api/v1/scan/door-entry?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
});

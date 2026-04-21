/**
 * THE C1RCLE - Nearby Events API (BFF Proxy)
 * Delegates geo-distance event query to API Gateway
 */
import { NextResponse } from "next/server";
import { getGatewayBaseUrl } from "../../../../lib/server/gatewayBridge.js";

export const revalidate = 60;

/**
 * GET /api/events/nearby?lat=XX&lng=XX&radius=50&limit=20
 * Returns events within a given radius sorted by distance
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const res = await fetch(`${getGatewayBaseUrl()}/events/nearby?${searchParams.toString()}`, {
            headers: {
                Authorization: request.headers.get("Authorization") || "",
                "x-request-id": request.headers.get("x-request-id") || "",
            },
        });
        return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    } catch (error) {
        console.error("GET /api/events/nearby bridge error", error);
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
}

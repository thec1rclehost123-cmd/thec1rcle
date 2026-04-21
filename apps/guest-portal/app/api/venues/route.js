import { NextResponse } from "next/server";
import { adaptVenueList, fetchPublicVenues } from "../../../lib/server/publicDiscoveryBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const data = await fetchPublicVenues(Object.fromEntries(searchParams.entries()), {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        return NextResponse.json(adaptVenueList(data), {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        });
    } catch (error) {
        console.error("GET /api/venues bridge error", error);
        return NextResponse.json({ error: "Failed to load venues" }, { status: 500 });
    }
}

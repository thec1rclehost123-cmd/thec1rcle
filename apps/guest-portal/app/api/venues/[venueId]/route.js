import { NextResponse } from "next/server";
import { fetchPublicVenue } from "../../../../lib/server/publicDiscoveryBridge.js";

export async function GET(request, { params }) {
    try {
        const { venueId } = await params;
        const data = await fetchPublicVenue(venueId, {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        if (!data) {
            return NextResponse.json({ error: "Venue not found" }, { status: 404 });
        }

        return NextResponse.json(data.venue || data, {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        });
    } catch (error) {
        console.error("GET /api/venues/[venueId] bridge error", error);
        return NextResponse.json({ error: "Failed to load venue" }, { status: 500 });
    }
}

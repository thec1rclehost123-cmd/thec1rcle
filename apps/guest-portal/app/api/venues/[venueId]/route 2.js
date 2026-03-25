import { NextResponse } from "next/server";
import { getVenueBySlug } from "@/lib/server/venueStore";

export async function GET(request, { params }) {
    try {
        const { venueId } = params;
        const venue = await getVenueBySlug(venueId);

        if (!venue) {
            return NextResponse.json({ error: "Venue not found" }, { status: 404 });
        }

        return NextResponse.json(venue, {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" }
        });
    } catch (error) {
        console.error("GET /api/venues/[venueId] error", error);
        return NextResponse.json({ error: "Failed to load venue" }, { status: 500 });
    }
}

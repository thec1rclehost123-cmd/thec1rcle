import { NextResponse } from "next/server";
import { getVenueBySlug } from "@/lib/server/venueStore";
import { isPublicProfileEnabled } from "@/lib/server/publicProfile";

export async function GET(request, { params }) {
    try {
        const { venueId } = await params;
        const venue = await getVenueBySlug(venueId);

        if (!venue || !isPublicProfileEnabled(venue)) {
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

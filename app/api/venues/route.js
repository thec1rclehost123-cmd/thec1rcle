import { NextResponse } from "next/server";
import { listVenues } from "../../../lib/server/venueStore";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const area = searchParams.get("area");
        const vibe = searchParams.get("vibe");
        const search = searchParams.get("search");
        const tablesOnly = searchParams.get("tablesOnly") === "true";

        const venues = await listVenues({ area, vibe, search, tablesOnly });
        return NextResponse.json(venues);
    } catch (error) {
        console.error("GET /api/venues error", error);
        return NextResponse.json({ error: "Failed to load venues" }, { status: 500 });
    }
}

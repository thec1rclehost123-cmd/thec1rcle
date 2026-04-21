import { NextResponse } from "next/server";
import { fetchPublicEvent } from "../../../../lib/server/publicDiscoveryBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
    try {
        const { eventId } = await params;
        const data = await fetchPublicEvent(decodeURIComponent(eventId), {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        if (!data) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        return NextResponse.json(data, {
            headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
        });
    } catch (error) {
        console.error("GET /api/events/[eventId] bridge error", error);
        return NextResponse.json({ error: "Failed to load event." }, { status: 500 });
    }
}

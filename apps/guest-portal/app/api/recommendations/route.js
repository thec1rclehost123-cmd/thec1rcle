
import { NextResponse } from "next/server";
import { getRecommendedEvents, getSimilarEvents } from "../../../lib/server/recommendations";
import { verifyAuth } from "../../../lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") || "personal"; // 'personal' or 'similar'
        const eventId = searchParams.get("eventId");
        const limit = Number(searchParams.get("limit")) || 5;

        if (type === "similar") {
            if (!eventId) {
                return NextResponse.json({ error: "Event ID required for similar recommendations" }, { status: 400 });
            }
            const events = await getSimilarEvents(eventId, limit);
            return NextResponse.json(events);
        }

        // Personal recommendations
        const decodedToken = await verifyAuth(request);
        const userId = decodedToken?.uid;

        const events = await getRecommendedEvents(userId, limit);
        return NextResponse.json(events);

    } catch (error) {
        console.error("Recommendation API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

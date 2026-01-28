
import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebase/admin";
import { PUBLIC_LIFECYCLE_STATES, mapEventForClient } from "@c1rcle/core/events";

// Initial simple implementation of Haversine distance
// Future: Move to @c1rcle/core/utils if used in multiple places
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get("lat"));
        const lng = parseFloat(searchParams.get("lng"));
        const radius = parseFloat(searchParams.get("radius") || "50"); // Default 50km
        const limit = parseInt(searchParams.get("limit") || "20");

        if (isNaN(lat) || isNaN(lng)) {
            return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
        }

        const db = getAdminDb();
        const eventsRef = db.collection("events");
        const nowIso = new Date().toISOString();

        // fetch all active public events
        // Optimization: If dataset grows, use geohashes or bounding box queries
        const snapshot = await eventsRef
            .where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES)
            .where("endDate", ">=", nowIso)
            .get();

        const nearbyEvents = snapshot.docs
            .map(doc => {
                const data = doc.data();
                const event = mapEventForClient(data, doc.id);

                // Check if event has coordinates
                if (!event.coordinates || !event.coordinates.latitude || !event.coordinates.longitude) {
                    return null;
                }

                const dist = calculateDistance(
                    lat,
                    lng,
                    event.coordinates.latitude,
                    event.coordinates.longitude
                );

                return {
                    ...event,
                    distance: dist // Add distance to response so UI can show "2.5 km away"
                };
            })
            .filter(e => e !== null && e.distance <= radius)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        return NextResponse.json(nearbyEvents);

    } catch (error) {
        console.error("GET /api/events/nearby error:", error);
        return NextResponse.json(
            { error: "Failed to fetch nearby events" },
            { status: 500 }
        );
    }
}

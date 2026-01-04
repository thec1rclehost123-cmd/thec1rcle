import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase/client";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");

        if (!clubId) {
            return NextResponse.json({ error: "clubId is required" }, { status: 400 });
        }

        const db = getFirebaseDb();
        const eventsRef = collection(db, "events");

        // Fetch events for the club to determine blocked dates
        // Only fetch future events
        const q = query(
            eventsRef,
            where("venueId", "==", clubId),
            where("lifecycle", "in", ["approved", "scheduled", "live"])
        );

        const snapshot = await getDocs(q);

        // Map to blocked slots (minimal info)
        const blockedSlots = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                date: data.startDate?.toDate?.()?.toISOString() || data.startDate,
                startTime: data.startTime,
                endTime: data.endTime,
                // NO event name, NO host info, NO notes
                isBlocked: true
            };
        });

        // Also fetch general venue blocks if any (e.g. maintenance)
        // For now, just events.

        return NextResponse.json({ blockedSlots });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

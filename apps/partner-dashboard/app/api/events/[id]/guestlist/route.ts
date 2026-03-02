import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@c1rcle/core/admin";
import { getEvent } from "@/lib/server/eventStore";

/**
 * GET /api/events/[id]/guestlist
 * Returns the paginated guestlist for an event
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const eventId = params.id;
        const limitStr = req.nextUrl.searchParams.get('limit');
        const cursor = req.nextUrl.searchParams.get('cursor');
        const limit = limitStr ? parseInt(limitStr, 10) : 50;

        const event = await getEvent(eventId);
        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const db = getAdminDb();

        let ordersQuery = db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "in", ["confirmed", "checked_in"])
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (cursor) {
            const cursorDoc = await db.collection("orders").doc(cursor).get();
            if (cursorDoc.exists) {
                ordersQuery = ordersQuery.startAfter(cursorDoc);
            }
        }

        const ordersSnapshot = await ordersQuery.get();
        const nextCursor = ordersSnapshot.docs.length === limit ? ordersSnapshot.docs[ordersSnapshot.docs.length - 1].id : null;

        const buyerIds = Array.from(new Set(ordersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean)));

        // Fetch full profiles
        const profiles = await Promise.all(buyerIds.map(async (uid) => {
            const fresh = await db.collection("users").doc(uid).get();
            return fresh.exists ? { id: fresh.id, ...fresh.data() } : null;
        }));

        const guests = profiles.filter(Boolean).map(p => ({
            id: p?.id,
            name: p?.displayName || "C1RCLE Member",
            handle: p?.handle || `@${(p?.displayName || "guest").toLowerCase().replace(/\s/g, "")}`,
            photoURL: p?.photoURL || null,
            initials: (p?.displayName || "G").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
            stats: `${(p?.attendedEvents?.length || 0)} events attended`,
            status: "confirmed"
        }));

        return NextResponse.json({
            guestlist: guests,
            nextCursor,
            stats: {
                total: guests.length,
                pending: 0,
                confirmed: guests.length,
                checkedIn: 0
            }
        });
    } catch (error: any) {
        console.error("[GuestlistAPI] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

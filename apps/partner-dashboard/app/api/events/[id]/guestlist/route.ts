import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@c1rcle/core/admin";
import { getEvent } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

/**
 * GET /api/events/[id]/guestlist
 * Returns the paginated guestlist for an event
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const eventId = ctx?.params?.id as string;
        const limitStr = req.nextUrl.searchParams.get('limit');
        const cursor = req.nextUrl.searchParams.get('cursor');
        const limit = limitStr ? parseInt(limitStr, 10) : 50;

        const event = await getEvent(eventId);
        if (!event) return fail("Event not found", 404);

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

        // Fetch full profiles in a single batched RPC (max 500 docs)
        const refs = buyerIds.map(uid => db.collection("users").doc(uid));
        const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
        const profiles = snaps.map(snap => snap.exists ? { id: snap.id, ...snap.data() } : null);

        // Count checked-in orders separately
        const checkedInCount = ordersSnapshot.docs.filter(doc => doc.data().status === "checked_in").length;
        const confirmedCount = ordersSnapshot.docs.filter(doc => doc.data().status === "confirmed").length;

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
                confirmed: confirmedCount,
                checkedIn: checkedInCount
            }
        });
    } catch (error: any) {
        console.error("[GuestlistAPI] Error:", error);
        return fail("Failed to load guest list");
    }
});

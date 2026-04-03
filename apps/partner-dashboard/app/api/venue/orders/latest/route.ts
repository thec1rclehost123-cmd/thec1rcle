import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess, applyPIIMask } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/venue/orders/latest?venueId=&limit=20
 *
 * Returns the most recent orders from the latest_orders_feed read model.
 * This is a bounded, O(limit) query — never scans the full orders collection.
 *
 * The feed is populated by onOrderConfirmed() in the aggregation engine and
 * backfilled via POST /api/venue/aggregation/backfill.
 */
export async function GET(request: NextRequest) {
    const ctx = await requireVenueAccess(request, "guestlist:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(request.url);
        const limit   = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
        const { venueId, piiPolicy } = ctx;
        const db = getAdminDb();

        const snap = await db.collection("latest_orders_feed")
            .where("venueId", "==", venueId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        const orders = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id:           doc.id,
                orderId:      d.orderId as string,
                attendeeId:   (d.userId || d.orderId || doc.id) as string,
                customerName: d.customerName as string,
                eventId:      d.eventId as string,
                eventName:    d.eventName as string,
                amount:       Number(d.amount || 0) / 100,  // paise → rupees
                ticketsCount: Number(d.ticketsCount || 1),
                status:       d.status as string,
                source:       d.source as "ticket" | "rsvp",
                createdAt:    d.createdAt as string,
            };
        });

        const masked = applyPIIMask(orders, piiPolicy);

        return NextResponse.json({ orders: masked }, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });

    } catch (err: any) {
        console.error("[venue/orders/latest] Error:", err.message);
        return NextResponse.json({ error: "Failed to load latest orders" }, { status: 500 });
    }
}

/**
 * GET /api/host/events/[id]/overview
 * Aggregated metrics for a single event overview tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const eventId = params.id;
    const db = getAdminDb();

    try {
        // Verify event ownership
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Tickets sold via orders
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "completed")
            .get();

        let ticketsSold = 0;
        let grossRevenue = 0;
        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            ticketsSold += o.quantity || 1;
            grossRevenue += o.totalAmount || 0;
        }

        // Net estimated earnings
        const platformFee = grossRevenue * 0.1;
        const venueCommission = grossRevenue * (ev.venueCommissionRate || 0.15);
        const estimatedEarnings = grossRevenue - platformFee - venueCommission;

        // Guest list size
        const glSnap = await db.collection("guest_lists")
            .where("eventId", "==", eventId)
            .get();
        const guestListSize = glSnap.size;

        // Top promoter from assignments
        const assignSnap = await db.collection("promoter_assignments")
            .where("eventId", "==", eventId)
            .orderBy("totalRevenue", "desc")
            .limit(1)
            .get();
        const topPromoter = assignSnap.empty ? null : (() => {
            const d = assignSnap.docs[0].data();
            return { name: d.promoterName || "Promoter", sales: d.totalSales || 0, revenue: d.totalRevenue || 0 };
        })();

        return NextResponse.json({
            ticketsSold,
            estimatedEarnings: Math.round(estimatedEarnings),
            guestListSize,
            topPromoter,
        });
    } catch (err: any) {
        console.error("[events/[id]/overview]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

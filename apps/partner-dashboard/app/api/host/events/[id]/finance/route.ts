/**
 * GET /api/host/events/[id]/finance
 * OWNER-only: event-level financial breakdown for host.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await requireFinanceAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const eventId = params.id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Aggregate orders
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "completed")
            .get();

        let gross = 0;
        let refundAmount = 0;

        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            gross += o.totalAmount || 0;
        }

        // Refunds from orders with status === "refunded"
        const refundSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "refunded")
            .get();
        for (const doc of refundSnap.docs) {
            refundAmount += doc.data().totalAmount || 0;
        }

        const platformFee = gross * 0.1;
        const venueCommissionRate = ev.venueCommissionRate || 0.15;
        const venueCommission = gross * venueCommissionRate;
        const net = gross - platformFee - venueCommission - refundAmount;

        // Check host_earnings doc for settled status
        const earningsSnap = await db.collection("host_earnings")
            .where("eventId", "==", eventId)
            .where("hostId", "==", hostId)
            .limit(1)
            .get();

        const earningsDoc = earningsSnap.empty ? null : earningsSnap.docs[0].data();
        const settlementStatus = earningsDoc?.status || (ev.lifecycle === "completed" ? "pending" : "not_settled");
        const paidAt = earningsDoc?.paidAt || null;

        return NextResponse.json({
            gross: Math.round(gross),
            platformFee: Math.round(platformFee),
            venueCommission: Math.round(venueCommission),
            venueCommissionRate,
            refundAmount: Math.round(refundAmount),
            net: Math.round(net),
            settlementStatus,
            paidAt,
        });
    } catch (err: any) {
        console.error("[events/[id]/finance]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

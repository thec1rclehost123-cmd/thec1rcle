/**
 * GET /api/host/events/[id]/tickets
 * Returns ticket tier breakdown and sales summary for a host event.
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
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const tiers: any[] = ev.ticketTiers || ev.tiers || [];

        // Count sales per tier from orders
        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "completed")
            .get();

        const tierSales: Record<string, number> = {};
        let totalSold = 0;
        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            const tierId = o.tierId || o.ticketTierId || "general";
            tierSales[tierId] = (tierSales[tierId] || 0) + (o.quantity || 1);
            totalSold += o.quantity || 1;
        }

        const tiersWithSales = tiers.map((t: any) => ({
            id: t.id || t.name,
            name: t.name || "General",
            price: t.price || 0,
            quantity: t.quantity || t.maxQuantity || 0,
            sold: tierSales[t.id || t.name] || 0,
        }));

        const totalInventory = tiersWithSales.reduce((sum, t) => sum + t.quantity, 0);

        return NextResponse.json({ tiers: tiersWithSales, totalSold, totalInventory });
    } catch (err: any) {
        console.error("[events/[id]/tickets]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

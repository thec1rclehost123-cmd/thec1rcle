import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { fail } from "@/lib/server/apiResponse";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/host/finance/disputes?hostId=
 * Returns dispute/chargeback list for a host.
 */
export async function GET(request: NextRequest) {
    const ctx = await requireHostAccess(request, "VIEW_FINANCIALS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    try {
        const db = getAdminDb();
        const snap = await db.collection("disputes")
            .where("hostId", "==", hostId)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const disputes = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id:              doc.id,
                createdAt:       d.createdAt ? new Date(d.createdAt).toISOString() : null,
                orderId:         d.orderId || null,
                customerName:    d.customerName || "—",
                trackingLink:    d.trackingLink || null,
                disputedAmount:  Number(d.disputedAmount || 0),
                disputeFee:      Number(d.disputeFee || 0),
                // "won" | "lost" | "under_review" | "needs_response" | "pending"
                disputeStatus:   d.disputeStatus || "pending",
                // "covered" | "not_covered" | null
                curatorStatus:   d.curatorStatus || null,
            };
        });

        return NextResponse.json({ disputes }, {
            headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
        });
    } catch (err: any) {
        logger.error("host/finance/disputes", "GET failed", { error: err.message });
        return NextResponse.json({ disputes: [] });
    }
}

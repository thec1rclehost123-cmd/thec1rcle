import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/venue/finance/disputes?venueId=
 * Returns dispute/chargeback list for a venue.
 */
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");
    if (!venueId) return fail("Missing venueId", 400);

    try {
        const db = getAdminDb();
        const snap = await db.collection("disputes")
            .where("venueId", "==", venueId)
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
        logger.error("venue/finance/disputes", "GET failed", { error: err.message });
        return NextResponse.json({ disputes: [] });
    }
}

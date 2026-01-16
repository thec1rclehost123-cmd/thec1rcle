import { NextRequest, NextResponse } from "next/server";
import { listPromoterCommissions } from "@/lib/server/promoterLinkStore";

/**
 * GET /api/promoter/commissions
 * List commissions for a promoter
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const eventId = searchParams.get("eventId");
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");

        if (!promoterId && !eventId) {
            return NextResponse.json(
                { error: "promoterId or eventId is required" },
                { status: 400 }
            );
        }

        const commissions = await listPromoterCommissions({
            promoterId: promoterId || undefined,
            eventId: eventId || undefined,
            status: status || undefined,
            limit
        });

        return NextResponse.json({ commissions });
    } catch (error: any) {
        console.error("[Promoter Commissions API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch commissions" },
            { status: 500 }
        );
    }
}

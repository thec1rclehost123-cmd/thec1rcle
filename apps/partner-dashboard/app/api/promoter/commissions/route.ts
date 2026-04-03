import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/server/apiResponse";
import { getPromoterFinanceSnapshot } from "@/lib/server/promoterFinanceStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";

/**
 * GET /api/promoter/commissions
 * Canonical promoter commission ledger sourced from the shared finance snapshot.
 */
export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) {
        return fail(ctx.error, ctx.status);
    }

    try {
        const { searchParams } = new URL(req.url);
        const status = String(searchParams.get("status") || "all").toLowerCase();
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

        const snapshot = await getPromoterFinanceSnapshot(ctx.promoterId);
        const commissions = snapshot.commissionDetails
            .filter((row) => status === "all" || row.status === status)
            .slice(0, limit)
            .map((row) => ({
                id: row.id,
                eventId: row.eventId,
                eventName: row.eventName,
                linkCode: row.linkCode,
                ticketsSold: row.ticketsSold,
                revenue: row.revenue,
                commissionRate: row.commissionRate,
                commissionAmount: row.amount,
                status: row.status,
                createdAt: row.date,
                settledAt: row.settledAt || null,
            }));

        return ok({ commissions });
    } catch (error: any) {
        console.error("[promoter/commissions] Failed to fetch commissions", error);
        return fail("Failed to fetch commissions");
    }
}

/**
 * GET /api/partner/promoter/finance
 *
 * Canonical finance read endpoint for the authenticated promoter.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getPromoterFinanceSnapshot } from "@/lib/server/promoterFinanceStore";

export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) {
        return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    try {
        const snapshot = await getPromoterFinanceSnapshot(ctx.promoterId);

        return NextResponse.json({
            balance: snapshot.balance,
            bankAccounts: snapshot.bankAccounts,
            payouts: snapshot.payouts,
            commissionDetails: snapshot.commissionDetails,
        });
    } catch (err: any) {
        console.error("[partner/promoter/finance] Error:", err.message);
        return NextResponse.json({ error: "Failed to load promoter finance" }, { status: 500 });
    }
}

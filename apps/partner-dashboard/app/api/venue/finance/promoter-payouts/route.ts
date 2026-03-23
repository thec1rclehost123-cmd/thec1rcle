/**
 * GET /api/venue/finance/promoter-payouts?venueId=&cursor=
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getPromoterPayoutsData } from "@/lib/server/splitFinanceStore";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_promoter_payouts");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

        const data = await getPromoterPayoutsData(
            ctx.venueId,
            token,
            searchParams.get("cursor") ?? undefined
        );

        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=30" },
        });
    } catch (err: any) {
        console.error("[finance/promoter-payouts GET]", err.message);
        return NextResponse.json({ error: "Failed to fetch promoter payouts" }, { status: 500 });
    }
}

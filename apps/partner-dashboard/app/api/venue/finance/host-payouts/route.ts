/**
 * GET /api/venue/finance/host-payouts?venueId=&cursor=
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getHostPayoutsData } from "@/lib/server/splitFinanceStore";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_host_payouts");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

        const data = await getHostPayoutsData(
            ctx.venueId,
            token,
            searchParams.get("cursor") ?? undefined
        );

        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=30" },
        });
    } catch (err: any) {
        console.error("[finance/host-payouts GET]", err.message);
        return NextResponse.json({ error: "Failed to fetch host payouts" }, { status: 500 });
    }
}

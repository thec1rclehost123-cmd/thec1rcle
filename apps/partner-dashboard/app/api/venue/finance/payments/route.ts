/**
 * GET /api/venue/finance/payments?venueId=
 * OWNER + FINANCE_ADMIN only
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getPaymentsData } from "@/lib/server/splitFinanceStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_overview");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        if (!["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
            return NextResponse.json({ error: "Finance admin role required" }, { status: 403 });
        }

        const user = await verifyAuth(request);
        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
        const data = await getPaymentsData(ctx.venueId, token);

        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
        });
    } catch (err: any) {
        console.error("[finance/payments GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

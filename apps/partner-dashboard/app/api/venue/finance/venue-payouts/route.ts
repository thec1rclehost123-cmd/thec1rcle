/**
 * GET  /api/venue/finance/venue-payouts?venueId=&cursor=
 * POST /api/venue/finance/venue-payouts — initiate payout
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import {
    getVenuePayoutsData,
    initiateVenuePayout,
} from "@/lib/server/splitFinanceStore";
import { verifyAuth } from "@/lib/server/auth";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_payouts");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        if (!ctx.piiPolicy.showPayoutAmounts && !["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
            return NextResponse.json({ error: "Insufficient access" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

        const data = await getVenuePayoutsData(
            ctx.venueId,
            token,
            searchParams.get("cursor") ?? undefined
        );

        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=30" },
        });
    } catch (err: any) {
        console.error("[finance/venue-payouts GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:initiate_payout");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        if (!["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
            return NextResponse.json({ error: "Finance admin role required" }, { status: 403 });
        }

        const user = await verifyAuth(request);
        const body = await request.json();

        if (!body.amountPaise || body.amountPaise < 100) {
            return NextResponse.json({ error: "Minimum payout is ₹1" }, { status: 422 });
        }
        if (!body.methodId) {
            return NextResponse.json({ error: "methodId required" }, { status: 422 });
        }

        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
        const result = await initiateVenuePayout(
            ctx.venueId,
            body.amountPaise,
            body.methodId,
            body.idempotencyKey ?? randomUUID(),
            token,
            user!.uid
        );

        return NextResponse.json(result, { status: 201 });
    } catch (err: any) {
        console.error("[finance/venue-payouts POST]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

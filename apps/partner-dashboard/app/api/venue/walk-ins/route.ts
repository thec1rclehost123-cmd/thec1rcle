/**
 * GET  /api/venue/walk-ins?venueId=&eventId=&q=&cursor=
 * POST /api/venue/walk-ins
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { listWalkIns, createWalkIn } from "@/lib/server/walkInStore";
import { requireAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { z } from "zod";

const WalkInBodySchema = z.object({
    eventId: z.string().min(1).max(100),
    guestName: z.string().min(1).max(100),
    idempotencyKey: z.string().min(1).max(200),
    partySize: z.number().int().min(1).max(100),
    phone: z.string().max(20).optional(),
    category: z.string().max(50).optional(),
    paymentMode: z.string().max(50).optional(),
    amount: z.number().min(0).optional(),
    note: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const { searchParams } = new URL(request.url);

        const result = await listWalkIns(
            {
                eventId: searchParams.get("eventId") ?? undefined,
                q: searchParams.get("q") ?? undefined,
                fromDate: searchParams.get("fromDate") ?? undefined,
                toDate: searchParams.get("toDate") ?? undefined,
                category: (searchParams.get("category") as any) ?? undefined,
                paymentMode: (searchParams.get("paymentMode") as any) ?? undefined,
                cursor: searchParams.get("cursor") ?? undefined,
                limit: Math.min(Number(searchParams.get("limit") ?? "50"), 200),
            },
            ctx.piiPolicy.showPhone
        );

        return ok(result as unknown as Record<string, unknown>);
    } catch (err: any) {
        logger.error("venue/walk-ins", "Failed to fetch walk-ins", { error: err.message });
        return fail("Failed to fetch walk-ins");
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const ctx = await requireVenueAccess(request, "walkins:create");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const rawBody = await request.json();
        const parsed = WalkInBodySchema.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
        const body = parsed.data;

        const entry = await createWalkIn(
            body.eventId,
            ctx.venueId,
            {
                guestName: body.guestName,
                phone: body.phone ?? "",
                partySize: body.partySize,
                category: (body.category ?? "general") as any,
                paymentMode: (body.paymentMode ?? "cash") as any,
                amount: body.amount ?? 0,
                note: body.note ?? "",
                idempotencyKey: body.idempotencyKey,
            },
            { uid: auth.uid, name: (auth as any).name ?? "Operator" },
            ctx.piiPolicy.showPhone
        );

        return ok({ entry });
    } catch (err: any) {
        logger.error("venue/walk-ins", "Failed to create walk-in", { error: err.message });
        return fail("Failed to create walk-in");
    }
}

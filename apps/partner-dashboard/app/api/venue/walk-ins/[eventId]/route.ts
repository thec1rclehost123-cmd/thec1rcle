/**
 * GET    /api/venue/walk-ins/[eventId]?venueId=
 * PATCH  /api/venue/walk-ins/[eventId]?venueId=&logId=
 * DELETE /api/venue/walk-ins/[eventId]?venueId=&logId=  (void)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import {
    listWalkIns,
    updateWalkIn,
    voidWalkIn,
    getWalkInEventSummary,
} from "@/lib/server/walkInStore";
import { requireAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const { eventId } = await params;
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const includeSummary = searchParams.get("summary") === "1";

        const [result, summary] = await Promise.all([
            listWalkIns(
                {
                    eventId: eventId,
                    q: searchParams.get("q") ?? undefined,
                    category: (searchParams.get("category") as any) ?? undefined,
                    paymentMode: (searchParams.get("paymentMode") as any) ?? undefined,
                    cursor: searchParams.get("cursor") ?? undefined,
                    limit: Number(searchParams.get("limit") ?? "100"),
                },
                ctx.piiPolicy.showPhone
            ),
            includeSummary ? getWalkInEventSummary(eventId) : Promise.resolve(null),
        ]);

        return NextResponse.json({ ...result, summary }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (err: any) {
        console.error("[walk-ins/:eventId GET]", err.message);
        return fail("Failed to fetch walk-ins");
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const { eventId } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const ctx = await requireVenueAccess(request, "walkins:edit");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const logId = searchParams.get("logId");
        if (!logId) return fail("logId required", 400);

        const body = await request.json();

        const entry = await updateWalkIn(
            eventId,
            logId,
            {
                guestName: body.guestName,
                partySize: body.partySize,
                category: body.category,
                paymentMode: body.paymentMode,
                amountPaise: body.amount != null ? Math.round(body.amount * 100) : undefined,
                note: body.note,
            },
            { uid: auth.uid },
            ctx.piiPolicy.showPhone
        );

        return NextResponse.json({ entry });
    } catch (err: any) {
        if (err.message === "Entry not found") return fail("Not found", 404);
        console.error("[walk-ins/:eventId PATCH]", err.message);
        return fail("Failed to update walk-in");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const { eventId } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const ctx = await requireVenueAccess(request, "walkins:delete");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const logId = searchParams.get("logId");
        if (!logId) return fail("logId required", 400);

        await voidWalkIn(eventId, logId, { uid: auth.uid });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[walk-ins/:eventId DELETE]", err.message);
        return fail("Failed to void walk-in");
    }
}

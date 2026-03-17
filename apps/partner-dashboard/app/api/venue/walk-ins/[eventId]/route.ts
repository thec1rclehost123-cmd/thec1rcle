/**
 * GET    /api/venue/walk-ins/[eventId]?venueId=
 * PATCH  /api/venue/walk-ins/[eventId]?venueId=&logId=
 * DELETE /api/venue/walk-ins/[eventId]?venueId=&logId=  (void)
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import {
    listWalkIns,
    updateWalkIn,
    voidWalkIn,
    getWalkInEventSummary,
} from "@/lib/server/walkInStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(
    request: Request,
    { params }: { params: { eventId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const includeSummary = searchParams.get("summary") === "1";

        const [result, summary] = await Promise.all([
            listWalkIns(
                {
                    eventId: params.eventId,
                    q: searchParams.get("q") ?? undefined,
                    category: (searchParams.get("category") as any) ?? undefined,
                    paymentMode: (searchParams.get("paymentMode") as any) ?? undefined,
                    cursor: searchParams.get("cursor") ?? undefined,
                    limit: Number(searchParams.get("limit") ?? "100"),
                },
                ctx.piiPolicy.showPhone
            ),
            includeSummary ? getWalkInEventSummary(params.eventId) : Promise.resolve(null),
        ]);

        return NextResponse.json({ ...result, summary }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (err: any) {
        console.error("[walk-ins/:eventId GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { eventId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:edit");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const logId = searchParams.get("logId");
        if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

        const user = await verifyAuth(request);
        const body = await request.json();

        const entry = await updateWalkIn(
            params.eventId,
            logId,
            {
                guestName: body.guestName,
                partySize: body.partySize,
                category: body.category,
                paymentMode: body.paymentMode,
                amountPaise: body.amount != null ? Math.round(body.amount * 100) : undefined,
                note: body.note,
            },
            { uid: user!.uid },
            ctx.piiPolicy.showPhone
        );

        return NextResponse.json({ entry });
    } catch (err: any) {
        if (err.message === "Entry not found") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        console.error("[walk-ins/:eventId PATCH]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { eventId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:delete");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const logId = searchParams.get("logId");
        if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

        const user = await verifyAuth(request);
        await voidWalkIn(params.eventId, logId, { uid: user!.uid });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[walk-ins/:eventId DELETE]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

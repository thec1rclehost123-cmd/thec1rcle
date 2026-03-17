/**
 * GET  /api/venue/walk-ins?venueId=&eventId=&q=&cursor=
 * POST /api/venue/walk-ins
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { listWalkIns, createWalkIn } from "@/lib/server/walkInStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

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
                limit: Number(searchParams.get("limit") ?? "50"),
            },
            ctx.piiPolicy.showPhone
        );

        return NextResponse.json(result, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (err: any) {
        console.error("[walk-ins GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:create");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const user = await verifyAuth(request);
        const body = await request.json();

        if (!body.eventId) {
            return NextResponse.json({ error: "eventId is required" }, { status: 422 });
        }
        if (!body.guestName?.trim()) {
            return NextResponse.json({ error: "guestName is required" }, { status: 422 });
        }
        if (!body.idempotencyKey) {
            return NextResponse.json({ error: "idempotencyKey is required" }, { status: 422 });
        }
        if (!body.partySize || body.partySize < 1) {
            return NextResponse.json({ error: "partySize must be >= 1" }, { status: 422 });
        }

        const entry = await createWalkIn(
            body.eventId,
            ctx.venueId,
            {
                guestName: body.guestName,
                phone: body.phone ?? "",
                partySize: body.partySize,
                category: body.category ?? "general",
                paymentMode: body.paymentMode ?? "cash",
                amount: body.amount ?? 0,
                note: body.note ?? "",
                idempotencyKey: body.idempotencyKey,
            },
            { uid: user!.uid, name: user!.displayName ?? "Operator" },
            ctx.piiPolicy.showPhone
        );

        return NextResponse.json({ entry }, { status: 201 });
    } catch (err: any) {
        console.error("[walk-ins POST]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

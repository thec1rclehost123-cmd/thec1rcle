/**
 * GET  /api/venue/slots?venueId=&startDate=&endDate=
 * POST /api/venue/slots          — block or partial-block a slot
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import {
    getSlotCalendar,
    blockSlot,
} from "@/lib/server/availabilitySlotStore";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "calendar:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
        }

        // Enforce max 3-month window to prevent abuse
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        if (diffMs > 93 * 24 * 60 * 60 * 1000) {
            return NextResponse.json({ error: "Date range too large (max 93 days)" }, { status: 400 });
        }

        const calendar = await getSlotCalendar(ctx.venueId, startDate, endDate);

        return NextResponse.json(calendar, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
    } catch (err: any) {
        console.error("[slots GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "calendar:block_slot");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const body = await request.json();

        if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
            return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 422 });
        }

        if (body.startTime && !/^\d{2}:\d{2}$/.test(body.startTime)) {
            return NextResponse.json({ error: "Invalid startTime format (HH:mm)" }, { status: 422 });
        }

        if (body.endTime && !/^\d{2}:\d{2}$/.test(body.endTime)) {
            return NextResponse.json({ error: "Invalid endTime format (HH:mm)" }, { status: 422 });
        }

        if (body.startTime && body.endTime && body.startTime >= body.endTime) {
            return NextResponse.json({ error: "startTime must be before endTime" }, { status: 422 });
        }

        const slot = await blockSlot(
            {
                venueId: ctx.venueId,
                date: body.date,
                startTime: body.startTime ?? null,
                endTime: body.endTime ?? null,
                note: body.note ?? "",
            },
            { uid: ctx.uid }
        );

        return NextResponse.json({ slot }, { status: 201 });
    } catch (err: any) {
        if (err.message.startsWith("Conflict:")) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        console.error("[slots POST]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

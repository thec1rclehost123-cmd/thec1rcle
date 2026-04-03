/**
 * GET  /api/venue/slots?venueId=&startDate=&endDate=
 * POST /api/venue/slots          — block or partial-block a slot
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { fail } from "@/lib/server/apiResponse";
import { getUnifiedVenueCalendar, blockDate } from "@/lib/server/calendarStore";

function mapUnifiedDayToSlotDay(day: any) {
    const slots = (day?.slots || []).map((slot: any, index: number) => ({
        id: slot.id || `${day.date}_${index}`,
        venueId: day.venueId || null,
        date: day.date,
        startTime: slot.startTime ?? null,
        endTime: slot.endTime ?? null,
        status:
            slot.status === "tentative"
                ? "pending_review"
                : slot.status === "blocked" || slot.status === "booked"
                    ? slot.status
                    : "open",
        source:
            slot.status === "blocked"
                ? (slot.startTime || slot.endTime ? "partial_block" : "manual_block")
                : slot.status === "tentative"
                    ? "event_pending"
                    : "event_confirmed",
        linkedEventId: slot.source === "event" ? slot.id : null,
        note: slot.reason || "",
        createdBy: "",
        updatedBy: "",
        createdAt: "",
        updatedAt: "",
    }));

    return {
        date: day.date,
        slots,
        fullyBlocked: day.status === "blocked" || day.status === "booked",
        partiallyBlocked: day.status === "partial",
        openCount: day.status === "available" ? 1 : 0,
        pendingCount: slots.filter((slot: any) => slot.status === "pending_review").length,
        confirmedCount: slots.filter((slot: any) => slot.status === "booked").length,
    };
}

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

        const days = await getUnifiedVenueCalendar(ctx.venueId, startDate, endDate);
        const calendar = {
            venueId: ctx.venueId,
            startDate,
            endDate,
            days: days.map(mapUnifiedDayToSlotDay),
        };

        return NextResponse.json(calendar, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
    } catch (err: any) {
        console.error("[slots GET]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
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

        const slot = await blockDate(
            ctx.venueId,
            body.date,
            body.note ?? "",
            { uid: ctx.uid, role: "venue" },
            body.startTime ?? null,
            body.endTime ?? null
        );

        return NextResponse.json({ slot }, { status: 201 });
    } catch (err: any) {
        if (err.message?.startsWith("Conflict:")) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        console.error("[slots POST]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

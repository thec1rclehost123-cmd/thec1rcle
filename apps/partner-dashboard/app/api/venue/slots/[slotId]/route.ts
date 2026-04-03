/**
 * GET    /api/venue/slots/[slotId]?venueId=
 * PATCH  /api/venue/slots/[slotId]?venueId=  — update note or status
 * DELETE /api/venue/slots/[slotId]?venueId=  — unblock
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { blockDate, getDateAvailability, unblockDate } from "@/lib/server/calendarStore";

function extractDateFromSlotId(slotId: string, venueId: string): string | null {
    if (slotId.startsWith(`${venueId}_`)) {
        return slotId.slice(venueId.length + 1);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(slotId)) {
        return slotId;
    }
    return null;
}

function mapLegacySlot(day: any, venueId: string, slotId: string) {
    if (!day) return null;
    const primarySlot = (day.slots || [])[0] || null;
    return {
        id: slotId,
        venueId,
        date: day.date,
        startTime: primarySlot?.startTime ?? null,
        endTime: primarySlot?.endTime ?? null,
        status:
            day.status === "blocked"
                ? "blocked"
                : day.status === "booked"
                    ? "booked"
                    : day.status === "partial"
                        ? "pending_review"
                        : "open",
        source:
            day.status === "blocked"
                ? (primarySlot?.startTime || primarySlot?.endTime ? "partial_block" : "manual_block")
                : day.status === "booked"
                    ? "event_confirmed"
                    : "event_pending",
        linkedEventId: primarySlot?.source === "event" ? primarySlot.id : null,
        note: day.reason || primarySlot?.reason || "",
    };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slotId: string }> }
) {
    const { slotId } = await params;
    try {
        const ctx = await requireVenueAccess(request, "calendar:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const date = extractDateFromSlotId(slotId, ctx.venueId);
        if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const day = await getDateAvailability(ctx.venueId, date);
        const slot = mapLegacySlot(day, ctx.venueId, slotId);
        if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ slot });
    } catch (err: any) {
        console.error("[slots/:id GET]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ slotId: string }> }
) {
    const { slotId } = await params;
    try {
        const ctx = await requireVenueAccess(request, "calendar:block_slot");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const body = await request.json();
        const date = extractDateFromSlotId(slotId, ctx.venueId);
        if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const existing = await getDateAvailability(ctx.venueId, date);
        if (!existing || existing.status === "available") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (existing.status !== "blocked") {
            return NextResponse.json({ error: "Only manual venue blocks can be edited here" }, { status: 409 });
        }

        await blockDate(
            ctx.venueId,
            date,
            body.note ?? existing.reason ?? "",
            { uid: ctx.uid, role: "venue" },
            body.startTime ?? existing.slots?.[0]?.startTime ?? null,
            body.endTime ?? existing.slots?.[0]?.endTime ?? null
        );

        const updatedDay = await getDateAvailability(ctx.venueId, date);
        const updated = mapLegacySlot(updatedDay, ctx.venueId, slotId);
        return NextResponse.json({ slot: updated });
    } catch (err: any) {
        console.error("[slots/:id PATCH]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ slotId: string }> }
) {
    const { slotId } = await params;
    try {
        const ctx = await requireVenueAccess(request, "calendar:unblock_slot");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const date = extractDateFromSlotId(slotId, ctx.venueId);
        if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const existing = await getDateAvailability(ctx.venueId, date);
        if (!existing || existing.status === "available") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (existing.status !== "blocked") {
            return NextResponse.json({ error: "Cannot unblock a booked slot — cancel the event first" }, { status: 409 });
        }

        await unblockDate(ctx.venueId, date, { uid: ctx.uid });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        if (err.message?.startsWith("Cannot unblock")) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        if (err.message === "Slot not found") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        console.error("[slots/:id DELETE]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

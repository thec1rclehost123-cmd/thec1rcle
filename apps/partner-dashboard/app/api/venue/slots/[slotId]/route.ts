/**
 * GET    /api/venue/slots/[slotId]?venueId=
 * PATCH  /api/venue/slots/[slotId]?venueId=  — update note or status
 * DELETE /api/venue/slots/[slotId]?venueId=  — unblock
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import {
    getSlot,
    unblockSlot,
    updateSlotStatus,
} from "@/lib/server/availabilitySlotStore";

export async function GET(
    request: Request,
    { params }: { params: { slotId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "calendar:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const slot = await getSlot(ctx.venueId, params.slotId);
        if (!slot) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ slot });
    } catch (err: any) {
        console.error("[slots/:id GET]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { slotId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "calendar:block_slot");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const body = await request.json();

        if (body.status) {
            await updateSlotStatus(ctx.venueId, params.slotId, body.status, { uid: ctx.uid }, {
                note: body.note,
            });
        }

        const updated = await getSlot(ctx.venueId, params.slotId);
        return NextResponse.json({ slot: updated });
    } catch (err: any) {
        console.error("[slots/:id PATCH]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { slotId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "calendar:unblock_slot");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        await unblockSlot(ctx.venueId, params.slotId, { uid: ctx.uid });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        if (err.message.startsWith("Cannot unblock")) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        if (err.message === "Slot not found") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        console.error("[slots/:id DELETE]", err.message);
        return NextResponse.json({ error: "Failed to process slot request" }, { status: 500 });
    }
}

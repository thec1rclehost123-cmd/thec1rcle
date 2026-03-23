import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { upsertHostAllocation } from "@/lib/server/scanLogStore";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string; hostId: string }> }) {
    const { eventId, hostId} = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (!["OWNER", "MANAGER"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        if (body.allocatedCount === undefined || body.allocatedCount < 0) {
            return NextResponse.json({ error: "allocatedCount is required and must be >= 0" }, { status: 400 });
        }

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        await upsertHostAllocation(eventId, hostId, { allocatedCount: body.allocatedCount, notes: body.notes }, actor);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code) return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
        console.error("PATCH host-allocation error", err);
        return NextResponse.json({ error: "Failed to update allocation" }, { status: 500 });
    }
}

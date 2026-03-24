import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { getGuestRules, updateGuestRules, getAllocations } from "@/lib/server/scanLogStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const [rules, allocations] = await Promise.all([
            getGuestRules(eventId),
            getAllocations(eventId),
        ]);
        return NextResponse.json({ rules, allocations });
    } catch (err: any) {
        console.error("GET guest-rules error", err);
        return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (!["OWNER", "MANAGER"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const rules = await getGuestRules(eventId);
        if (rules.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });

        const body = await req.json();
        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        await updateGuestRules(eventId, venueId!, body, actor);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code) return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
        console.error("PATCH guest-rules error", err);
        return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
    }
}

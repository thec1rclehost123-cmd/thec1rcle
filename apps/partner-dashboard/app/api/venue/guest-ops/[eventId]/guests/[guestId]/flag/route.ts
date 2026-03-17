import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { flagGuest, getGuestRules } from "@/lib/server/guestListStore";

export async function POST(req: NextRequest, { params }: { params: { eventId: string; guestId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId, guestId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["SCAN_ENTRY", "MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (["STAFF", "FINANCE_ADMIN"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const rules = await getGuestRules(eventId);
        if (rules.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });

        const body = await req.json();
        if (!body.reason) return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        await flagGuest(eventId, guestId, actor, { reason: body.reason, severity: body.severity, notes: body.notes } as any);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code) return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
        console.error("POST flag error", err);
        return NextResponse.json({ error: "Flag failed" }, { status: 500 });
    }
}

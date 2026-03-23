import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { resolveException } from "@/lib/server/scanLogStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string; exceptionId: string }> }) {
    const { eventId, exceptionId } = await params;
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
        if (!body.action || !body.reason) {
            return NextResponse.json({ error: "action and reason are required" }, { status: 400 });
        }

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        await resolveException(eventId, exceptionId, actor, { action: body.action, reason: body.reason, notes: body.notes });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code) return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
        console.error("POST resolve-exception error", err);
        return NextResponse.json({ error: "Failed to resolve exception" }, { status: 500 });
    }
}

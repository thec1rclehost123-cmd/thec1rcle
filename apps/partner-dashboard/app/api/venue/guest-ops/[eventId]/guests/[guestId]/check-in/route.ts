import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { checkInGuest, getGuestRules } from "@/lib/server/guestListStore";
import { onCheckIn } from "@/lib/server/aggregation-engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string; guestId: string }> }) {
    const { eventId, guestId} = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["SCAN_ENTRY", "MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;

        // STAFF and FINANCE_ADMIN cannot perform manual check-in
        if (["STAFF", "FINANCE_ADMIN"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions — manual check-in requires OWNER, MANAGER, or SECURITY" }, { status: 403 });
        }

        const rules = await getGuestRules(eventId);
        if (rules.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });
        if (!rules.manualCheckInEnabled) {
            return NextResponse.json({ error: "MANUAL_CHECKIN_DISABLED", message: "Manual check-in is disabled for this event — use scanner only" }, { status: 409 });
        }

        // Entry cutoff check (OWNER can bypass)
        if (rules.entryCutoffEnabled && rules.entryCutoffTime && membership.role !== "OWNER") {
            if (new Date() > new Date(rules.entryCutoffTime)) {
                return NextResponse.json({ error: "ENTRY_CUTOFF_REACHED", cutoffTime: rules.entryCutoffTime }, { status: 409 });
            }
        }

        const body = await req.json().catch(() => ({}));

        if (rules.manualOverrideRequiresReason && !body.reason && membership.role !== "SECURITY") {
            return NextResponse.json({ error: "REASON_REQUIRED", message: "A reason is required for manual check-in" }, { status: 400 });
        }

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        const result = await checkInGuest(eventId, guestId, actor, { reason: body.reason, gate: body.gate });

        // Update read models (non-blocking — never fails the primary check-in)
        if (venueId) {
            onCheckIn(venueId, eventId, new Date().toISOString());
        }

        return NextResponse.json(result);
    } catch (err: any) {
        if (err.code) return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
        console.error("POST check-in error", err);
        return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
    }
}

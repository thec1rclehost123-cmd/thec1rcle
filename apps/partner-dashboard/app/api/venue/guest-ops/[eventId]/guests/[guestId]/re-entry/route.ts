import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess, writeOverrideLog } from "@/lib/server/guestOpsMiddleware";
import { getGuestRules } from "@/lib/server/guestListStore";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string; guestId: string }> }) {
    const { eventId, guestId} = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (!["OWNER", "MANAGER"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions — re-entry requires OWNER or MANAGER" }, { status: 403 });
        }

        const rules = await getGuestRules(eventId);
        if (rules.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });
        if (!rules.reEntryEnabled) {
            return NextResponse.json({ error: "REENTRY_DISABLED", message: "Re-entry is not enabled for this event" }, { status: 409 });
        }

        const db = getAdminDb();
        const guestRef = db.collection("guest_lists").doc(eventId).collection("guests").doc(guestId);
        const doc = await guestRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

        const guest = doc.data()!;
        if (!guest.checkedIn) {
            return NextResponse.json({ error: "Guest has not checked in yet — re-entry requires prior check-in" }, { status: 409 });
        }

        // Re-entry window check
        if (rules.reEntryWindowMins && guest.checkedInAt) {
            const windowMs = rules.reEntryWindowMins * 60 * 1000;
            if (Date.now() - new Date(guest.checkedInAt).getTime() > windowMs) {
                return NextResponse.json({ error: "REENTRY_WINDOW_EXPIRED", message: `Re-entry window (${rules.reEntryWindowMins}min) has passed` }, { status: 409 });
            }
        }

        const body = await req.json().catch(() => ({}));
        const now = new Date().toISOString();

        // Append re-entry scan event
        await db.collection("scan_logs").doc(eventId).collection("scans").add({
            eventId, venueId: venueId || null,
            guestId, guestDisplayName: guest.displayName || "",
            result: "re_entry", source: "manual_dashboard",
            scannedAt: now, gate: body.gate || null,
            operatorUid: user.uid, operatorName: user.name || "",
        });

        await writeOverrideLog(db, {
            eventId, venueId: venueId!,
            action: "re_entry",
            actorUid: user.uid, actorName: user.name || user.email, actorRole: membership.role,
            targetGuestId: guestId, targetGuestName: guest.displayName || "",
            reason: body.notes || "Re-entry approved",
            metadata: { gate: body.gate || null },
        });

        return NextResponse.json({ success: true, reEntryAt: now });
    } catch (err: any) {
        console.error("POST re-entry error", err);
        return NextResponse.json({ error: "Re-entry failed" }, { status: 500 });
    }
}

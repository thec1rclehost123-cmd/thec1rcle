import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess, writeOverrideLog } from "@/lib/server/guestOpsMiddleware";
import { getGuest, getGuestRules } from "@/lib/server/guestListStore";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, { params }: { params: { eventId: string; guestId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId, guestId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const guest = await getGuest(eventId, guestId, (auth as any).membership.role);
        if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
        return NextResponse.json({ guest });
    } catch (err: any) {
        console.error("GET guest error", err);
        return NextResponse.json({ error: "Failed to load guest" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { eventId: string; guestId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId, guestId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (!["OWNER", "MANAGER"].includes(membership.role)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const db = getAdminDb();
        const guestRef = db.collection("guest_lists").doc(eventId).collection("guests").doc(guestId);
        const doc = await guestRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
        if (doc.data()?.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });

        const body = await req.json();
        const allowed = ["notes", "tableId", "hostId", "promoterId"];
        const updates: any = { updatedAt: new Date().toISOString(), updatedByUid: user.uid };
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        await guestRef.update(updates);

        await writeOverrideLog(db, {
            eventId, venueId: venueId!,
            action: "edit_notes",
            actorUid: user.uid, actorName: user.name || user.email, actorRole: membership.role,
            targetGuestId: guestId, targetGuestName: doc.data()?.displayName || "",
            reason: body.reason || "Guest record updated",
            metadata: { updatedFields: Object.keys(updates) },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("PATCH guest error", err);
        return NextResponse.json({ error: "Failed to update guest" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { eventId: string; guestId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId, guestId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        const db = getAdminDb();
        const guestRef = db.collection("guest_lists").doc(eventId).collection("guests").doc(guestId);
        const doc = await guestRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

        const guest = doc.data()!;
        if (guest.isLocked) return NextResponse.json({ error: "EVENT_LOCKED" }, { status: 409 });

        // MANAGER can only remove pre-event
        if (membership.role === "MANAGER") {
            const eventDoc = await db.collection("events").doc(eventId).get();
            const lifecycle = eventDoc.data()?.lifecycle;
            if (lifecycle === "live" || lifecycle === "completed") {
                return NextResponse.json({ error: "MANAGER cannot remove guests during or after live event" }, { status: 403 });
            }
        }

        // Cannot remove checked-in guests without undo first
        if (guest.checkedIn) {
            return NextResponse.json({ error: "Cannot remove a guest who is already checked in. Undo check-in first." }, { status: 409 });
        }

        const body = await req.json().catch(() => ({}));
        const now = new Date().toISOString();
        await guestRef.update({ isRemoved: true, status: "removed", removedAt: now, removedBy: user.uid });

        await writeOverrideLog(db, {
            eventId, venueId: venueId!,
            action: "remove_guest",
            actorUid: user.uid, actorName: user.name || user.email, actorRole: membership.role,
            targetGuestId: guestId, targetGuestName: guest.displayName || "",
            reason: body.reason || "Guest removed",
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("DELETE guest error", err);
        return NextResponse.json({ error: "Failed to remove guest" }, { status: 500 });
    }
}

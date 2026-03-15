/**
 * PATCH /api/host/events/[id]/resubmit
 * Resubmits an event after venue requested changes.
 *
 * State machine: needs_changes → submitted  |  denied → submitted
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId, uid } = ctx;
    const eventId = params.id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const currentLc = (ev.lifecycle || ev.status || "").toLowerCase();
        if (!["needs_changes", "denied"].includes(currentLc)) {
            return NextResponse.json({ error: `Cannot resubmit from state: ${currentLc}` }, { status: 409 });
        }

        const body = await req.json().catch(() => ({}));
        const now = new Date();

        await db.collection("events").doc(eventId).update({
            lifecycle: "submitted",
            status: "submitted",
            resubmittedAt: now,
            resubmittedBy: uid,
            hostNote: body.hostNote || null,
            updatedAt: now,
        });

        await db.collection("events").doc(eventId)
            .collection("submission_history")
            .add({
                status: "resubmitted",
                note: body.hostNote || "Event resubmitted after changes",
                actor: "host",
                actorUid: uid,
                createdAt: now.toISOString(),
            });

        // Notify venue
        if (ev.venueId) {
            await db.collection("notifications").add({
                recipientPartnerId: ev.venueId,
                recipientType: "venue",
                type: "event_resubmitted",
                title: "Event resubmitted",
                message: `${ev.title || "An event"} has been updated and resubmitted for review.`,
                eventId,
                hostId,
                read: false,
                createdAt: now.toISOString(),
                timestamp: now.getTime(),
            });
        }

        await writeAuditLog(hostId, uid, "event.resubmit", { eventId, eventName: ev.title || ev.name });

        return NextResponse.json({ success: true, lifecycle: "submitted" });
    } catch (err: any) {
        console.error("[events/[id]/resubmit]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

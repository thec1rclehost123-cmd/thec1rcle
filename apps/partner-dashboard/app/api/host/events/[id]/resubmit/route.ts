/**
 * PATCH /api/host/events/[id]/resubmit
 * Resubmits an event after venue requested changes.
 *
 * State machine: needs_changes → submitted  |  denied → submitted
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkPartnership } from "@/lib/server/partnershipStore";
import { createSlotRequest, listSlotRequests } from "@/lib/server/slotStore";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { uid, hostId } = ctx as any;

    const eventId = id;
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

        const hasPartnership = await checkPartnership(hostId, ev.venueId);
        if (!hasPartnership) {
            return NextResponse.json({ error: "No active partnership with this venue. Access denied." }, { status: 403 });
        }

        const existingSlotRequests = await listSlotRequests({ venueId: ev.venueId, hostId, limit: 50 } as any);
        const matchingActiveRequest = existingSlotRequests.find((request: any) =>
            request.eventId === eventId && String(request.status || "").toLowerCase() !== "rejected"
        );

        if (!matchingActiveRequest) {
            await createSlotRequest({
                eventId,
                hostId,
                hostName: ev.hostName || ev.host || "",
                venueId: ev.venueId,
                venueName: ev.venueName || ev.venue || "",
                requestedDate: String(ev.startDate || "").slice(0, 10),
                requestedStartTime: ev.startTime,
                requestedEndTime: ev.endTime,
                notes: body.hostNote || `Event resubmission: ${ev.title || ev.name || eventId}`,
            }, req.headers.get("authorization")?.split("Bearer ")[1] || "", { uid, role: "host" });
        }

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
        return NextResponse.json({ error: "Failed to resubmit event" }, { status: 500 });
    }
}

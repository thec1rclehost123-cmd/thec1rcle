/**
 * POST /api/host/events/[id]/submit
 * Submits a draft event to the selected venue for approval.
 *
 * State machine: draft → submitted
 * Enforced server-side — client cannot skip validation.
 */
import { NextRequest } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return fail(ctx.error, ctx.status);
    const { uid, hostId } = ctx as any;

    const eventId = id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return fail("Event not found", 404);

        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return fail("Forbidden", 403);
        }

        const currentLc = (ev.lifecycle || ev.status || "").toLowerCase();
        if (currentLc !== "draft") {
            return fail(`Cannot submit from state: ${currentLc}`, 409);
        }

        // Validate required fields
        const errors: string[] = [];
        if (!ev.title && !ev.name) errors.push("Event name is required");
        if (!ev.venueId) errors.push("Venue selection is required");
        if (!ev.startDate) errors.push("Event date is required");
        if (!ev.coverImage && !ev.coverPhoto) errors.push("Cover image is required");
        const tiers = ev.ticketTiers || ev.tiers || [];
        if (!tiers.length) errors.push("At least one ticket tier is required");

        if (errors.length > 0) {
            return fail(errors.join("; "), 422);
        }

        const body = await req.json().catch(() => ({}));
        const now = new Date();

        // Transition to submitted
        await db.collection("events").doc(eventId).update({
            lifecycle: "submitted",
            status: "submitted",
            submittedAt: now,
            submittedBy: uid,
            hostNote: body.hostNote || null,
            updatedAt: now,
        });

        // Add to submission_history subcollection
        await db.collection("events").doc(eventId)
            .collection("submission_history")
            .add({
                status: "submitted",
                note: body.hostNote || "Event submitted to venue",
                actor: "host",
                actorUid: uid,
                createdAt: now.toISOString(),
            });

        // Create notification for venue — fields must match venue/notifications GET query (targetId, isRead)
        if (ev.venueId) {
            const nid = db.collection("notifications").doc().id;
            await db.collection("notifications").doc(nid).set({
                id: nid,
                targetId: ev.venueId,
                targetType: "venue",
                type: "event_submitted",
                title: `New event submission`,
                description: `${ev.hostName || ev.hostId || "A host"} submitted "${ev.title || ev.name || "an event"}" for review.`,
                isRead: false,
                actionable: false,
                createdAt: now.toISOString(),
                data: { eventId, eventName: ev.title || ev.name || "", hostId },
            });
        }

        await writeAuditLog(hostId, uid, "event.submit", { eventId, eventName: ev.title || ev.name, venueId: ev.venueId });

        return ok({ lifecycle: "submitted" });
    } catch (err: any) {
        logger.error("host/events/submit", "Failed to submit event", { error: err.message });
        return fail("Failed to submit event");
    }
}

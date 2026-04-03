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
import { checkPartnership, resolveHostVenueSelection } from "@/lib/server/partnershipStore";
import { createSlotRequest, listSlotRequests } from "@/lib/server/slotStore";
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

        const body = await req.json().catch(() => ({}));
        const normalizedPoster = ev.coverImage || ev.coverPhoto || ev.poster || ev.image || ev.images?.[0] || "";
        let effectiveVenueId = ev.venueId;
        let effectiveVenueName = ev.venueName || ev.venue || "";

        if (normalizedPoster && (!ev.coverImage || !ev.coverPhoto)) {
            await eventDoc.ref.update({
                ...(ev.coverImage ? {} : { coverImage: normalizedPoster }),
                ...(ev.coverPhoto ? {} : { coverPhoto: normalizedPoster }),
                updatedAt: new Date(),
            });
            ev.coverImage = ev.coverImage || normalizedPoster;
            ev.coverPhoto = ev.coverPhoto || normalizedPoster;
        }

        if (effectiveVenueId) {
            const resolvedVenue = await resolveHostVenueSelection(hostId, effectiveVenueId, effectiveVenueName);
            if (resolvedVenue?.venueId) {
                effectiveVenueId = resolvedVenue.venueId;
                effectiveVenueName = resolvedVenue.venueName || effectiveVenueName;

                if (resolvedVenue.canonicalized) {
                    await eventDoc.ref.update({
                        venueId: effectiveVenueId,
                        venueName: effectiveVenueName,
                        venue: effectiveVenueName,
                        updatedAt: new Date(),
                    });
                    ev.venueId = effectiveVenueId;
                    ev.venueName = effectiveVenueName;
                    ev.venue = effectiveVenueName;
                }
            }
        }

        // Validate required fields
        const errors: string[] = [];
        if (!ev.title && !ev.name) errors.push("Event name is required");
        if (!effectiveVenueId) errors.push("Venue selection is required");
        if (!ev.startDate) errors.push("Event date is required");
        if (!normalizedPoster) errors.push("Cover image is required");
        const tiers = ev.ticketTiers || ev.tiers || [];
        if (!tiers.length) errors.push("At least one ticket tier is required");

        if (errors.length > 0) {
            return fail(errors.join("; "), 422);
        }

        const hasPartnership = effectiveVenueId
            ? await checkPartnership(hostId, effectiveVenueId)
            : false;
        if (!hasPartnership) {
            return fail("No active partnership with this venue. Access denied.", 403);
        }

        const existingSlotRequests = await listSlotRequests({ venueId: effectiveVenueId, hostId, limit: 50 } as any);
        const matchingActiveRequest = existingSlotRequests.find((request: any) =>
            request.eventId === eventId && String(request.status || "").toLowerCase() !== "rejected"
        );

        if (!matchingActiveRequest) {
            await createSlotRequest({
                eventId,
                hostId,
                hostName: ev.hostName || ev.host || "",
                venueId: effectiveVenueId,
                venueName: effectiveVenueName,
                requestedDate: String(ev.startDate || "").slice(0, 10),
                requestedStartTime: ev.startTime,
                requestedEndTime: ev.endTime,
                notes: body.hostNote || `Event submission: ${ev.title || ev.name || eventId}`,
            }, req.headers.get("authorization")?.split("Bearer ")[1] || "", { uid, role: "host" });
        }

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

        // Create notification for venue
        if (effectiveVenueId) {
            await db.collection("notifications").add({
                recipientPartnerId: effectiveVenueId,
                recipientType: "venue",
                type: "event_submitted",
                title: "New event submission",
                message: `${ev.title || "A host"} has submitted an event for review.`,
                eventId,
                eventName: ev.title || ev.name,
                hostId,
                read: false,
                createdAt: now.toISOString(),
                timestamp: now.getTime(),
            });
        }

        await writeAuditLog(hostId, uid, "event.submit", { eventId, eventName: ev.title || ev.name, venueId: effectiveVenueId });

        return ok({ lifecycle: "submitted" });
    } catch (err: any) {
        logger.error("host/events/submit", "Failed to submit event", { error: err.message });
        return fail("Failed to submit event");
    }
}

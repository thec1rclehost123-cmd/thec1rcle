/**
 * POST /api/events/[id]/cancel
 *
 * Dedicated cancellation endpoint that:
 *   1. Validates the actor has permission to cancel
 *   2. Updates event lifecycle to "cancelled"
 *   3. Dispatches Inngest workflow for bulk refund processing
 *   4. Returns immediate response (refunds happen asynchronously)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getEvent, updateEventLifecycle } from "@/lib/server/eventStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const CancelBody = z.object({
    actor: z.object({
        uid: z.string().min(1, "actor.uid is required"),
        role: z.string().min(1, "actor.role is required"),
        partnerId: z.string().optional(),
        name: z.string().optional(),
    }),
    reason: z.string().min(1, "Cancellation reason is required"),
    refundPolicy: z.enum(["full", "partial", "none"]).default("full"),
    partialRefundPercent: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
});

export const POST = withAuth(async (req: NextRequest, auth, ctx) => {
    const eventId = ctx?.params?.id || "";

    try {
        const rawBody = await req.json();
        const parsed = CancelBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const { actor, reason, refundPolicy, partialRefundPercent, notes } = parsed.data;

        const event = await getEvent(eventId);
        if (!event) return fail("Event not found", 404);

        if (event.lifecycle === "cancelled") {
            return fail("Event is already cancelled", 409);
        }

        const isCreator = event.creatorId === actor.uid;
        const isAdmin = actor.role === "admin";
        let isVenueManager = false;

        if (event.venueId && !isCreator && !isAdmin) {
            isVenueManager = await verifyPartnerAccess(req, event.venueId);
        }

        if (!isCreator && !isAdmin && !isVenueManager) {
            return fail("Only the event creator, venue manager, or admin can cancel this event", 403);
        }

        await updateEventLifecycle(
            eventId,
            "cancelled",
            actor,
            JSON.stringify({ reason, notes, refundPolicy, partialRefundPercent, cancelledByName: actor.name || actor.uid })
        );

        let workflowDispatched = false;
        try {
            const { sendEvent, Events } = await import("@c1rcle/core/inngest-client");
            await sendEvent(Events.EVENT_CANCELLED, {
                eventId,
                eventTitle: event.title,
                cancellationReason: reason,
                cancelledBy: actor.uid,
                refundPolicy,
                partialRefundPercent: refundPolicy === "partial" ? partialRefundPercent : 100,
            }, {
                idempotencyKey: `cancel-${eventId}-${Date.now()}`,
                user: { id: actor.uid },
            });
            workflowDispatched = true;
        } catch (inngestError) {
            console.error("[POST /api/events/[id]/cancel] Inngest dispatch failed:", inngestError);
        }

        return ok(
            { eventId, lifecycle: "cancelled", refundPolicy, refundStatus: workflowDispatched ? "processing" : "manual_required" },
            workflowDispatched
                ? "Event cancelled. Refunds are being processed automatically."
                : "Event cancelled. Refunds require manual processing."
        );
    } catch (error: any) {
        console.error("[POST /api/events/[id]/cancel]", error);
        return fail("Failed to cancel event");
    }
});

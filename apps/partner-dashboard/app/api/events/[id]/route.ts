import { NextRequest } from "next/server";
import { getEvent, updateEventLifecycle, updateEvent } from "@/lib/server/eventStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/events/[id]
 * Get event details
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { id } = await (ctx?.params as any);
        console.log("[debug] GET /api/events/[id] id:", id);
        if (!id || typeof id !== "string") {
            console.error("[Firestore] Invalid id in GET /api/events/[id]:", id);
            return fail("Invalid event ID", 400);
        }
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const event = await getEvent(id, token);

        if (!event) return fail("Event not found", 404);

        return ok({ event });
    } catch (error: any) {
        logger.error("events/[id]", "GET failed", { error: error.message });
        return fail("Failed to fetch event");
    }
});

/**
 * PATCH /api/events/[id]
 * Update event (draft updates, lifecycle changes)
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { id } = await (ctx?.params as any);
        const body = await req.json();
        const { action, actor, notes, updates } = body;

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        if (!actor || !actor.uid || !actor.role) {
            return fail("Actor information required", 400);
        }

        console.log("[debug] PATCH /api/events/[id] id:", id);
        if (!id || typeof id !== "string") {
            console.error("[Firestore] Invalid id in PATCH /api/events/[id]:", id);
            return fail("Invalid event ID", 400);
        }

        let latestEvent: any = null;

        // Handle content updates
        if (updates) {
            // Strip lifecycle from updates to ensure it's only managed by updateEventLifecycle
            const { lifecycle, ...cleanUpdates } = updates;

            latestEvent = await updateEvent(id, {
                ...cleanUpdates,
                creatorId: actor.uid,
                creatorRole: actor.role,
                partnerId: actor.partnerId
            }, token);
        }

        // Handle lifecycle transitions
        if (action) {
            let newStatus: string;

            switch (action) {
                case "submit":
                    newStatus = "submitted";
                    break;
                case "approve":
                    newStatus = "approved";
                    break;
                case "reject":
                case "deny":
                    newStatus = "denied";
                    break;
                case "request_changes":
                    newStatus = "needs_changes";
                    break;
                case "publish":
                case "resume":
                    newStatus = "scheduled";
                    break;
                case "pause":
                    newStatus = "paused";
                    break;
                case "cancel":
                    newStatus = "cancelled";
                    break;
                case "draft":
                    newStatus = "draft";
                    break;
                default:
                    return fail(`Invalid action: ${action}`, 400);
            }

            // Verify management access for approve/reject/publish
            if (["approve", "reject", "deny", "publish", "request_changes"].includes(action) && actor.role !== 'admin') {
                const event = await getEvent(id, token);
                if (!event) return fail("Event not found", 404);

                const venueId = event.venueId;
                if (!venueId) return fail("Venue ID not associated with this event", 400);

                const hasAccess = await verifyPartnerAccess(req, venueId);
                if (!hasAccess) return fail("Unauthorized access to this venue", 403);
            }

            const result = await updateEventLifecycle(id, newStatus, { ...actor, token }, notes);
            return ok({ result, event: latestEvent });
        }

        if (latestEvent) return ok({ event: latestEvent });

        return fail("Action or updates required", 400);
    } catch (error: any) {
        logger.error("events/[id]", "PATCH failed", { error: error.message });
        return fail("Failed to update event");
    }
});

/**
 * DELETE /api/events/[id]
 * Soft delete an event
 */
export const DELETE = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { id } = await (ctx?.params as any);
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const body = await req.json();
        const { actor } = body;

        if (!actor || !actor.uid || !actor.role) {
            return fail("Actor information required", 400);
        }

        console.log("[debug] DELETE /api/events/[id] id:", id);
        if (!id || typeof id !== "string") {
            console.error("[Firestore] Invalid id in DELETE /api/events/[id]:", id);
            return fail("Invalid event ID", 400);
        }

        const { deleteEvent } = await import("@/lib/server/eventStore");
        const result = await deleteEvent(id, token);

        return ok({ result });
    } catch (error: any) {
        logger.error("events/[id]", "DELETE failed", { error: error.message });
        return fail("Failed to delete event");
    }
});

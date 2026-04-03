import { NextRequest, NextResponse } from "next/server";
import {
    getSlotRequest,
    approveSlotRequest,
    rejectSlotRequest,
    counterProposeSlot
} from "@/lib/server/slotStore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/slots/[id]
 * Get a specific slot request
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const slotRequest = await getSlotRequest(ctx?.params?.id as string);

        if (!slotRequest) return fail("Slot request not found", 404);

        const hasVenueAccess = slotRequest.venueId
            ? await verifyPartnerAccess(req, slotRequest.venueId)
            : false;

        if (!hasVenueAccess) {
            const hostCtx = await requireHostAccess(req, undefined, slotRequest.hostId);
            if ("error" in hostCtx) return fail(hostCtx.error, hostCtx.status);
        }

        return ok({ slotRequest });
    } catch (error: any) {
        console.error("[Slots API] GET Error:", error);
        return fail("Failed to fetch slot request");
    }
});

/**
 * PATCH /api/slots/[id]
 * Update slot request status (approve, reject, suggest alternatives)
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const body = await req.json();
        const { action, notes, alternativeDates, actor } = body;

        if (!actor || !actor.uid || !actor.role) {
            return fail("Actor information required", 400);
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const slotRequest = await getSlotRequest(ctx?.params?.id as string);
        if (!slotRequest) return fail("Slot request not found", 404);

        const hasVenueAccess = slotRequest.venueId
            ? await verifyPartnerAccess(req, slotRequest.venueId)
            : false;
        if (!hasVenueAccess) return fail("Unauthorized access to this venue", 403);

        let result;

        switch (action) {
            case "approve":
                // @ts-ignore
                result = await approveSlotRequest(ctx?.params?.id as string, actor, { notes, venueId: slotRequest.venueId }, token);
                break;

            case "reject":
                // @ts-ignore
                result = await rejectSlotRequest(ctx?.params?.id as string, actor, notes, token);
                break;

            case "counter": {
                const { alternativeDate, alternativeStartTime, alternativeEndTime } = body;
                if (!alternativeDate || !alternativeStartTime || !alternativeEndTime) {
                    return fail("Alternative date and times required", 400);
                }
                const suggestion = { alternativeDate, alternativeStartTime, alternativeEndTime, notes };
                // @ts-ignore
                result = await counterProposeSlot(ctx?.params?.id as string, actor, suggestion, token);
                break;
            }

            case "suggest": {
                if (!notes || !String(notes).trim()) {
                    return fail("Suggestion notes are required", 400);
                }

                const db = getAdminDb();
                const now = new Date();
                const slotRef = db.collection("slot_requests").doc(ctx?.params?.id as string);
                const eventRef = db.collection("events").doc(slotRequest.eventId);

                await slotRef.update({
                    status: "needs_changes",
                    clubResponse: String(notes).trim(),
                    respondedAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    venueResponseBy: actor.uid,
                    venueResponseRole: actor.role,
                    venueResponseName: actor.name || null,
                });

                await eventRef.update({
                    lifecycle: "needs_changes",
                    status: "needs_changes",
                    approvalNotes: String(notes).trim(),
                    updatedAt: now,
                });

                await eventRef.collection("submission_history").add({
                    status: "needs_changes",
                    note: String(notes).trim(),
                    actor: "venue",
                    actorUid: actor.uid,
                    createdAt: now.toISOString(),
                });

                result = await getSlotRequest(ctx?.params?.id as string);
                break;
            }

            default:
                return fail("Invalid action. Use: approve, reject, counter, or suggest", 400);
        }

        return ok({ slotRequest: result });
    } catch (error: any) {
        console.error("[Slots API] PATCH Error:", error);
        return fail("Failed to update slot request");
    }
});

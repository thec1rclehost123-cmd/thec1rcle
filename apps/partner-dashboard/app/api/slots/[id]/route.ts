import { NextRequest, NextResponse } from "next/server";
import {
    getSlotRequest,
    approveSlotRequest,
    rejectSlotRequest,
    counterProposeSlot
} from "@/lib/server/slotStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
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
        let result;

        switch (action) {
            case "approve":
                // Verify management access
                if (actor.role !== 'admin') {
                    const venueId = body.venueId || actor.partnerId;
                    if (!venueId) return fail("venueId is required for authorization", 400);
                    const hasAccess = await verifyPartnerAccess(req, venueId);
                    if (!hasAccess) return fail("Unauthorized access to this venue", 403);
                    // @ts-ignore
                    result = await approveSlotRequest(ctx?.params?.id as string, actor, { notes, venueId }, token);
                } else {
                    // @ts-ignore
                    result = await approveSlotRequest(ctx?.params?.id as string, actor, { notes }, token);
                }
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

            default:
                return fail("Invalid action. Use: approve, reject, or counter", 400);
        }

        return ok({ slotRequest: result });
    } catch (error: any) {
        console.error("[Slots API] PATCH Error:", error);
        return fail("Failed to update slot request");
    }
});

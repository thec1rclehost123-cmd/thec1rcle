import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection
} from "@/lib/server/promoterConnectionStore";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const UpdateRequestBody = z.object({
    connectionId: z.string().min(1, "connectionId is required"),
    action: z.enum(["approve", "reject", "revoke"], {
        error: "action must be 'approve', 'reject', or 'revoke'",
    }),
    venueId: z.string().optional(),
    venueName: z.string().optional(),
    reason: z.string().optional(),
});

/**
 * GET /api/venue/promoter-requests
 * List incoming promoter connection requests for a club
 */
export async function GET(req: NextRequest) {
    try {
        const ctx = await requireVenueAccess(req);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");

        if (!venueId) return fail("venueId is required", 400);

        const requests = await listIncomingRequests(venueId, "venue", status || undefined);
        return ok({ requests });
    } catch (error: any) {
        console.error("[Venue Promoter Requests API] GET Error:", error);
        return fail("Failed to fetch requests");
    }
}

/**
 * PATCH /api/venue/promoter-requests
 * Approve, reject, or revoke a promoter connection
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = UpdateRequestBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { connectionId, action, venueId, venueName, reason } = parsed.data;
        const actor = { uid: venueId || "", name: venueName || "" };

        switch (action) {
            case "approve":
                await approveConnectionRequest(connectionId, actor);
                break;
            case "reject":
                await rejectConnectionRequest(connectionId, actor, reason || "");
                break;
            case "revoke":
                await revokeConnection(connectionId, actor);
                break;
        }

        return ok({ success: true }, "Request updated");
    } catch (error: any) {
        console.error("[Venue Promoter Requests API] PATCH Error:", error);
        return fail("Failed to update request", 400);
    }
});

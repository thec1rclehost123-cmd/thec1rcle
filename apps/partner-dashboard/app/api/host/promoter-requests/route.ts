import { NextRequest } from "next/server";
import { z } from "zod";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection,
} from "@/lib/server/promoterConnectionStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const RequestsQuery = z.object({
    hostId: z.string().min(1, "hostId is required"),
    status: z.string().optional(),
});

const UpdateRequestBody = z.object({
    connectionId: z.string().min(1, "connectionId is required"),
    action: z.enum(["approve", "reject", "revoke"], {
        error: "action must be 'approve', 'reject', or 'revoke'",
    }),
    hostId: z.string().optional(),
    hostName: z.string().optional(),
    reason: z.string().optional(),
});

/**
 * GET /api/host/promoter-requests
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = RequestsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { hostId, status } = parsed.data;
        const requests = await listIncomingRequests(hostId, "host", status);
        return ok({ requests });
    } catch (error: any) {
        console.error("[GET /api/host/promoter-requests]", error);
        return fail("Failed to fetch requests");
    }
});

/**
 * PATCH /api/host/promoter-requests
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = UpdateRequestBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { connectionId, action, hostId, hostName, reason } = parsed.data;
        const actor = { uid: hostId || "", name: hostName || "" };

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
        console.error("[PATCH /api/host/promoter-requests]", error);
        return fail("Failed to update request", 400);
    }
});

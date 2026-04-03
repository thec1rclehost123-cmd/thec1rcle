import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection,
} from "@/lib/server/promoterConnectionStore";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

const RequestsQuery = z.object({
    status: z.string().optional(),
});

const UpdateRequestBody = z.object({
    connectionId: z.string().min(1, "connectionId is required"),
    action: z.enum(["approve", "reject", "revoke"], {
        error: "action must be 'approve', 'reject', or 'revoke'",
    }),
    reason: z.string().optional(),
});

/**
 * GET /api/host/promoter-requests
 */
export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const parsed = RequestsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const requests = await listIncomingRequests(ctx.hostId, "host", parsed.data.status);
        return ok({ requests });
    } catch (error: any) {
        console.error("[GET /api/host/promoter-requests]", error);
        return fail("Failed to fetch requests");
    }
}

/**
 * PATCH /api/host/promoter-requests
 */
export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const rawBody = await req.json();
        const parsed = UpdateRequestBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { connectionId, action, reason } = parsed.data;
        const actor = { uid: ctx.hostId, name: ctx.displayName };

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
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { listSlotRequests } from "@/lib/server/slotStore";
import { ok, fail } from "@/lib/server/apiResponse";

const QuerySchema = z.object({
    status: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const rawStatus = parsed.data.status;
        const needsPostFilter = rawStatus === "rejected";
        const requests = await listSlotRequests({
            hostId: ctx.hostId,
            status: needsPostFilter ? undefined : rawStatus,
            limit: parsed.data.limit,
        } as any);

        const filteredRequests = needsPostFilter
            ? requests.filter((request: any) => ["rejected", "needs_changes"].includes(String(request.status || "").toLowerCase()))
            : requests;

        return ok({ requests: filteredRequests });
    } catch (error: any) {
        console.error("[GET /api/host/slot-requests]", error);
        return fail("Failed to fetch slot requests");
    }
}

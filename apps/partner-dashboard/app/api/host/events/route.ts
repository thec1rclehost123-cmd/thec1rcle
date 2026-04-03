import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/server/eventStore";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
        const lastId = searchParams.get("lastId");

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const params: any = { creatorId: ctx.hostId, limit };
        if (lastId) params.lastId = lastId;

        const result = await listEvents(params, token);
        const events = result.events || result || [];

        return ok({ events });
    } catch (error: any) {
        logger.error("host/events", "Failed to fetch host events", { error: error.message });
        return fail("Failed to fetch host events");
    }
}

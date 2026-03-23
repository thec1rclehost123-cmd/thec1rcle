import { NextRequest } from "next/server";
import { listEvents } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
        const lastId = searchParams.get("lastId");

        if (!hostId) return fail("hostId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const params: any = { creatorId: hostId, limit };
        if (lastId) params.lastId = lastId;

        const result = await listEvents(params, token);
        const events = result.events || result || [];

        return ok({ events });
    } catch (error: any) {
        logger.error("host/events", "Failed to fetch host events", { error: error.message });
        return fail("Failed to fetch host events");
    }
});

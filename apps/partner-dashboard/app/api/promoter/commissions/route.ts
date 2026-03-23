import { NextRequest } from "next/server";
import { listPromoterCommissions } from "@/lib/server/promoterLinkStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/promoter/commissions
 * List commissions for a promoter
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const eventId = searchParams.get("eventId");
        const status = searchParams.get("status");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

        if (!promoterId && !eventId) return fail("promoterId or eventId is required", 400);

        const commissions = await listPromoterCommissions({
            promoterId: promoterId || undefined,
            eventId: eventId || undefined,
            status: status || undefined,
            limit
        });

        return ok({ commissions });
    } catch (error: any) {
        logger.error("promoter/commissions", "Failed to fetch commissions", { error: error.message });
        return fail("Failed to fetch commissions");
    }
});

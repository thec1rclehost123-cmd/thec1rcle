/**
 * GET /api/venue/door/dinein?eventId=&venueId=&cursor=&limit=
 *
 * Lists dine-in entries for an event.
 */

import { NextRequest } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { listDineinEntries } from "@/lib/server/doorSellStore";

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");
        if (!eventId) return fail("eventId is required", 400);

        const result = await listDineinEntries(eventId, {
            cursor: searchParams.get("cursor") ?? undefined,
            limit: Math.min(Number(searchParams.get("limit") ?? "50"), 200),
        });

        return ok(result as unknown as Record<string, unknown>);
    } catch (err: any) {
        logger.error("venue/door/dinein", "Failed to fetch dine-in entries", { error: err.message });
        return fail("Failed to fetch dine-in entries");
    }
}

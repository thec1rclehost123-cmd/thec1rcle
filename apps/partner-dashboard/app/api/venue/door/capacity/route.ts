/**
 * GET /api/venue/door/capacity?eventId=&venueId=
 *
 * Returns live capacity state for an event.
 * Combines soldCount (online tickets) + doorWalkInCount (offline door entries).
 */

import { NextRequest } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");
        if (!eventId) return fail("eventId is required", 400);

        if (!isFirebaseConfigured()) {
            return ok({
                capacity: {
                    total: 0,
                    soldCount: 0,
                    doorWalkInCount: 0,
                    available: 0,
                    isSoldOut: false,
                },
            });
        }

        const db = getAdminDb();
        const eventSnap = await db.collection("events").doc(eventId).get();
        if (!eventSnap.exists) return fail("Event not found", 404);

        const data = eventSnap.data()!;
        const total: number = data.capacity ?? 0;
        const soldCount: number = data.soldCount ?? 0;
        const doorWalkInCount: number = data.doorWalkInCount ?? 0;
        const available = total > 0 ? Math.max(0, total - soldCount - doorWalkInCount) : 0;
        const isSoldOut = total > 0 && available === 0;

        return ok({
            capacity: { total, soldCount, doorWalkInCount, available, isSoldOut },
        });
    } catch (err: any) {
        logger.error("venue/door/capacity", "Failed to fetch capacity", { error: err.message });
        return fail("Failed to fetch capacity");
    }
}

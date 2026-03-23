import { NextRequest } from "next/server";
import { listEvents } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/availability?venueId=xxx
 *
 * Returns blocked date/time slots based on approved/scheduled/live events.
 * Data fetched via eventStore (API Gateway) — no direct Firestore access.
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) return fail("venueId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const result = await listEvents({ venueId }, token);
        const events = result.events || result || [];

        const blockedSlots = events.filter((e: any) =>
            ["approved", "scheduled", "live"].includes(e.lifecycle || e.status)
        ).map((event: any) => ({
            date: event.startDate || event.date || null,
            startTime: event.startTime || null,
            endTime: event.endTime || null,
            eventId: event.id,
            isBlocked: true
        }));

        return ok({ blockedSlots });
    } catch (error: any) {
        return fail("Failed to fetch availability");
    }
});

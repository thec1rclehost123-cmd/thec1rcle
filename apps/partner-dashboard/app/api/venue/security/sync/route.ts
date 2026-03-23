import { NextRequest } from "next/server";
import { generateSyncCode, getSyncCode, deactivateSyncCode } from "@/lib/server/securityStore";
import { getEventGuestlist } from "@/lib/server/orderStore";
import { listEvents } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/security/sync
 * Returns security events and their sync status
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) return fail("venueId is required", 400);

        const events = await (listEvents as any)({ venueId: venueId, limit: 10 });

        const securityEvents = await Promise.all(events.map(async (event: any) => {
            const sync = await getSyncCode(event.id, venueId);
            const guestlist = await getEventGuestlist(event.id);

            return {
                id: event.id,
                title: event.name,
                date: event.start_date,
                totalTickets: guestlist.length,
                checkedIn: guestlist.filter((g: any) => g.status === 'checked_in').length,
                syncCode: sync?.code || null,
                status: event.status === 'live' ? 'active' : 'standby'
            };
        }));

        return ok({ events: securityEvents });
    } catch (error: any) {
        console.error("[Security Sync API] Error:", error);
        return fail("Failed to fetch security sync");
    }
});

/**
 * POST /api/venue/security/sync
 * Generates or refreshes a sync code
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { eventId, venueId, action, userId } = body;

        if (action === "deactivate") {
            await deactivateSyncCode(eventId, venueId);
            return ok({ success: true }, "Sync code deactivated");
        }

        const sync = await generateSyncCode(eventId, venueId, userId);
        return ok({ sync });
    } catch (error: any) {
        console.error("[Security Sync POST] Error:", error);
        return fail("Failed to manage sync code");
    }
});

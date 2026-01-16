import { NextRequest, NextResponse } from "next/server";
import { generateSyncCode, getSyncCode, deactivateSyncCode } from "@/lib/server/securityStore";
import { getEventGuestlist } from "@/lib/server/orderStore";
import { listEvents } from "@/lib/server/eventStore";

/**
 * GET /api/venue/security/sync
 * Returns security events and their sync status
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        // List events for the next 2 days
        const events = await (listEvents as any)({ venueId: venueId, limit: 10 });

        const securityEvents = await Promise.all(events.map(async (event) => {
            const sync = await getSyncCode(event.id, venueId);
            const guestlist = await getEventGuestlist(event.id);

            return {
                id: event.id,
                title: event.name,
                date: event.start_date,
                totalTickets: guestlist.length,
                checkedIn: guestlist.filter(g => g.status === 'checked_in').length,
                syncCode: sync?.code || null,
                status: event.status === 'live' ? 'active' : 'standby'
            };
        }));

        return NextResponse.json({ events: securityEvents });

    } catch (error: any) {
        console.error("[Security Sync API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/venue/security/sync
 * Generates or refreshes a sync code
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, venueId, action, userId } = body;

        if (action === "deactivate") {
            await deactivateSyncCode(eventId, venueId);
            return NextResponse.json({ success: true });
        }

        const sync = await generateSyncCode(eventId, venueId, userId);
        return NextResponse.json({ sync });

    } catch (error: any) {
        console.error("[Security Sync POST] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

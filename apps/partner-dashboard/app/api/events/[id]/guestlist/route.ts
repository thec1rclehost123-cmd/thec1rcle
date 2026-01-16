import { NextRequest, NextResponse } from "next/server";
import { getEventGuestlist } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";

/**
 * GET /api/events/[id]/guestlist
 * Returns the comprehensive guestlist for an event
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const eventId = params.id;
        const event = await getEvent(eventId);

        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const guestlist = await getEventGuestlist(eventId);

        return NextResponse.json({
            guestlist,
            stats: {
                total: guestlist.length,
                pending: guestlist.filter(g => g.status === 'pending').length,
                confirmed: guestlist.filter(g => g.status === 'confirmed').length,
                checkedIn: guestlist.filter(g => g.status === 'checked_in').length
            }
        });
    } catch (error: any) {
        console.error("[GuestlistAPI] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

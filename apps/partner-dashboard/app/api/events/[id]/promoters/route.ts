import { NextRequest, NextResponse } from "next/server";
import { getEvent, updateEvent } from "@/lib/server/eventStore";
import { listIncomingRequests } from "@/lib/server/promoterConnectionStore";

/**
 * GET /api/events/[id]/promoters
 * List eligible and currently selected promoters for an event
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const event = await getEvent(params.id);
        if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        // Get approved promoters for this club/host
        const targetId = event.venueId || event.hostId;
        const targetType = event.venueId ? "venue" : "host";

        const connections = await listIncomingRequests(targetId, targetType, "approved");

        const promoters = connections.map(conn => ({
            id: conn.promoterId,
            name: conn.promoterName,
            avatar: conn.avatar || null,
            isSelected: event.promoterSettings?.allowedPromoterIds?.includes(conn.promoterId) || false
        }));

        return NextResponse.json({ promoters });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/events/[id]/promoters
 * Update selected promoters and global promoter toggle
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const { allowedPromoterIds, enabled, actor } = body;

        const event = await getEvent(params.id);
        if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        // Authorization check
        if (actor.uid !== event.creatorId && actor.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const updatedSettings = {
            ...event.promoterSettings,
            enabled: enabled ?? event.promoterSettings?.enabled,
            allowedPromoterIds: allowedPromoterIds ?? event.promoterSettings?.allowedPromoterIds ?? []
        };

        const updatedEvent = await updateEvent(params.id, {
            promoterSettings: updatedSettings,
            creatorId: actor.uid,
            creatorRole: actor.role
        });

        return NextResponse.json({ success: true, event: updatedEvent });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

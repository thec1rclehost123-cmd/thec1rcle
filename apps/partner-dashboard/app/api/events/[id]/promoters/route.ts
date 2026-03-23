import { NextRequest } from "next/server";
import { getEvent, updateEvent } from "@/lib/server/eventStore";
import { listIncomingRequests } from "@/lib/server/promoterConnectionStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/events/[id]/promoters
 * List eligible and currently selected promoters for an event
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const event = await getEvent(ctx?.params?.id as string);
        if (!event) return fail("Event not found", 404);

        // Get approved promoters for this club/host
        const targetId = event.venueId || event.hostId;
        const targetType = event.venueId ? "venue" : "host";

        const connections = await listIncomingRequests(targetId, targetType, "approved");

        const promoters = connections.map((conn: any) => ({
            id: conn.promoterId,
            name: conn.promoterName,
            avatar: conn.avatar || null,
            isSelected: event.promoterSettings?.allowedPromoterIds?.includes(conn.promoterId) || false
        }));

        return ok({ promoters });
    } catch (error: any) {
        return fail("Failed to fetch promoters");
    }
});

/**
 * PATCH /api/events/[id]/promoters
 * Update selected promoters and global promoter toggle
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const body = await req.json();
        const { allowedPromoterIds, enabled, actor } = body;

        const event = await getEvent(ctx?.params?.id as string);
        if (!event) return fail("Event not found", 404);

        // Authorization check
        if (actor.uid !== event.creatorId && actor.role !== 'admin') {
            return fail("Unauthorized", 403);
        }

        const updatedSettings = {
            ...event.promoterSettings,
            enabled: enabled ?? event.promoterSettings?.enabled,
            allowedPromoterIds: allowedPromoterIds ?? event.promoterSettings?.allowedPromoterIds ?? []
        };

        const updatedEvent = await updateEvent(ctx?.params?.id as string, {
            promoterSettings: updatedSettings,
            creatorId: actor.uid,
            creatorRole: actor.role
        });

        return ok({ event: updatedEvent });
    } catch (error: any) {
        return fail("Failed to update promoters");
    }
});

import { NextRequest } from "next/server";
import { z } from "zod";
import { canPromoterCreateLink } from "@c1rcle/core/events";
import {
    createPromoterLink,
    listPromoterLinks,
} from "@/lib/server/promoterLinkStore";
import { getEvent } from "@/lib/server/eventStore";
import { isConnected } from "@/lib/server/promoterConnectionStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const LinksQuery = z.object({
    promoterId: z.string().optional(),
    eventId: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

const CreateLinkBody = z.object({
    promoterId: z.string().min(1, "promoterId is required"),
    eventId: z.string().min(1, "eventId is required"),
    promoterName: z.string().optional(),
    campaignLabel: z.string().optional(),
    channel: z.string().optional(),
    ticketTierIds: z.array(z.string()).optional(),
    customCommission: z.number().positive().optional(),
});

/**
 * GET /api/promoter/links
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = LinksQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { promoterId, eventId, isActive, limit } = parsed.data;
        const links = await listPromoterLinks({
            promoterId,
            eventId,
            isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
            limit,
        });
        return ok({ links });
    } catch (error: any) {
        console.error("[GET /api/promoter/links]", error);
        return fail("Failed to fetch links");
    }
});

/**
 * POST /api/promoter/links
 * Create a new promoter link for an event
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = CreateLinkBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { promoterId, eventId, promoterName, campaignLabel, channel, ticketTierIds, customCommission } = parsed.data;

        const event = await getEvent(eventId);
        if (!event) return fail("Event not found", 404);

        const hostId = event.hostId || event.creatorId;
        const venueId = event.venueId;

        const [isHostPartner, isVenuePartner] = await Promise.all([
            hostId ? isConnected(promoterId, hostId) : Promise.resolve(false),
            venueId ? isConnected(promoterId, venueId) : Promise.resolve(false),
        ]);

        if (!isHostPartner && !isVenuePartner) {
            return fail("You must be connected with the host or venue to promote this event", 403);
        }

        if (!canPromoterCreateLink(event)) {
            return fail("Event is not available for promoter links", 403);
        }

        const commissionRate = customCommission || event.promoterSettings?.defaultCommission || event.commission || 15;

        const link = await createPromoterLink({
            promoterId,
            promoterName: promoterName || "Promoter",
            eventId,
            eventTitle: event.title,
            campaignLabel: campaignLabel || undefined,
            channel: channel || undefined,
            ticketTierIds: ticketTierIds || [],
            commissionRate,
            commissionType: "percentage",
        });

        return ok({ link, duplicate: false }, "Link created", 201);
    } catch (error: any) {
        console.error("[POST /api/promoter/links]", error);
        if (error.status === 409 || error.message?.includes("already") || error.message?.includes("exists")) {
            const existingLink = error.data?.link || null;
            return ok({ link: existingLink, duplicate: true });
        }
        return fail("Failed to create promoter link");
    }
});

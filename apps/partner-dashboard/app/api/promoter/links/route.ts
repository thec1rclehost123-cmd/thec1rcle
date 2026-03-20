import { NextRequest, NextResponse } from "next/server";
import { EVENT_LIFECYCLE, canPromoterCreateLink } from "@c1rcle/core/events";
import {
    createPromoterLink,
    listPromoterLinks,
    getPromoterStats,
    recordLinkClick,
    deactivateLink
} from "@/lib/server/promoterLinkStore";
import { getEvent } from "@/lib/server/eventStore";
import { isConnected } from "@/lib/server/promoterConnectionStore";
import { verifyAuth } from "@/lib/server/auth";

/**
 * GET /api/promoter/links
 * List promoter's links or event's promoter links
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const eventId = searchParams.get("eventId");
        const isActive = searchParams.get("isActive");
        const limit = parseInt(searchParams.get("limit") || "50");

        const links = await listPromoterLinks({
            promoterId: promoterId || undefined,
            eventId: eventId || undefined,
            isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
            limit
        });

        return NextResponse.json({ links });
    } catch (error: any) {
        console.error("[Promoter Links API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch links" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/promoter/links
 * Create a new promoter link for an event
 */
export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            promoterId,
            promoterName,
            eventId,
            campaignLabel,
            channel,
            ticketTierIds,
            customCommission
        } = body;

        // Validation
        if (!promoterId || !eventId) {
            return NextResponse.json(
                { error: "Missing required fields: promoterId, eventId" },
                { status: 400 }
            );
        }

        // Get event to verify it exists and promoters are enabled
        const event = await getEvent(eventId);
        if (!event) {
            return NextResponse.json(
                { error: "Event not found" },
                { status: 404 }
            );
        }

        // 🟢 Connection Verification
        // Only allow if promoter is connected to the event's host or venue
        const hostId = event.hostId || event.creatorId;
        const venueId = event.venueId || event.venueId;

        const [isHostPartner, isVenuePartner] = await Promise.all([
            hostId ? isConnected(promoterId, hostId) : Promise.resolve(false),
            venueId ? isConnected(promoterId, venueId) : Promise.resolve(false)
        ]);

        if (!isHostPartner && !isVenuePartner) {
            return NextResponse.json(
                { error: "You must be connected with the host or venue to promote this event" },
                { status: 403 }
            );
        }

        if (!canPromoterCreateLink(event)) {
            return NextResponse.json(
                { error: "Event is not available for promoter links" },
                { status: 403 }
            );
        }

        // Use custom commission if provided and allowed, otherwise use event default
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
            commissionType: "percentage"
        });

        // 409 from gateway = duplicate — return existing link with flag
        return NextResponse.json({ link, duplicate: false }, { status: 201 });
    } catch (error: any) {
        console.error("[Promoter Links API] POST Error:", error);
        if (error.status === 409 || error.message?.includes("already") || error.message?.includes("exists")) {
            // Gateway returned existing link in error body
            const existingLink = error.data?.link || null;
            return NextResponse.json({ link: existingLink, duplicate: true }, { status: 200 });
        }
        return NextResponse.json(
            { error: error.message || "Failed to create promoter link" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
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
        const clubId = event.venueId || event.clubId;

        const [isHostPartner, isClubPartner] = await Promise.all([
            hostId ? isConnected(promoterId, hostId) : Promise.resolve(false),
            clubId ? isConnected(promoterId, clubId) : Promise.resolve(false)
        ]);

        if (!isHostPartner && !isClubPartner) {
            return NextResponse.json(
                { error: "You must be connected with the host or venue to promote this event" },
                { status: 403 }
            );
        }

        if (!event.promoterSettings?.enabled && event.promoterSettings?.enabled !== undefined) {
            return NextResponse.json(
                { error: "Promoter sales are not enabled for this event" },
                { status: 403 }
            );
        }

        // Check event lifecycle - only published events
        const allowedLifecycles = ["scheduled", "live", "approved"];
        if (event.lifecycle && !allowedLifecycles.includes(event.lifecycle)) {
            return NextResponse.json(
                { error: "Event is not available for promoter links yet" },
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
            ticketTierIds: ticketTierIds || [],
            commissionRate,
            commissionType: "percentage"
        });

        return NextResponse.json({ link }, { status: 201 });
    } catch (error: any) {
        console.error("[Promoter Links API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create promoter link" },
            { status: error.message?.includes("already have") ? 409 : 500 }
        );
    }
}

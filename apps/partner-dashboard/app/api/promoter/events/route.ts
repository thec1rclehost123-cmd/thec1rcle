import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/server/eventStore";
import { getApprovedPartnerIds } from "@/lib/server/promoterConnectionStore";

/**
 * GET /api/promoter/events
 * List events available for promoters to sell
 * Only shows events from connected hosts/venues with promoter commissions enabled
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get("city") || undefined;
        const limit = parseInt(searchParams.get("limit") || "20");
        const promoterId = searchParams.get("promoterId");

        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        const { listEventsForPromoter } = await import("@/lib/server/eventStore");
        const events = await listEventsForPromoter({
            promoterId,
            city,
            limit: 100 // Get more for manual past-date filtering if needed
        });

        // Additional filter: Check not past (redundant but safe)
        const now = new Date();
        const availableEvents = events.filter(event => {
            const notPast = new Date(event.startDate) >= now;
            return notPast;
        }).slice(0, limit);

        // Return simplified event data for promoter view
        const promoterEvents = availableEvents.map(event => ({
            id: event.id,
            title: event.title,
            summary: event.summary,
            image: event.image,
            date: event.date,
            startDate: event.startDate,
            time: event.time,
            location: event.location,
            venue: event.venue,
            city: event.city,
            category: event.category,
            priceRange: event.priceRange,
            commissionRate: event.promoterSettings?.defaultCommission || 15,
            commissionType: event.promoterSettings?.defaultCommissionType || "percent",
            hostId: event.hostId || event.creatorId,
            venueId: event.venueId || event.venueId,
            tickets: (event.tickets || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                price: t.price,
                promoterEnabled: t.promoterEnabled ?? true,
                promoterCommission: t.promoterCommission || null
            })),
            stats: {
                interested: event.stats?.saves || 0
            }
        }));

        return NextResponse.json({
            events: promoterEvents,
            meta: {
                total: promoterEvents.length
            }
        });
    } catch (error: any) {
        console.error("[Promoter Events API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch events" },
            { status: 500 }
        );
    }
}

import { NextRequest } from "next/server";
import { listEventsForPromoter } from "@/lib/server/eventStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/promoter/events
 * List events available for promoters to sell.
 * Scoped to events from active partnerships only.
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get("city") || undefined;
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
        const promoterId = searchParams.get("promoterId");

        if (!promoterId) {
            return fail("promoterId is required", 400);
        }

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

        return ok({
            events: promoterEvents,
            meta: {
                total: promoterEvents.length
            }
        });
    } catch (error: any) {
        logger.error("promoter/events", "Failed to fetch events", { error: error.message });
        return fail("Failed to fetch events", 500);
    }
});

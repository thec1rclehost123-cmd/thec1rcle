import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { getVenueCalendar, getDateAvailability, blockDate, unblockDate, getOperatingCalendar } from "@/lib/server/calendarStore";
=======
import { getVenueCalendar, getDateAvailability, blockDate, unblockDate, getHostVenueCalendar } from "@/lib/server/calendarStore";
import { checkPartnership } from "@/lib/server/partnershipStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
>>>>>>> origin/staging
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venues/[id]/calendar
 * Get venue availability calendar.
 * view=operating → returns the full daily-aggregated operating calendar (events + slots + blocks),
 *                  same shape as /api/venue/calendar?view=operating. Any authenticated user may read.
 * (default)      → returns raw blocked-date docs for legacy consumers.
 */
export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = ctx?.params?.id as string;
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const view = searchParams.get("view");

        const today = new Date();
        const sDate = startDate || today.toISOString().split("T")[0];
        const eDate = endDate || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Operating view: full rich calendar (events + slots + blocks) — any authenticated host can read
        if (view === "operating") {
            const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
            const data = await getOperatingCalendar(venueId, "venue", sDate, eDate, token);
            return NextResponse.json(data);
        }

        // Legacy: raw blocked-date docs
        const hostId = searchParams.get("hostId");
<<<<<<< HEAD
        const calendar = await getVenueCalendar(venueId, sDate, eDate, hostId || undefined);
=======

        if (!startDate || !endDate) {
            // Default to next 30 days
            const today = new Date();
            const defaultStart = today.toISOString().split("T")[0];
            const defaultEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                .toISOString().split("T")[0];

            const hasVenueAccess = await verifyPartnerAccess(req, venueId);
            const effectiveHostId = hostId || (auth as any).partnerId || (auth as any).uid;

            if (!hasVenueAccess) {
                const hasPartnership = await checkPartnership(effectiveHostId, venueId);
                if (!hasPartnership) {
                    return fail("No active partnership with this venue. Access denied.", 403);
                }
                const calendar = await getHostVenueCalendar(venueId, defaultStart, defaultEnd, effectiveHostId);
                return ok({ calendar });
            }

            const calendar = await getVenueCalendar(venueId, defaultStart, defaultEnd, hostId || undefined);
            return ok({ calendar });
        }

        // Security: venue owners/staff may always view their own venue calendar.
        // Otherwise require the host to have an active partnership.
        const hasVenueAccess = await verifyPartnerAccess(req, venueId);
        if (!hasVenueAccess) {
            const token = auth as any;
            const effectiveHostId = hostId || token.partnerId || token.uid;
            const hasPartnership = await checkPartnership(effectiveHostId, venueId);

            if (!hasPartnership) {
                return fail("No active partnership with this venue. Access denied.", 403);
            }

            const calendar = await getHostVenueCalendar(venueId, startDate, endDate, effectiveHostId);
            return ok({ calendar });
        }

        const calendar = await getVenueCalendar(venueId, startDate, endDate, hostId || undefined);

>>>>>>> origin/staging
        return ok({ calendar });
    } catch (error: any) {
        console.error("[Calendar API] GET Error:", error);
        return fail("Failed to fetch calendar");
    }
});

/**
 * POST /api/venues/[id]/calendar
 * Block or unblock a date (venue action only)
 */
export const POST = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const venueId = ctx?.params?.id as string;
        const body = await req.json();
        const { action, date, reason, actor } = body;

        if (!actor || !actor.uid || !actor.role) {
            return fail("Actor information required", 400);
        }

        // Security: Ensure actor UID matches authenticated user
        if (actor.uid !== auth.uid) {
            return fail("Actor UID mismatch", 403);
        }

        // Verify actor is from this venue
        if (actor.role !== "venue" && actor.role !== "admin") {
            return fail("Only venue managers can modify the calendar", 403);
        }

        if (!date) return fail("Date is required", 400);

        let result;

        switch (action) {
            case "block":
                result = await blockDate(venueId, date, reason || "", actor);
                break;

            case "unblock":
                result = await unblockDate(venueId, date, actor);
                break;

            case "availability":
                result = await getDateAvailability(venueId, date);
                break;

            default:
                return fail("Invalid action. Use: block, unblock, or availability", 400);
        }

        return ok({ result });
    } catch (error: any) {
        console.error("[Calendar API] POST Error:", error);
        return fail("Failed to update calendar");
    }
});

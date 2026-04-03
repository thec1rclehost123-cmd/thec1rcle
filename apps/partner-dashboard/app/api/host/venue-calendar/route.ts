/**
 * Host Venue Calendar API
 * Returns a privacy-restricted view of a venue's calendar for hosts
 * Shows: blocked dates, unavailable slots (no event details), host's own requests
 */

import { NextRequest, NextResponse } from "next/server";
import { getHostVenueCalendar, getDateAvailability } from "@/lib/server/calendarStore";
import { validatePartnership } from "@/lib/rbac/validatePartnership";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { resolveHostVenueSelection } from "@/lib/server/partnershipStore";
import { fail } from "@/lib/server/apiResponse";

export async function GET(request: NextRequest) {
    const ctx = await requireHostAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    try {
        const { searchParams } = new URL(request.url);
        const requestedVenueId = searchParams.get("venueId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const date = searchParams.get("date");

        if (!requestedVenueId) return fail("venueId is required", 400);

        const resolvedVenue = await resolveHostVenueSelection(hostId, requestedVenueId);
        const venueId = resolvedVenue?.venueId || requestedVenueId;

        // Validate host-venue partnership
        const calendarAccess: "full" = "full";
        const { valid, reason } = await validatePartnership(hostId, venueId);
        if (!valid) {
            return fail(reason || "No active venue partnership", 403);
        }

        // Single date availability check
        if (date) {
            const availability = await getDateAvailability(venueId, date);
            return NextResponse.json({ availability, calendarAccess });
        }

        // Date range calendar view
        if (!startDate || !endDate) {
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

            const calendar = await getHostVenueCalendar(venueId, defaultStart, defaultEnd, hostId);
            return NextResponse.json({ calendar, startDate: defaultStart, endDate: defaultEnd, calendarAccess });
        }

        const calendar = await getHostVenueCalendar(venueId, startDate, endDate, hostId);
        return NextResponse.json({ calendar, startDate, endDate, calendarAccess });
    } catch (err: any) {
        console.error("[Host Venue Calendar API] Error:", err);
        return fail(err.message || "Failed to fetch calendar");
    }
}

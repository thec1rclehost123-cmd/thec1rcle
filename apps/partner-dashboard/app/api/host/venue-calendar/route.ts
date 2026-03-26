/**
 * Host Venue Calendar API
 * Returns a privacy-restricted view of a venue's calendar for hosts
 * Shows: blocked dates, unavailable slots (no event details), host's own requests
 */

import { NextRequest, NextResponse } from "next/server";
import { getHostVenueCalendar, getVenueCalendar, getDateAvailability } from "@/lib/server/calendarStore";
import { validatePartnership } from "@/lib/rbac/validatePartnership";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

export const GET = withAuth(async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get("venueId");
        const hostId = searchParams.get("hostId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const date = searchParams.get("date"); // For single date availability

        if (!venueId) return fail("venueId is required", 400);

        // Validate host-venue partnership and resolve tier
        let calendarAccess: "full" | "limited" = "full";
        if (hostId && isFirebaseConfigured()) {
            const { valid, tier, reason } = await validatePartnership(hostId, venueId);
            if (!valid) {
                return fail(reason || "No active venue partnership", 403);
            }
            calendarAccess = tier === "trusted" ? "full" : "limited";
        }

        // Single date availability check
        if (date) {
            const availability = await getDateAvailability(venueId, date);
            return NextResponse.json({ availability, calendarAccess });
        }

        // Date range calendar view
        if (!startDate || !endDate) {
            // Default to current month
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

            const calendar = await getHostVenueCalendar(venueId, defaultStart, defaultEnd, hostId || null);
            return NextResponse.json({
                calendar,
                startDate: defaultStart,
                endDate: defaultEnd,
                calendarAccess,
            });
        }

        const calendar = await getHostVenueCalendar(venueId, startDate, endDate, hostId || null);

        return NextResponse.json({
            calendar,
            startDate,
            endDate,
            calendarAccess,
        });
    } catch (err: any) {
        console.error("[Host Venue Calendar API] Error:", err);
        return fail(err.message || "Failed to fetch calendar");
    }
});

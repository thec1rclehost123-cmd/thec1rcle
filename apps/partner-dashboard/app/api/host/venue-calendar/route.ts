/**
 * Host Venue Calendar API
 * Returns a privacy-restricted view of a venue's calendar for hosts
 * Shows: blocked dates, unavailable slots (no event details), host's own requests
 */

import { NextRequest, NextResponse } from "next/server";
import { getVenueCalendar, getDateAvailability } from "@/lib/server/calendarStore";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get("venueId");
        const hostId = searchParams.get("hostId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const date = searchParams.get("date"); // For single date availability

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        // Single date availability check
        if (date) {
            const availability = await getDateAvailability(venueId, date);
            return NextResponse.json({ availability });
        }

        // Date range calendar view
        if (!startDate || !endDate) {
            // Default to current month
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

            const calendar = await getVenueCalendar(venueId, defaultStart, defaultEnd, hostId || undefined);
            return NextResponse.json({
                calendar,
                startDate: defaultStart,
                endDate: defaultEnd
            });
        }

        const calendar = await getVenueCalendar(venueId, startDate, endDate, hostId || undefined);

        return NextResponse.json({
            calendar,
            startDate,
            endDate
        });

    } catch (err: any) {
        console.error("[Host Venue Calendar API] Error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch calendar" }, { status: 500 });
    }
}

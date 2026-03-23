/**
 * GET /api/venue/overview/next-event-intelligence?venueId=
 * Returns next upcoming event + segmented guest counts for venue home screen.
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getNextEventIntelligence } from "@/lib/server/eventIntelligenceStore";

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "guestlist:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const data = await getNextEventIntelligence(ctx.venueId);

        if (!data) {
            return NextResponse.json({ intelligence: null }, {
                headers: { "Cache-Control": "private, max-age=60" },
            });
        }

        // Mask payout amounts if policy disallows
        if (!ctx.piiPolicy.showOrderAmount) {
            // Remove tier count details for non-privileged staff
            data.byTier = data.byTier.map((t) => ({ ...t, count: 0 }));
        }

        return NextResponse.json(
            { intelligence: data },
            { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
        );
    } catch (err: any) {
        console.error("[next-event-intelligence GET]", err.message);
        return NextResponse.json({ error: "Failed to fetch event intelligence" }, { status: 500 });
    }
}

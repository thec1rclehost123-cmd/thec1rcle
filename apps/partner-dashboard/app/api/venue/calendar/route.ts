import { NextRequest, NextResponse } from "next/server";
import { getUnifiedVenueCalendar, blockDate, unblockDate, getOperatingCalendar } from "@/lib/server/calendarStore";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { fail } from "@/lib/server/apiResponse";

export async function GET(req: NextRequest) {
    try {
        const ctx = await requireVenueAccess(req, "calendar:read");
        if ("error" in ctx) {
            console.warn("[Calendar API] Access denied:", ctx.error);
            return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        }

        const { searchParams } = new URL(req.url);
        const view = searchParams.get("view") || "classic";
        const startDate = searchParams.get("startDate") || new Date().toISOString().split('T')[0];
        const endDate = searchParams.get("endDate") || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const venueId = ctx.venueId; // This is the partnerId (venue or host)

        if (view === "operating") {
            const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
            const data = await getOperatingCalendar(venueId, "venue", startDate, endDate, token);
            return NextResponse.json(data);
        }

        const data = await getUnifiedVenueCalendar(venueId, startDate, endDate);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Calendar API] GET Error:", error);
        return fail("Failed to fetch calendar: " + (error.message || "Unknown error"));
    }
}


export async function POST(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "calendar:block_slot");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const body = await req.json();
        const { action, date, reason } = body;
        const venueId = ctx.venueId;

        if (action === "block") {
            const result = await blockDate(venueId, date, reason, {
                uid: ctx.uid,
                role: "venue",
            }, body.startTime, body.endTime);
            return NextResponse.json({ success: true, entry: result });
        }

        if (action === "unblock") {
            const result = await unblockDate(venueId, date, {
                uid: ctx.uid,
                role: "venue",
            });
            return NextResponse.json({ success: true, entry: result });
        }

        return fail("Invalid action", 400);
    } catch (error: any) {
        console.error("Error updating calendar:", error);
        return fail("Failed to update calendar");
    }
}

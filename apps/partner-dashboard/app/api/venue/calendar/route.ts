import { NextRequest, NextResponse } from "next/server";
import { getUnifiedVenueCalendar, blockDate, unblockDate, getOperatingCalendar } from "@/lib/server/calendarStore";
import { requireAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const hostId = searchParams.get("hostId");
        const view = searchParams.get("view") || "classic";
        const startDate = searchParams.get("startDate") || new Date().toISOString().split('T')[0];
        const endDate = searchParams.get("endDate") || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`[API][Calendar] Request: view=${view}, venueId=${venueId}, hostId=${hostId}, start=${startDate}`);

        let partnerId = venueId || hostId;
        if (!partnerId) return fail("Either venueId or hostId is required", 400);

        const { verifyPartnerAccess } = await import("@/lib/server/auth");
        const isManager = await verifyPartnerAccess(req, partnerId);

        const role = (venueId && isManager) ? "venue" : "host";
        const targetId = partnerId;

        if (view === "operating") {
            const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
            const data = await getOperatingCalendar(targetId, role, startDate, endDate, token);
            return NextResponse.json(data);
        }

        const data = await getUnifiedVenueCalendar(targetId, startDate, endDate);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error fetching unified calendar:", error);
        return fail("Failed to fetch calendar");
    }
}


export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const { action, venueId, date, reason } = body;

        const { verifyPartnerAccess } = await import("@/lib/server/auth");
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("No management access to this venue", 403);

        if (action === "block") {
            const result = await blockDate(venueId, date, reason, {
                uid: auth.uid,
                role: "venue",
            }, body.startTime, body.endTime);
            return NextResponse.json({ success: true, entry: result });
        }

        if (action === "unblock") {
            const result = await unblockDate(venueId, date, {
                uid: auth.uid,
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

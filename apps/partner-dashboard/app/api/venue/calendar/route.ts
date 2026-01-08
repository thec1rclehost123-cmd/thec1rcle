import { NextRequest, NextResponse } from "next/server";
import { getUnifiedVenueCalendar, blockDate, unblockDate, getOperatingCalendar } from "@/lib/server/calendarStore";

import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const hostId = searchParams.get("hostId");
        const view = searchParams.get("view") || "classic";
        const startDate = searchParams.get("startDate") || new Date().toISOString().split('T')[0];
        const endDate = searchParams.get("endDate") || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Determine Identity & Mode
        let partnerId = venueId || hostId;
        if (!partnerId) {
            return NextResponse.json({ error: "Either venueId or hostId is required" }, { status: 400 });
        }

        // 2. Identify Role & Access
        // Note: If a host requests a venueId, we treat it as 'host' role viewing that venue (Anonymized)
        // If they request their own hostId, they see their schedule.
        const { verifyPartnerAccess } = await import("@/lib/server/auth");
        const isManager = await verifyPartnerAccess(req, partnerId);

        // Role is 'venue' only if they have management access to that venueId
        const role = (venueId && isManager) ? "venue" : "host";
        const targetId = partnerId;

        if (view === "operating") {
            const data = await getOperatingCalendar(targetId, role, startDate, endDate);
            return NextResponse.json(data);
        }

        // Legacy / Unified view
        const data = await getUnifiedVenueCalendar(targetId, startDate, endDate);
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Error fetching unified calendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { action, venueId, date, reason } = body;

        // Security: Verify user can manage this specific club
        const { verifyPartnerAccess } = await import("@/lib/server/auth");
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) {
            return NextResponse.json({ error: "No management access to this venue" }, { status: 403 });
        }

        if (action === "block") {
            const result = await blockDate(venueId, date, reason, {
                uid: decodedToken.uid,
                role: "venue",
            }, body.startTime, body.endTime);
            return NextResponse.json({ success: true, entry: result });
        }

        if (action === "unblock") {
            const result = await unblockDate(venueId, date, {
                uid: decodedToken.uid,
                role: "venue",
            });
            return NextResponse.json({ success: true, entry: result });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Error updating calendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

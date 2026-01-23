import { NextRequest, NextResponse } from "next/server";
import { getVenueSOSAlerts, resolveSOSAlert } from "@/lib/server/securityStore";

/**
 * GET /api/venue/security/alerts
 * Fetches active SOS alerts for the venue
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const alerts = await getVenueSOSAlerts(venueId);
        return NextResponse.json({ alerts });

    } catch (error: any) {
        console.error("[Safety Alerts API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/venue/security/alerts/resolve
 * Resolves an SOS alert
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { alertId, resolvedBy } = body;

        if (!alertId) {
            return NextResponse.json({ error: "alertId is required" }, { status: 400 });
        }

        await resolveSOSAlert(alertId, resolvedBy || "System");
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("[Resolve Alert API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

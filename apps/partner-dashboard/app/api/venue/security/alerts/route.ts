import { NextRequest } from "next/server";
import { getVenueSOSAlerts, resolveSOSAlert } from "@/lib/server/securityStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/security/alerts
 * Fetches active SOS alerts for the venue
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) return fail("venueId is required", 400);

        const alerts = await getVenueSOSAlerts(venueId);
        return ok({ alerts });
    } catch (error: any) {
        console.error("[Safety Alerts API] Error:", error);
        return fail("Failed to fetch security alerts");
    }
});

/**
 * POST /api/venue/security/alerts
 * Resolves an SOS alert
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { alertId, resolvedBy } = body;
        if (!alertId) return fail("alertId is required", 400);

        await resolveSOSAlert(alertId, resolvedBy || "System");
        return ok({ success: true }, "Alert resolved");
    } catch (error: any) {
        console.error("[Resolve Alert API] Error:", error);
        return fail("Failed to resolve alert");
    }
});

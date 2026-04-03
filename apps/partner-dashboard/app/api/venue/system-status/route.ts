import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/venue/system-status?venueId=
 *
 * Returns server-side feature flag values from system_config/feature_flags.
 * Never trust client-supplied flags — all gating must go through this endpoint.
 *
 * Response shape:
 *   {
 *     payoutsEnabled:              boolean,
 *     messagingSendEnabled:        boolean,
 *     crmOnlineEnabled:            boolean,
 *     analyticsTimeSeriesEnabled:  boolean,
 *   }
 */

const DEFAULTS = {
    payoutsEnabled:             false,
    messagingSendEnabled:       false,
    crmOnlineEnabled:           true,
    analyticsTimeSeriesEnabled: false,
};

export async function GET(request: NextRequest) {
    const ctx = await requireVenueAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const db  = getAdminDb();
        const doc = await db.collection("system_config").doc("feature_flags").get();

        const flags = doc.exists
            ? { ...DEFAULTS, ...(doc.data() as Record<string, boolean>) }
            : DEFAULTS;

        return NextResponse.json(flags, {
            headers: { "Cache-Control": "private, max-age=30" },
        });

    } catch (err: any) {
        console.error("[system-status] Error reading feature flags:", err.message);
        // Safe defaults on error — disable risky features
        return NextResponse.json(DEFAULTS);
    }
}

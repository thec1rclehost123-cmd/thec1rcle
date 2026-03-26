import { NextRequest } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import { ok, fail } from "@/lib/server/apiResponse";
import { withAuth } from "@/lib/server/withAuth";

/**
 * GET /api/venue/presence
 * Fetch presenceConfig from venues/{venueId} directly via Firestore Admin SDK
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) return fail("venueId is required", 400);

        const auth = await verifyAuth(req);
        if (!auth) return fail("Unauthorized", 401);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden", 403);

        const { getAdminDb } = await import("@/lib/firebase/admin");
        const db = getAdminDb();

        console.log("Venue ID:", venueId);
        const docSnap = await db.collection("venues").doc(venueId).get();

        if (!docSnap.exists) {
            return ok({ presenceConfig: null, exists: false } as any);
        }

        const data = docSnap.data();
        console.log("Presence Data:", data?.presenceConfig);

        return ok({ presenceConfig: data?.presenceConfig || null, exists: true } as any);
    } catch (error: any) {
        console.error("[API /venue/presence GET]", error);
        return fail("Failed to fetch presence config");
    }
}

/**
 * POST /api/venue/presence
 * Save presenceConfig to venues/{venueId} with merge (no overwrite of existing fields)
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, presenceConfig } = body;

        if (!venueId || !presenceConfig) return fail("venueId and presenceConfig are required", 400);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden", 403);

        const { getAdminDb } = await import("@/lib/firebase/admin");
        const { FieldValue } = await import("firebase-admin/firestore");
        const db = getAdminDb();

        await db.collection("venues").doc(venueId).set(
            {
                presenceConfig,
                updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
        );

        return ok({} as any, "Presence config saved");
    } catch (error: any) {
        console.error("[API /venue/presence POST]", error);
        return fail("Failed to save presence config");
    }
});

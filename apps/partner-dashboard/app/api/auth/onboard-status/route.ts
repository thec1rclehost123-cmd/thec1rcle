import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/auth/onboard-status?requestId=xxx
 *
 * Returns the status of a specific onboarding request by document ID.
 * Only the authenticated user who owns the request can read it.
 */
export const GET = withAuth(async (req: NextRequest, auth) => {
    try {
        const requestId = req.nextUrl.searchParams.get("requestId");
        if (!requestId) return fail("Missing requestId", 400);

        const db = getAdminDb();
        const doc = await db.collection("onboarding_requests").doc(requestId).get();

        if (!doc.exists) return fail("Not found", 404);

        const data = doc.data()!;

        // Ensure the requesting user owns this document
        if (data.uid !== auth.uid) return fail("Forbidden", 403);

        return ok({ status: data.status as string });
    } catch (error: any) {
        console.error("[Auth API] GET /onboard-status Error:", error);
        return fail("Failed to fetch onboarding status");
    }
});

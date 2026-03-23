import { NextRequest } from "next/server";
import { isFirebaseConfigured, getAdminApp } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        if (isFirebaseConfigured()) {
            const { getAuth } = await import("firebase-admin/auth");
            await getAuth(getAdminApp()).revokeRefreshTokens(auth.uid);
        }

        return ok({});
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/security/logout-all]", error);
        return fail("Failed to revoke sessions");
    }
});

/**
 * POST /api/host/settings/session/revoke
 * Revokes all refresh tokens for the authenticated user,
 * signing them out of all other devices.
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { isFirebaseConfigured, getAdminApp } from "@/lib/firebase/admin";

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        if (isFirebaseConfigured()) {
            const { getAuth } = await import("firebase-admin/auth");
            await getAuth(getAdminApp()).revokeRefreshTokens(auth.uid);
        }
        return ok({ success: true }, "Sessions revoked");
    } catch (error: any) {
        console.error("[POST /api/host/settings/session/revoke]", error);
        return fail("Failed to revoke sessions");
    }
});

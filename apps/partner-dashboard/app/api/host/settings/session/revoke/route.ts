/**
 * POST /api/host/settings/session/revoke
 * Revokes all refresh tokens for the authenticated user,
 * signing them out of all other devices.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { ok, fail } from "@/lib/server/apiResponse";
import { isFirebaseConfigured, getAdminApp } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    const decoded = await verifyAuth(req);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        if (isFirebaseConfigured()) {
            const { getAuth } = await import("firebase-admin/auth");
            await getAuth(getAdminApp()).revokeRefreshTokens(decoded.uid);
        }
        return ok({ success: true }, "Sessions revoked");
    } catch (error: any) {
        console.error("[POST /api/host/settings/session/revoke]", error);
        return fail("Failed to revoke sessions");
    }
}

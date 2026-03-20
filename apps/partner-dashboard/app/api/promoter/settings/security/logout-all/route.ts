import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { isFirebaseConfigured, getAdminApp } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (isFirebaseConfigured()) {
            const { getAuth } = await import("firebase-admin/auth");
            await getAuth(getAdminApp()).revokeRefreshTokens(decodedToken.uid);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/security/logout-all]", error);
        return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/auth/onboard-status?requestId=xxx
 *
 * Returns the status of a specific onboarding request by document ID.
 * Only the authenticated user who owns the request can read it.
 */
export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestId = req.nextUrl.searchParams.get("requestId");
        if (!requestId) {
            return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        const db = getAdminDb();
        const doc = await db.collection("onboarding_requests").doc(requestId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const data = doc.data()!;

        // Ensure the requesting user owns this document
        if (data.uid !== (decodedToken as any).uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ status: data.status as string });
    } catch (error: any) {
        console.error("[Auth API] GET /onboard-status Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

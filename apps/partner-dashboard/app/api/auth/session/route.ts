import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

function errorResponse(req: NextRequest, status: number, message: string, code?: string) {
    return NextResponse.json({
        success: false,
        error: {
            code: code || (status === 401 ? "UNAUTHORIZED" : status === 404 ? "NOT_FOUND" : status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"),
            message,
            requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
        },
    }, { status });
}

/**
 * GET /api/auth/session
 * Returns a sanitized SessionDTO for the authenticated user.
 * Replaces client-side Firestore reads on the login page.
 */
export async function GET(req: NextRequest) {
    const decoded = await verifyAuth(req);
    if (!decoded) {
        return errorResponse(req, 401, "Unauthorized");
    }

    try {
        const db = getAdminDb();
        const userDoc = await db.collection("users").doc(decoded.uid).get();

        if (!userDoc.exists) {
            return errorResponse(req, 404, "User not found");
        }

        const userData = userDoc.data()!;
        const isApproved = userData.isApproved || false;

        let partnerType: string | null = null;
        let onboardingStatus: string | null = null;

        // Resolve partner type from user doc role field
        if (userData.role === "host") partnerType = "host";
        else if (userData.role === "promoter") partnerType = "promoter";
        else if (userData.role === "partner" || userData.venueId) partnerType = "venue";

        // If not resolved from user doc, check onboarding_requests
        if (!partnerType) {
            const snap = await db
                .collection("onboarding_requests")
                .where("uid", "==", decoded.uid)
                .limit(1)
                .get();

            if (!snap.empty) {
                const req = snap.docs[0].data();
                partnerType = req.type || null;
                onboardingStatus = req.status || null;
            }
        }

        return NextResponse.json({
            uid: decoded.uid,
            email: decoded.email || "",
            displayName: userData.displayName || userData.username || "",
            partnerType,
            isApproved,
            onboardingStatus,
        });
    } catch (err) {
        console.error("[/api/auth/session] Error:", err);
        return errorResponse(req, 500, "Internal server error");
    }
}

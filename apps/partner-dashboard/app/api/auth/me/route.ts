import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/auth/me
 *
 * Reads directly from Firestore Admin SDK — no API Gateway dependency.
 * Previously this proxied to localhost:4000/api/v1/auth/me, which caused
 * every logged-in user to be redirected to /onboard whenever the gateway
 * was not running.
 */
export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (decodedToken as any).uid;
        const db = getAdminDb();

        const [userDoc, onboardingSnap] = await Promise.all([
            db.collection("users").doc(userId).get(),
            db.collection("onboarding_requests")
                .where("uid", "==", userId)
                .limit(1)
                .get()
        ]);

        const userData = userDoc.exists ? userDoc.data() : null;
        const onboardingRequest = onboardingSnap.empty
            ? null
            : onboardingSnap.docs[0].data();

        return NextResponse.json({ user: userData, onboardingRequest });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

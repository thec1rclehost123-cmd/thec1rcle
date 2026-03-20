import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const db = getAdminDb();

        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        const reqSnapshot = await db.collection("onboarding_requests")
            .where("uid", "==", userId)
            .limit(1)
            .get();
        const onboardingRequest = reqSnapshot.empty ? null : reqSnapshot.docs[0].data();

        return NextResponse.json({ user: userData, onboardingRequest });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

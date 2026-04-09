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

        // Merge JWT claims (role, admin_role) into the user profile so the
        // client shell can derive nav permissions without a separate token decode.
        // In dev, custom claims may not be set — default to "super" so the UI is accessible.
        const isDev = process.env.NODE_ENV === "development";
        const effectiveRole = decodedToken.role || (isDev ? "admin" : undefined);
        const effectiveAdminRole = decodedToken.admin_role || (isDev ? "super" : undefined);
        const effectiveAdmin = decodedToken.admin ?? (isDev ? true : undefined);

        const mergedUser = userData ? {
            ...userData,
            role: effectiveRole || userData.role,
            admin_role: effectiveAdminRole || userData.admin_role,
            admin: effectiveAdmin ?? userData.admin,
        } : {
            // If Firestore doc doesn't exist yet (new admin user), return minimal profile
            uid: decodedToken.uid,
            email: decodedToken.email || "",
            displayName: decodedToken.name || "Admin",
            role: effectiveRole,
            admin_role: effectiveAdminRole,
            admin: effectiveAdmin,
        };

        return NextResponse.json({ user: mergedUser, onboardingRequest });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

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

        // Resolve the partner name from the venue/host document
        // This is needed because JWT claims don't include the partner name,
        // and without it the event wizard defaults to "Your Venue" placeholder
        if (userData) {
            const partnerId = userData.activeMembership?.partnerId
                || (decodedToken as any).partnerId;
            const partnerType = userData.activeMembership?.partnerType
                || (decodedToken as any).partnerType;

            if (partnerId) {
                try {
                    const collection = (partnerType === 'venue' || partnerType === 'club')
                        ? 'venues' : 'hosts';
                    const partnerDoc = await db.collection(collection).doc(partnerId).get();
                    const partnerData = partnerDoc.exists ? partnerDoc.data() : null;
                    const partnerName = partnerData?.name || partnerData?.displayName
                        || partnerData?.venueName || partnerData?.hostName || null;

                    // Ensure activeMembership object exists and has partnerName
                    if (!userData.activeMembership) {
                        userData.activeMembership = {
                            partnerId,
                            partnerType: partnerType === 'club' ? 'venue' : partnerType,
                            partnerName
                        };
                    } else if (!userData.activeMembership.partnerName && partnerName) {
                        userData.activeMembership.partnerName = partnerName;
                    }
                } catch (partnerErr) {
                    console.warn("[Auth API] Failed to fetch partner name:", partnerErr);
                }
            }
        }

        return NextResponse.json({ user: userData, onboardingRequest });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

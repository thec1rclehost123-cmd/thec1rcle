import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { resolveEffectiveProfile } from "@/lib/server/staffProfileStore";

/**
 * GET /api/auth/me
 *
 * Reads directly from Firestore Admin SDK — no API Gateway dependency.
 * Supports both owner users (activeMembership in users doc / JWT claims)
 * and staff users (membership resolved from partner_memberships collection).
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

        const userData: Record<string, any> | null = userDoc.exists ? { ...userDoc.data() } : null;
        const onboardingRequest = onboardingSnap.empty
            ? null
            : onboardingSnap.docs[0].data();

        // Determine partnerId from JWT claims or users doc
        const claimsPartnerId = (decodedToken as any).partnerId;
        const docPartnerId = userData?.activeMembership?.partnerId;
        let partnerId: string | null = claimsPartnerId || docPartnerId || null;
        let partnerType: string | null = (decodedToken as any).partnerType || userData?.activeMembership?.partnerType || null;

        // ── Staff path: no JWT claims and no activeMembership in users doc ──
        if (!partnerId) {
            const memberSnap = await db
                .collection("partner_memberships")
                .where("uid", "==", userId)
                .where("isActive", "==", true)
                .limit(1)
                .get();

            if (!memberSnap.empty) {
                const memberDoc = memberSnap.docs[0];
                const memberData = memberDoc.data();
                partnerId = memberData.partnerId;
                partnerType = memberData.partnerType;

                // Resolve tab visibility + action permissions + pii policy for non-owners
                let tabVisibility: Record<string, boolean> | null = null;
                let actionPermissions: Record<string, boolean> | null = null;
                let piiPolicy: Record<string, boolean> | null = null;
                if (memberData.role !== "OWNER") {
                    try {
                        const effective = await resolveEffectiveProfile(partnerId!, memberDoc.id);
                        tabVisibility = effective.tabVisibility as Record<string, boolean>;
                        actionPermissions = effective.actionPermissions as Record<string, boolean>;
                        piiPolicy = effective.piiPolicy as Record<string, boolean>;
                    } catch {}
                }

                // Fetch partner name and subscription plan
                let partnerName: string | null = null;
                let subscriptionPlan: string | null = "basic";
                try {
                    const collection = (partnerType === "venue" || partnerType === "club") ? "venues" : "hosts";
                    const partnerDoc = await db.collection(collection).doc(partnerId!).get();
                    const partnerDocData = partnerDoc.data();
                    partnerName = partnerDocData?.name || partnerDocData?.venueName || partnerDocData?.displayName || null;
                    subscriptionPlan = partnerDocData?.subscriptionPlan || partnerDocData?.tier || "basic";
                } catch {}

                // Build or patch userData for staff
                const staffUserData: Record<string, any> = userData
                    ? { ...userData }
                    : {
                          uid: userId,
                          email: (decodedToken as any).email || "",
                          displayName: (decodedToken as any).name || (decodedToken as any).email || "Staff Member",
                          isApproved: true,
                      };

                staffUserData.isApproved = true;
                staffUserData.subscriptionPlan = subscriptionPlan;
                staffUserData.activeMembership = {
                    partnerId,
                    partnerType: partnerType === "club" ? "venue" : partnerType,
                    role: memberData.role,
                    joinedAt: memberData.joinedAt || 0,
                    isActive: true,
                    staffProfileId: memberData.staffProfileId || null,
                    partnerName,
                };
                // Attach resolved permissions as private fields
                staffUserData._staffTabVisibility = tabVisibility;
                staffUserData._staffActionPermissions = actionPermissions;
                staffUserData._staffPiiPolicy = piiPolicy;

                return NextResponse.json({ user: staffUserData, onboardingRequest: null });
            }
        }

        // ── Owner / existing path ─────────────────────────────────────────────
        if (userData && partnerId) {
            try {
                const collection = (partnerType === "venue" || partnerType === "club") ? "venues" : "hosts";
                const partnerDoc = await db.collection(collection).doc(partnerId).get();
                const partnerData = partnerDoc.exists ? partnerDoc.data() : null;
                const partnerName = partnerData?.name || partnerData?.displayName
                    || partnerData?.venueName || partnerData?.hostName || null;

                if (!userData.activeMembership) {
                    userData.activeMembership = {
                        partnerId,
                        partnerType: partnerType === "club" ? "venue" : partnerType,
                        partnerName
                    };
                } else if (!userData.activeMembership.partnerName && partnerName) {
                    userData.activeMembership.partnerName = partnerName;
                }

                // Also attach subscription plan from partner doc if not on user doc
                if (!userData.subscriptionPlan) {
                    userData.subscriptionPlan = partnerData?.subscriptionPlan || partnerData?.tier || "basic";
                }
            } catch (partnerErr) {
                console.warn("[Auth API] Failed to fetch partner name:", partnerErr);
            }
        }

        return NextResponse.json({ user: userData, onboardingRequest });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

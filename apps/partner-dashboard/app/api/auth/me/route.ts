import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/withAuth";
import { getAdminDb } from "@/lib/firebase/admin";
import { resolveEffectiveProfile } from "@/lib/server/staffProfileStore";
import { fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/auth/me
 *
 * Reads directly from Firestore Admin SDK — no API Gateway dependency.
 * Supports both owner users (activeMembership in users doc / JWT claims)
 * and staff users (membership resolved from partner_memberships collection).
 */
export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const userId = auth.uid;
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
        const claimsPartnerId = (auth as any).partnerId;
        const docPartnerId = userData?.activeMembership?.partnerId;
        let partnerId: string | null = claimsPartnerId || docPartnerId || null;
        let partnerType: string | null = (auth as any).partnerType || userData?.activeMembership?.partnerType || null;

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
                          email: (auth as any).email || "",
                          displayName: (auth as any).name || (auth as any).email || "Staff Member",
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
                logger.warn("auth/me", "Failed to fetch partner name", { error: (partnerErr as any)?.message });
            }
        }

        return NextResponse.json({ user: userData, onboardingRequest });
    } catch (error: any) {
        logger.error("auth/me", "GET /me failed", { error: error.message });
        return fail("Failed to load user profile");
    }
}

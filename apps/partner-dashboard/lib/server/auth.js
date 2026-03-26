import { getAdminApp, isFirebaseConfigured } from "../firebase/admin";
import { getAuth } from "firebase-admin/auth";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing.
 * 
 * @param {Request} request - The incoming Next.js request object
 */
export async function verifyAuth(request) {
    console.log("[verifyAuth] Starting authentication check...");
    console.log("[verifyAuth] isFirebaseConfigured:", isFirebaseConfigured());

    if (!isFirebaseConfigured()) {
        // In development without Firebase, we might want to allow requests
        // or mock a user if a specific header is present.
        // For now, we'll return a mock user if in dev mode.
        if (process.env.NODE_ENV === "development") {
            console.log("[verifyAuth] Development mode - returning mock user");
            return {
                uid: "dev-user-123",
                email: "dev@example.com",
                name: "Dev User"
            };
        }
        console.log("[verifyAuth] Firebase not configured and not in dev mode - returning null");
        return null;
    }

    const authHeader = request.headers.get("Authorization");
    console.log("[verifyAuth] Authorization header present:", !!authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("[verifyAuth] Missing or invalid Authorization header");
        return null;
    }

    const token = authHeader.split("Bearer ")[1];
    console.log("[verifyAuth] Token length:", token?.length || 0);
    if (token) {
        console.log("[verifyAuth] Token preview (first 10 chars):", token.substring(0, 10) + "...");
    }

    try {
        const app = getAdminApp();
        if (!app) throw new Error("Firebase Admin App not initialized");
        console.log("[verifyAuth] Admin app initialized, project:", app.options?.projectId || "unknown");

        const auth = getAuth(app);
        console.log("[verifyAuth] Verifying ID token...");

        // Verify the token - Don't check for revocation to speed up verification
        const decodedToken = await auth.verifyIdToken(token, false);

        console.log("[verifyAuth] Token verified successfully for uid:", decodedToken.uid);
        console.log("[verifyAuth] Token audience:", decodedToken.aud);
        console.log("[verifyAuth] Token issuer:", decodedToken.iss);

        return decodedToken;
    } catch (error) {
        console.error("[verifyAuth] Auth verification failed:");
        console.error("  - Code:", error.code);
        console.error("  - Message:", error.message);
        if (error.code === 'auth/id-token-expired') {
            console.error("  - HINT: Token has expired. Client should refresh the token.");
        } else if (error.code === 'auth/argument-error') {
            console.error("  - HINT: Token format is invalid. Check if client is sending correct token.");
        } else if (error.code === 'auth/invalid-credential') {
            console.error("  - HINT: Firebase Admin SDK credentials may be invalid.");
        }
        return null;
    }
}

/**
 * Verify if the user has a host role.
 * 
 * @param {Request} request 
 * @returns {Promise<boolean>}
 */
export async function verifyHostRole(request) {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) return false;

    // In development without Firebase, assume dev-user is a host
    if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
        return true;
    }

    try {
        const { getAdminDb } = await import("../firebase/admin");
        const db = getAdminDb();
        const hostDoc = await db.collection("hosts").doc(decodedToken.uid).get();
        return hostDoc.exists;
    } catch (error) {
        console.error("Role verification failed:", error);
        return false;
    }
}

/**
 * Verify if the user has a club owner or admin role (Elevated Permissions).
 */
export async function verifyElevatedRole(request) {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) return false;

    if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
        return true;
    }

    try {
        const { getAdminDb } = await import("../firebase/admin");
        const db = getAdminDb();

        // Check if user is a Venue owner or Admin
        const clubDoc = await db.collection("venues").where("ownerId", "==", decodedToken.uid).limit(1).get();
        if (!clubDoc.empty) return true;

        const adminDoc = await db.collection("admins").doc(decodedToken.uid).get();
        if (adminDoc.exists) return true;

        return false;
    } catch (error) {
        console.error("Elevated role verification failed:", error);
        return false;
    }
}

/**
 * PRODUCTION HARDENING: Unified Permission Check
 * Verifies if user can manage a specific partnerId (Venue or Host)
 */
export async function verifyPartnerAccess(request, partnerId) {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
        console.log("[verifyPartnerAccess] No decoded token found");
        return false;
    }

    if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
        console.log("[verifyPartnerAccess] Dev mode: bypassing for dev-user-123");
        return true;
    }

    const { uid } = decodedToken;

    console.log("[debug] verifyPartnerAccess partnerId:", partnerId);
    if (!partnerId || typeof partnerId !== "string") {
        console.error("[Firestore] Invalid partnerId in verifyPartnerAccess:", partnerId);
        return false;
    }

    const { getAdminDb } = await import("../firebase/admin");
    const db = getAdminDb();

    console.log(`[verifyPartnerAccess] Checking access for uid: ${uid} on partnerId: ${partnerId}`);

    try {
        // 1. Check if user is the direct owner of the venue/host
        const venueDoc = await db.collection("venues").doc(partnerId).get();
        if (venueDoc.exists) {
            const venueData = venueDoc.data();
            console.log(`[verifyPartnerAccess] Venue found. OwnerId: ${venueData.ownerId}`);
            if (venueData.ownerId === uid) {
                console.log("[verifyPartnerAccess] Access granted: Direct Owner");
                return true;
            }
        }

        const hostDoc = await db.collection("hosts").doc(partnerId).get();
        if (hostDoc.exists) {
            const hostData = hostDoc.data();
            console.log(`[verifyPartnerAccess] Host found. OwnerId: ${hostData.ownerId}`);
            if (hostData.ownerId === uid) {
                console.log("[verifyPartnerAccess] Access granted: Direct Owner");
                return true;
            }
        }

        // 2. Check if user is a verified staff member with management permissions
        console.log("[verifyPartnerAccess] Checking partner_memberships...");
        const membershipSnapshot = await db.collection("partner_memberships")
            .where("partnerId", "==", partnerId)
            .where("uid", "==", uid)
            .limit(1)
            .get();

        if (!membershipSnapshot.empty) {
            const membershipData = membershipSnapshot.docs[0].data();
            console.log(`[verifyPartnerAccess] Membership found: role=${membershipData.role}, status=${membershipData.status}, isActive=${membershipData.isActive}`);

            const isActive = membershipData.isActive === true || membershipData.status === 'active';

            if (isActive) {
                const role = (membershipData.role || "").toLowerCase();
                const managementRoles = ["manager", "ops", "owner"];
                if (managementRoles.includes(role)) {
                    console.log("[verifyPartnerAccess] Access granted: Management Staff");
                    return true;
                } else {
                    console.log(`[verifyPartnerAccess] Role '${role}' does not have management permissions`);
                }
            } else {
                console.log("[verifyPartnerAccess] Membership is not active");
            }
        } else {
            console.log("[verifyPartnerAccess] No membership found for this partner and user");
        }

        // 3. Check if user is a system admin
        const adminDoc = await db.collection("admins").doc(uid).get();
        if (adminDoc.exists) {
            console.log("[verifyPartnerAccess] Access granted: System Admin");
            return true;
        }

        console.log("[verifyPartnerAccess] Access DENIED - no valid matching found");
        return false;
    } catch (err) {
        console.error("[verifyPartnerAccess] CRITICAL ERROR:", err);
        return false;
    }
}

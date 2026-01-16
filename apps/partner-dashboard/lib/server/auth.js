import { getAdminApp, isFirebaseConfigured } from "../firebase/admin";
import { getAuth } from "firebase-admin/auth";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing.
 * 
 * @param {Request} request - The incoming Next.js request object
 */
export async function verifyAuth(request) {
    if (!isFirebaseConfigured()) {
        // In development without Firebase, we might want to allow requests
        // or mock a user if a specific header is present.
        // For now, we'll return a mock user if in dev mode.
        if (process.env.NODE_ENV === "development") {
            return {
                uid: "dev-user-123",
                email: "dev@example.com",
                name: "Dev User"
            };
        }
        return null;
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.split("Bearer ")[1];

    try {
        const app = getAdminApp();
        const auth = getAuth(app);
        const decodedToken = await auth.verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error("Auth verification failed:", error);
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
    if (!decodedToken) return false;

    if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
        return true;
    }

    const { uid } = decodedToken;
    const { getAdminDb } = await import("../firebase/admin");
    const db = getAdminDb();

    try {
        // 1. Check if user is the direct owner of the venue/host
        const venueDoc = await db.collection("venues").doc(partnerId).get();
        if (venueDoc.exists && venueDoc.data().ownerId === uid) return true;

        const hostDoc = await db.collection("hosts").doc(partnerId).get();
        if (hostDoc.exists && hostDoc.data().ownerId === uid) return true;

        // 2. Check if user is a verified staff member with management permissions
        const membershipSnapshot = await db.collection("partner_memberships")
            .where("partnerId", "==", partnerId)
            .where("uid", "==", uid)
            .limit(1)
            .get();

        if (!membershipSnapshot.empty) {
            const membershipData = membershipSnapshot.docs[0].data();
            const isActive = membershipData.isActive === true || membershipData.status === 'active';

            if (isActive) {
                // Managers, Ops and Owners carry management authority
                const role = (membershipData.role || "").toLowerCase();
                const managementRoles = ["manager", "ops", "owner"];
                if (managementRoles.includes(role)) return true;
            }
        }

        // 3. Check if user is a system admin
        const adminDoc = await db.collection("admins").doc(uid).get();
        if (adminDoc.exists) return true;

        return false;
    } catch (err) {
        console.error("verifyPartnerAccess error:", err);
        return false;
    }
}

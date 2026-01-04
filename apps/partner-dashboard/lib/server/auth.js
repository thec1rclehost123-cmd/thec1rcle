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

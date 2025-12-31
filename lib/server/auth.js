import { getAdminApp, isFirebaseConfigured } from "../firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, or null if invalid/missing.
 * 
 * @param {Request} [request] - The incoming Next.js request object (optional for Server Actions)
 */
export async function verifyAuth(request) {
    if (!isFirebaseConfigured()) {
        if (process.env.NODE_ENV === "development") {
            return {
                uid: "TraOjbiHwiOauY5ymPhSi3b6ODv1", // Use the actual dev UID for Aayush
                email: "aayushdivase2020333@gmail.com",
                name: "Aayush Divase"
            };
        }
        return null;
    }

    let authHeader;
    if (request) {
        authHeader = request.headers.get("Authorization");
    } else {
        const headerList = await headers();
        authHeader = headerList.get("Authorization");
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        if (process.env.NODE_ENV === "development") {
            return {
                uid: "TraOjbiHwiOauY5ymPhSi3b6ODv1",
                email: "aayushdivase2020333@gmail.com",
                name: "Aayush Divase"
            };
        }
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
        if (process.env.NODE_ENV === "development") {
            return {
                uid: "TraOjbiHwiOauY5ymPhSi3b6ODv1",
                email: "aayushdivase2020333@gmail.com",
                name: "Aayush Divase"
            };
        }
        return null;
    }
}

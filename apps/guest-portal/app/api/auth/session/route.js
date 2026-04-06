
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

/**
 * THE C1RCLE - Session Sync API
 * Converts a Firebase ID Token into a secure __session cookie.
 * This ensures the server-side verifyAuth (middleware/api) recognizes the user.
 */
export async function POST(request) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            // If no token provided, clear the session
            const cookieStore = await cookies();
            cookieStore.set("__session", "", {
                maxAge: -1,
                path: "/",
            });
            return NextResponse.json({ success: true, message: "Session cleared" });
        }

        // Verify the token with Firebase Admin
        const app = getAdminApp();
        const auth = getAuth(app);
        const decodedToken = await auth.verifyIdToken(idToken);

        // Security: Ensure the user isn't blocked (Optional: standard verifyAuth handles this too)
        
        // Set the secure __session cookie (Next.js/Firebase standard)
        const cookieStore = await cookies();
        cookieStore.set("__session", idToken, {
            maxAge: 60 * 60 * 24 * 5, // 5 days
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });

        return NextResponse.json({ 
            success: true, 
            uid: decodedToken.uid,
            message: "Session synchronized" 
        });

    } catch (error) {
        console.error("[Session API] Error:", error.message);
        return NextResponse.json(
            { error: "Failed to synchronize session" },
            { status: 401 }
        );
    }
}

export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.set("__session", "", {
        maxAge: -1,
        path: "/",
    });
    return NextResponse.json({ success: true });
}

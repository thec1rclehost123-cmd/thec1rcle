import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@c1rcle/core/admin";
import { FieldValue } from "firebase-admin/firestore";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, phone } = body;

        if (!email || !password) return fail("Email and password are required.", 400);
        if (typeof password !== "string" || password.length < 8)
            return fail("Password must be at least 8 characters.", 400);

        const adminAuth = getAdminAuth();

        let uid: string;
        try {
            const user = await adminAuth.createUser({ email, password });
            uid = user.uid;
        } catch (err: any) {
            if (err.code === "auth/email-already-exists") {
                return fail("This email is already registered. Please log in first.", 409);
            }
            throw err;
        }

        // Mark email (and phone if provided) as verified in Firestore immediately.
        // This lets the onboard route's alreadyVerified bypass skip the otp_completions
        // check — which would otherwise fail if the user retries submission.
        const db = getAdminDb();
        if (db) {
            await db.collection("users").doc(uid).set({
                uid,
                email,
                emailVerified: true,
                phoneVerified: !!phone,
                ...(phone && { phoneNumber: phone }),
                role: "onboarding",
                isApproved: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        // Issue a custom token so the client can sign in without a direct Firebase call
        const customToken = await adminAuth.createCustomToken(uid);
        return ok({ customToken, uid });
    } catch (error: any) {
        logger.error("auth/create-account", "Account creation failed", { error: error.message });
        return fail("Failed to create account. Please try again.", 500);
    }
}

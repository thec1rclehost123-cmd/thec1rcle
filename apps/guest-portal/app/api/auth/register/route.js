/**
 * THE C1RCLE - User Registration API
 * Creates Firebase Auth user + writes profile to Firestore directly (reliable in all envs).
 * Also forwards to Gateway for cache/indexing if available.
 */
import { NextResponse } from "next/server";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

export async function POST(req) {
    try {
        const { email, password, name, gender, phone, city } = await req.json();

        console.log(`\n--------------------------------------------`);
        console.log(`[SERVER-TRACE] Registration Attempt: ${email}`);
        console.log(`[SERVER-TRACE] Password length received: ${password?.length || 0}`);
        console.log(`[SERVER-TRACE] Name: ${name}, Phone: ${phone}`);
        if (!password || password.length < 6) console.log(`[SERVER-TRACE] 🚨 REJECTED: PASSWORD TOO SHORT OR MISSING`);
        console.log(`--------------------------------------------\n`);

        if (!email || !password || !name) {
            return NextResponse.json({ error: "Identity data incomplete." }, { status: 400 });
        }

        // 1. Create Firebase Auth User (requires Admin SDK — allowlisted)
        const auth = getAuth(getAdminApp());
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
            phoneNumber: phone || undefined,
            emailVerified: true
        });

        const now = new Date().toISOString();
        const profilePayload = {
            uid: userRecord.uid,
            email,
            displayName: name,
            gender: gender || null,
            phone: phone || null,
            city: city || "",
            photoURL: "",
            attendedEvents: [],
            instagram: "",
            createdAt: now,
            updatedAt: now,
            isVerified: true,
            onboardingComplete: true
        };

        // 2. Write profile directly to Firestore (works in dev without Gateway)
        const db = getAdminDb();
        await db.collection("users").doc(userRecord.uid).set(profilePayload, { merge: true });

        // 3. Forward to Gateway for search indexing (fire-and-forget)
        if (GATEWAY_URL) {
            fetch(`${GATEWAY_URL}/api/v1/users/profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profilePayload)
            }).catch(err => console.warn("[Register] Profile Gateway write failed:", err.message));
        }

        return NextResponse.json({ success: true, uid: userRecord.uid });
    } catch (err) {
        console.error("Final Registration Error:", JSON.stringify(err, null, 2));
        const errorMessage = 
            err.code === "auth/email-already-exists" ? "This identity is already part of the circle." :
            err.code === "auth/invalid-phone-number" || err.message?.includes("phone") ? "The phone number format is invalid. Ensure no leading 0." :
            err.message?.includes("password") || err.message?.includes("TOO_SHORT") ? "Security Policy: Password must be at least 8 characters." :
            "Unable to finalize access.";

        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
}

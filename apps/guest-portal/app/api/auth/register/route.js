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
        console.error("Final Registration Error:", err);
        return NextResponse.json({
            error: err.code === "auth/email-already-exists"
                ? "This identity is already part of the circle."
                : "Unable to finalize access."
        }, { status: 400 });
    }
}

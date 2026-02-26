/**
 * THE C1RCLE - User Registration API
 * Creates Firebase Auth user (Admin SDK required) + delegates profile creation to Gateway
 */
import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

export async function POST(req) {
    try {
        const { email, password, name, gender, phone } = await req.json();

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

        // 2. Create profile via Gateway (no direct Firestore)
        if (GATEWAY_URL) {
            const now = new Date().toISOString();
            await fetch(`${GATEWAY_URL}/api/v1/users/profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: userRecord.uid,
                    email,
                    displayName: name,
                    gender: gender || null,
                    phone: phone || null,
                    photoURL: "",
                    attendedEvents: [],
                    city: "",
                    instagram: "",
                    createdAt: now,
                    updatedAt: now,
                    isVerified: true
                })
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

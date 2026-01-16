
import { NextResponse } from "next/server";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

export async function POST(req) {
    try {
        const { email, password, name, gender, phone } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: "Identity data incomplete." }, { status: 400 });
        }

        const auth = getAuth(getAdminApp());
        const db = getAdminDb();

        // 1. Create Firebase Auth User
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
            phoneNumber: phone, // This requires the phone to be in E.164 format
            emailVerified: true
        });

        // 2. Create Firestore Profile
        const now = new Date().toISOString();
        const profile = {
            uid: userRecord.uid,
            email,
            displayName: name,
            gender,
            phone,
            photoURL: "",
            attendedEvents: [],
            city: "",
            instagram: "",
            createdAt: now,
            updatedAt: now,
            isVerified: true
        };

        await db.collection("users").doc(userRecord.uid).set(profile);

        // 3. Optional: Create custom claims if needed
        // await auth.setCustomUserClaims(userRecord.uid, { member: true });

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

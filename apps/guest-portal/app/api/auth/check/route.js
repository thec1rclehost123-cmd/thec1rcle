import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";

export async function POST(req) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const auth = getAuth(getAdminApp());
        try {
            await auth.getUserByEmail(email);
            return NextResponse.json({ exists: true });
        } catch (err) {
            if (err.code === "auth/user-not-found") {
                return NextResponse.json({ exists: false });
            }
            throw err;
        }
    } catch (err) {
        console.error("Auth check error:", err);
        return NextResponse.json({ error: "Check protocol failed" }, { status: 500 });
    }
}

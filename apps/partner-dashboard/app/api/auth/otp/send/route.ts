import { NextRequest, NextResponse } from "next/server";
import { sendEmailOtp, sendSmsOtp } from "@/lib/server/verification";
import { rateLimit } from "@/lib/server/rateLimit";
import { getAdminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    const allowed = await rateLimit(req, 5, 60);
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    try {
        const { type, recipient } = await req.json();

        if (!type || !recipient) {
            return NextResponse.json({ error: "type and recipient are required." }, { status: 400 });
        }

        if (type === "email") {
            // Check if this email already has a Firebase Auth account
            try {
                const existingUser = await getAdminAuth().getUserByEmail(recipient);
                // Account exists — check onboarding status to give a helpful message
                const db = (await import("@/lib/firebase/admin")).getAdminDb();
                const userDoc = await db.collection("users").doc(existingUser.uid).get();
                const userData = userDoc.exists ? userDoc.data() : null;

                if (userData?.isApproved) {
                    return NextResponse.json(
                        { error: "This email is already registered and approved. Please log in." },
                        { status: 409 }
                    );
                } else {
                    // Account exists but not yet approved — pending review
                    return NextResponse.json(
                        { error: "You've already applied with this email. Your application is pending admin review. You'll receive an email once approved." },
                        { status: 409 }
                    );
                }
            } catch (authErr: any) {
                // auth/user-not-found means the email is free — continue
                if (authErr.code !== "auth/user-not-found") throw authErr;
            }

            await sendEmailOtp(recipient);
        } else if (type === "phone") {
            await sendSmsOtp(recipient);
        } else {
            return NextResponse.json({ error: "Invalid type. Must be 'email' or 'phone'." }, { status: 400 });
        }

        // Generic message — never reveal whether email/phone exists
        return NextResponse.json({ message: "If valid, a verification code has been sent." });
    } catch (err: any) {
        console.error("[OTP Send Error]", err);
        return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 });
    }
}

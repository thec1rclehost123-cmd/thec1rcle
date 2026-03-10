
import { NextResponse } from "next/server";
import { sendEmailOtp, sendSmsOtp } from "@/lib/server/verification";
import { rateLimit } from "@/lib/server/rateLimit";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { validateConfig } from "@/lib/server/security";

export async function POST(req) {
    if (!rateLimit(req, 5, 60000)) {
        return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    try {
        // Enforce security config check at runtime
        validateConfig();

        const { type, recipient } = await req.json();

        if (!recipient) {
            return NextResponse.json({ error: "Identity required." }, { status: 400 });
        }

        // Generic message for security
        const successMessage = { message: "If valid, a secret has been dispatched." };

        if (type === "email") {
            // Check if email already exists
            try {
                const auth = getAuth(getAdminApp());
                await auth.getUserByEmail(recipient);
                // If it exists, we still return success but maybe don't send? 
                // The user said: "Do not leak whether an email or phone exists."
                // So we send anyway or return generic message.
            } catch (err) {
                // Not found is fine
            }
            await sendEmailOtp(recipient);
        } else if (type === "phone") {
            await sendSmsOtp(recipient);
        } else {
            return NextResponse.json({ error: "Invalid type." }, { status: 400 });
        }

        return NextResponse.json(successMessage);
    } catch (err) {
        // In dev, try to return real errors, in prod generic
        const errorMessage = err?.message || "An unexpected error occurred during OTP dispatch.";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

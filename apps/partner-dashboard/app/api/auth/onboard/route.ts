import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkAndConsumeOtpCompletions } from "@/lib/server/verification";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const body = await req.json();
        const { type, email, name, phone, entityType } = body;

        if (!type || !email || !name) {
            return NextResponse.json(
                { error: "Missing required fields: type, email, name" },
                { status: 400 }
            );
        }

        const db = getAdminDb();

        // ── OTP Verification Gate ──────────────────────────────────────────────
        // Check that email and phone were verified via OTP before accepting the
        // submission. Skip for dev-mode mock users.
        const isDevMockUser = process.env.NODE_ENV === "development" && userId === "dev-user-123";

        if (!isDevMockUser && phone) {
            // Check if user already has verified contacts (returning user re-submitting)
            const existingUser = await db.collection("users").doc(userId).get();
            const alreadyVerified =
                existingUser.exists &&
                existingUser.data()?.emailVerified === true &&
                existingUser.data()?.phoneVerified === true;

            if (!alreadyVerified) {
                const otpCheck = await checkAndConsumeOtpCompletions(email, phone);
                if (!otpCheck.ok) {
                    return NextResponse.json(
                        { error: otpCheck.reason, code: "OTP_REQUIRED" },
                        { status: 403 }
                    );
                }
            }
        }
        // ──────────────────────────────────────────────────────────────────────

        // Upsert user doc with onboarding role + verified contact flags
        await db.collection("users").doc(userId).set(
            {
                uid: userId,
                email,
                displayName: name,
                role: "onboarding",
                isApproved: false,
                emailVerified: true,
                phoneVerified: !!phone,
                phoneNumber: phone || null,
                onboardingEntityType: entityType || "individual",
                kycStatus: "not_started",
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Create onboarding request
        const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
        await db.collection("onboarding_requests").doc(requestId).set({
            id: requestId,
            uid: userId,
            type,
            entityType: entityType || "individual",
            status: "pending",
            data: { ...body },
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Send submission confirmation email
        if (resend) {
            const fromAddr = process.env.NODE_ENV === "development"
                ? "THE C1RCLE <onboarding@resend.dev>"
                : "THE C1RCLE <noreply@thec1rcle.com>";
            resend.emails.send({
                from: fromAddr,
                to: email,
                subject: "We received your C1RCLE application",
                html: `
                    <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
                        <h1 style="color:#FF5A00;text-transform:uppercase;letter-spacing:5px;">THE C1RCLE</h1>
                        <p style="text-transform:uppercase;letter-spacing:2px;color:#666;font-size:12px;">Application Received</p>
                        <div style="margin:32px auto;max-width:420px;text-align:left;">
                            <p style="font-size:16px;font-weight:600;color:#fff;">Hi ${name},</p>
                            <p style="color:#aaa;font-size:14px;line-height:1.6;">
                                Thanks for applying to join the C1RCLE partner network. We've received your application and our team will review it within <strong style="color:#fff;">24–48 hours</strong>.
                            </p>
                            <p style="color:#aaa;font-size:14px;line-height:1.6;">
                                Once approved, you'll receive another email with instructions to log in and complete your identity verification.
                            </p>
                        </div>
                        <p style="color:#444;font-size:10px;text-transform:uppercase;margin-top:40px;">
                            If you did not submit this application, you can safely ignore this email.
                        </p>
                    </div>
                `,
            }).catch((err: any) => console.error("[onboard] Confirmation email error:", err));
        }

        return NextResponse.json({ success: true, requestId });
    } catch (error: any) {
        console.error("[Auth API] POST /onboard Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

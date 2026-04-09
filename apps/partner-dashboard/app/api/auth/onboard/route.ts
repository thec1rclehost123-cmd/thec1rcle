import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkAndConsumeOtpCompletions } from "@/lib/server/verification";
import { Resend } from "resend";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { escapeHtml } from "@/lib/server/sanitize";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const OnboardSchema = z.object({
    type: z.string().min(1).max(50),
    email: z.string().email().max(200),
    name: z.string().min(1).max(200),
    phone: z.string().optional(),
    entityType: z.string().optional().default("individual"),
    // KYC data submitted during onboarding (optional — submitted together with the application)
    kycStepData: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const userId = auth.uid;
        const body = await req.json();
        const parsed = OnboardSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);
        const { type, email, name, phone, entityType, kycStepData } = parsed.data;

        const db = getAdminDb();

        // ── OTP Verification Gate ──────────────────────────────────────────────
        // Check that email and phone were verified via OTP before accepting the
        // submission. Skip for dev-mode mock users.
        const isDevMockUser = process.env.NODE_ENV === "development" && userId === "dev-user-123";

        if (!isDevMockUser && phone) {
            // Check if user already has verified contacts (returning user re-submitting)
            const existingUser = await db.collection("users").doc(userId).get();
            const alreadyVerified =
                // Firestore flags set by create-account route
                (existingUser.exists &&
                    existingUser.data()?.emailVerified === true &&
                    existingUser.data()?.phoneVerified === true) ||
                // Firebase Auth token's email matches submitted email — the token itself
                // is proof of email ownership (verifyIdToken already confirmed it).
                // This covers: already-signed-in users who skip the email OTP step,
                // and any case where otp_completions records were consumed by a prior attempt.
                (auth.email && auth.email.toLowerCase() === email.toLowerCase());

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

        // Compute KYC step status from submitted data
        const resolvedEntityType = entityType || "individual";
        const stepSequence = resolvedEntityType === "business"
            ? ["kyc_business", "kyc_signatory", "bank_setup"]
            : ["kyc_identity", "bank_setup"];

        const kycStepStatus: Record<string, string> = {};
        let kycStatus = "not_started";
        if (kycStepData && Object.keys(kycStepData).length > 0) {
            stepSequence.forEach((step) => {
                kycStepStatus[step] = kycStepData[step] ? "submitted" : "not_started";
            });
            const allSubmitted = stepSequence.every((s) => kycStepStatus[s] === "submitted");
            kycStatus = allSubmitted ? "fully_submitted" : "partially_submitted";
        }

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
                onboardingEntityType: resolvedEntityType,
                kycStatus,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Create onboarding request (include KYC data if provided)
        const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
        await db.collection("onboarding_requests").doc(requestId).set({
            id: requestId,
            uid: userId,
            type,
            entityType: resolvedEntityType,
            status: "pending",
            data: { ...body, kycStepData: undefined }, // strip KYC from main data blob
            ...(kycStepData && { kycStepData }),
            ...(Object.keys(kycStepStatus).length > 0 && { kycStepStatus }),
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Send submission confirmation email
        if (resend) {
            const safeName = escapeHtml(name);
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
                            <p style="font-size:16px;font-weight:600;color:#fff;">Hi ${safeName},</p>
                            <p style="color:#aaa;font-size:14px;line-height:1.6;">
                                Thanks for applying to join the C1RCLE partner network. We've received your application and our team will review it within <strong style="color:#fff;">24–48 hours</strong>.
                            </p>
                            <p style="color:#aaa;font-size:14px;line-height:1.6;">
                                Once your application and documents are verified, you'll receive a confirmation email to log in and access your partner dashboard.
                            </p>
                        </div>
                        <p style="color:#444;font-size:10px;text-transform:uppercase;margin-top:40px;">
                            If you did not submit this application, you can safely ignore this email.
                        </p>
                    </div>
                `,
            }).catch((err: any) => console.error("[onboard] Confirmation email error:", err));
        }

        return ok({ requestId });
    } catch (error: any) {
        logger.error("auth/onboard", "Failed to submit onboarding request", { error: error.message });
        return fail("Failed to submit onboarding request");
    }
});

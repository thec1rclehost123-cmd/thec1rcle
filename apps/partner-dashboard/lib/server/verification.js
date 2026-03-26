/**
 * OTP verification utilities for partner-dashboard.
 *
 * Providers are thin wrappers — swap Resend → SendGrid or MSG91 → Twilio
 * by changing only the provider block inside each function. Callers stay the same.
 *
 * Ported from apps/guest-portal/lib/server/verification.js
 */

import { getAdminDb } from "../firebase/admin";
import { Resend } from "resend";
import { SECURITY_CONFIG } from "./security";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable, URL-safe key for a recipient (email or phone). */
function recipientKey(type, recipient) {
    return `${type}_${recipient.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/** Write a short-lived completion record so the onboard route can verify. */
async function writeCompletionRecord(type, recipient) {
    const db = getAdminDb();
    const expiresAt = new Date(
        Date.now() + SECURITY_CONFIG.OTP_COMPLETION_EXPIRY_MINUTES * 60 * 1000
    );
    await db.collection("otp_completions").doc(recipientKey(type, recipient)).set({
        type,
        recipient,
        verifiedAt: new Date(),
        expiresAt,
    });
}

// ─── Email OTP ────────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP to the given email address.
 * Falls back to mock/console output in development if RESEND_API_KEY is absent.
 */
export async function sendEmailOtp(email) {
    if (!resend) {
        if (process.env.NODE_ENV !== "development") {
            throw new Error("Email provider not configured");
        }
        console.warn("[verification] Resend not configured — using mock OTP.");
    }

    const code = Math.floor(100000 + (require("node:crypto").randomInt(900000))).toString();
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    const db = getAdminDb();
    const docRef = db.collection("otps").doc(`signup_email_${email}`);
    const existing = await docRef.get();

    if (existing.exists) {
        const data = existing.data();
        const lastSent = data.lastSent?.toDate() || new Date(0);
        const cooldownMs = SECURITY_CONFIG.OTP_COOLDOWN_SECONDS * 1000;
        if (Date.now() - lastSent.getTime() < cooldownMs) {
            throw new Error(`Please wait ${SECURITY_CONFIG.OTP_COOLDOWN_SECONDS}s before requesting another code.`);
        }
    }

    await docRef.set({ code, expiresAt, lastSent: new Date(), attempts: 0 });

    // Always print in dev — Resend sandbox only delivers to the account owner's email
    if (process.env.NODE_ENV === "development") {
        console.log(`\n=== DEV EMAIL OTP ===\nTo: ${email}\nCode: ${code}\n====================\n`);
    }

    if (resend) {
        try {
            await resend.emails.send({
                from: process.env.NODE_ENV === "development"
                    ? "THE C1RCLE <onboarding@resend.dev>"
                    : "THE C1RCLE <noreply@thec1rcle.com>",
                to: email,
                subject: "Your C1RCLE Verification Code",
                html: `
                    <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
                        <h1 style="color:#FF5A00;text-transform:uppercase;letter-spacing:5px;">THE C1RCLE</h1>
                        <p style="text-transform:uppercase;letter-spacing:2px;color:#666;font-size:12px;">Partner Verification</p>
                        <div style="margin:40px 0;font-size:48px;font-weight:900;letter-spacing:10px;">${code}</div>
                        <p style="color:#666;font-size:10px;text-transform:uppercase;">
                            This code expires in ${SECURITY_CONFIG.OTP_EXPIRY_MINUTES} minutes.<br/>
                            If you did not request this, ignore this email.
                        </p>
                    </div>
                `,
            });
        } catch (err) {
            // In dev, delivery failure is OK — code is already printed to terminal above
            if (process.env.NODE_ENV !== "development") {
                console.error("[verification] Resend error:", err);
                throw new Error("Unable to send verification code. Please try again.");
            }
        }
    }

    return true;
}

/**
 * Verify the email OTP. On success, writes a completion record so the
 * onboard API can confirm verification server-side.
 */
export async function verifyEmailOtp(email, code) {
    const db = getAdminDb();
    const doc = await db.collection("otps").doc(`signup_email_${email}`).get();

    if (!doc.exists) throw new Error("No verification request found for this email.");

    const data = doc.data();
    if (new Date() > data.expiresAt.toDate()) {
        throw new Error("Verification code has expired. Please request a new one.");
    }
    if (data.attempts >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        throw new Error("Too many incorrect attempts. Please request a new code.");
    }
    if (data.code !== code) {
        await db.collection("otps").doc(`signup_email_${email}`).update({
            attempts: (data.attempts || 0) + 1,
        });
        throw new Error("Incorrect verification code.");
    }

    await db.collection("otps").doc(`signup_email_${email}`).delete();
    await writeCompletionRecord("email", email);
    return true;
}

// ─── Phone OTP ────────────────────────────────────────────────────────────────

/**
 * Send a phone OTP via MSG91.
 * Falls back to mock in development if MSG91_AUTH_KEY is absent.
 */
export async function sendSmsOtp(phone) {
    const cleanPhone = phone.replace("+", "");

    if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
        if (process.env.NODE_ENV !== "development") {
            throw new Error("SMS provider not configured");
        }
        console.log(`\n=== MOCK SMS OTP ===\nTo: ${phone}\nCode: 123456\n====================\n`);
        return true;
    }

    try {
        const response = await fetch(
            `https://api.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}`,
            { method: "POST" }
        );
        const data = await response.json();
        if (data.type === "error") throw new Error(data.message || "Failed to send SMS OTP.");
        return true;
    } catch (err) {
        console.error("[verification] MSG91 send error:", err);
        throw new Error("Unable to send SMS verification code.");
    }
}

/**
 * Verify the phone OTP via MSG91. On success, writes a completion record.
 */
export async function verifySmsOtp(phone, code) {
    const cleanPhone = phone.replace("+", "");

    if (!MSG91_AUTH_KEY) {
        if (process.env.NODE_ENV === "development" && code === "123456") {
            await writeCompletionRecord("phone", phone);
            return true;
        }
        throw new Error("SMS provider not configured");
    }

    try {
        const response = await fetch(
            `https://api.msg91.com/api/v5/otp/verify?otp=${code}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}`,
            { method: "GET" }
        );
        const data = await response.json();
        if (data.type === "error" || data.message === "OTP not match") {
            throw new Error(data.message || "Incorrect SMS verification code.");
        }
        if (data.type === "success") {
            await writeCompletionRecord("phone", phone);
            return true;
        }
        throw new Error("Verification failed. Please try again.");
    } catch (err) {
        console.error("[verification] MSG91 verify error:", err);
        throw new Error(err.message || "SMS verification failed.");
    }
}

// ─── Server-side completion check (used by onboard route) ────────────────────

/**
 * Check that both email and phone were verified within the last
 * OTP_COMPLETION_EXPIRY_MINUTES minutes, then clean up the records.
 *
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function checkAndConsumeOtpCompletions(email, phone) {
    const db = getAdminDb();
    const now = new Date();

    const emailDoc = await db
        .collection("otp_completions")
        .doc(recipientKey("email", email))
        .get();

    if (!emailDoc.exists) {
        return { ok: false, reason: "Email address not verified." };
    }
    const emailData = emailDoc.data();
    if (now > emailData.expiresAt.toDate()) {
        return { ok: false, reason: "Email verification has expired. Please re-verify." };
    }

    const phoneDoc = await db
        .collection("otp_completions")
        .doc(recipientKey("phone", phone))
        .get();

    if (!phoneDoc.exists) {
        return { ok: false, reason: "Phone number not verified." };
    }
    const phoneData = phoneDoc.data();
    if (now > phoneData.expiresAt.toDate()) {
        return { ok: false, reason: "Phone verification has expired. Please re-verify." };
    }

    // Consume both records
    await Promise.all([
        db.collection("otp_completions").doc(recipientKey("email", email)).delete(),
        db.collection("otp_completions").doc(recipientKey("phone", phone)).delete(),
    ]);

    return { ok: true };
}

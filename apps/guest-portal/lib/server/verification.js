import { getAdminDb } from "../firebase/admin";
import { Resend } from "resend";
import { SECURITY_CONFIG } from "./security";

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send OTP via Email
 * @param {string} email 
 * @param {'auth'|'transaction'} type
 */
export async function sendEmailOtp(email, type = 'auth') {
    if (!resend) throw new Error("Email provider not configured");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    const db = getAdminDb();
    const docRef = db.collection("otps").doc(`${type}_${email}`);
    const existing = await docRef.get();

    if (existing.exists) {
        const data = existing.data();
        const lastSent = data.lastSent?.toDate() || new Date(0);
        const cooldown = SECURITY_CONFIG.OTP_COOLDOWN_SECONDS * 1000;
        if (Date.now() - lastSent.getTime() < cooldown) {
            throw new Error(`Please wait ${SECURITY_CONFIG.OTP_COOLDOWN_SECONDS}s before requesting another code.`);
        }
    }

    await docRef.set({
        code,
        type,
        expiresAt,
        lastSent: new Date(),
        attempts: 0
    });

    try {
        await resend.emails.send({
            from: "THE C1RCLE <thec1rcle.host123@gmail.com>",
            to: email,
            subject: "Your Access Key",
            html: `
                <div style="background-color: #000; color: #fff; padding: 40px; font-family: sans-serif; text-align: center;">
                    <h1 style="color: #FF5A00; text-transform: uppercase; letter-spacing: 5px;">THE C1RCLE</h1>
                    <p style="text-transform: uppercase; letter-spacing: 2px; color: #666; font-size: 12px;">${type === 'transaction' ? 'Transaction Authorization' : 'Identity Authorization'}</p>
                    <div style="margin: 40px 0; font-size: 48px; font-weight: 900; letter-spacing: 10px; color: #fff;">
                        ${code}
                    </div>
                    <p style="color: #666; font-size: 10px; text-transform: uppercase;">
                        ${type === 'transaction' ? 'This code is for ticket transfer confirmation.' : 'This code is for your secure access.'}<br/>
                        It will expire in 10 minutes.
                    </p>
                </div>
            `
        });
        return true;
    } catch (err) {
        console.error("Resend error:", err);
        throw new Error("Unable to send authorization code.");
    }
}

/**
 * Verify OTP via Email
 */
export async function verifyEmailOtp(email, code, type = 'auth') {
    const db = getAdminDb();
    const doc = await db.collection("otps").doc(`${type}_${email}`).get();

    if (!doc.exists) throw new Error("No ritual initiated for this identity.");

    const data = doc.data();
    if (new Date() > data.expiresAt.toDate()) {
        throw new Error("Authorization code expired.");
    }

    if (data.attempts >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        throw new Error("Too many attempts. Ritual reset required.");
    }

    if (data.code !== code) {
        await db.collection("otps").doc(`${type}_${email}`).update({
            attempts: (data.attempts || 0) + 1
        });
        throw new Error("Invalid authorization code.");
    }

    // Success - delete the otp
    await db.collection("otps").doc(`${type}_${email}`).delete();
    return true;
}

/**
 * Send OTP via SMS (Msg91)
 */
export async function sendSmsOtp(phone) {
    // Msg91 expects phone without '+' prefix
    const cleanPhone = phone.replace("+", "");

    if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
        console.warn("Msg91 not configured. Using Mock for dev.");
        if (process.env.NODE_ENV === "development") return true;
        throw new Error("SMS provider not configured");
    }

    try {
        const response = await fetch(`https://api.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}`, {
            method: "POST"
        });
        const data = await response.json();

        if (data.type === "error") {
            throw new Error(data.message || "Failed to send OTP.");
        }
        return true;
    } catch (err) {
        console.error("Msg91 Send Error:", err);
        throw new Error("Unable to send security code.");
    }
}

/**
 * Verify OTP via SMS (Msg91)
 */
export async function verifySmsOtp(phone, code) {
    const cleanPhone = phone.replace("+", "");

    if (!MSG91_AUTH_KEY) {
        if (process.env.NODE_ENV === "development" && code === "123456") return true;
        throw new Error("SMS provider not configured");
    }

    try {
        const response = await fetch(`https://api.msg91.com/api/v5/otp/verify?otp=${code}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}`, {
            method: "GET"
        });
        const data = await response.json();

        if (data.type === "error" || data.message === "OTP not match") {
            throw new Error(data.message || "Invalid security code.");
        }

        return data.type === "success";
    } catch (err) {
        console.error("Msg91 Verify Error:", err);
        throw new Error(err.message || "Verification failed.");
    }
}

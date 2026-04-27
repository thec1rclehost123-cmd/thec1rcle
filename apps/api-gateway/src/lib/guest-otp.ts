import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

function hashOtp(code: string) {
    return createHash('sha256').update(code).digest('hex');
}

function validateOtpConfig() {
    const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'TICKET_SECRET'];
    const missing = required.filter((key) => !process.env[key]);
    if (process.env.NODE_ENV === 'production' && missing.length > 0) {
        throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
    }
}

async function sendEmail(recipient: string, code: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Email provider not configured');
        }
        console.log(`MOCK EMAIL OTP for ${recipient}: ${code}`);
        return;
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'THE C1RCLE <thec1rcle.host123@gmail.com>',
            to: recipient,
            subject: 'Your Access Key',
            html: `
                <div style="background-color:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
                    <h1 style="color:#FF5A00;text-transform:uppercase;letter-spacing:5px;">THE C1RCLE</h1>
                    <p style="text-transform:uppercase;letter-spacing:2px;color:#666;font-size:12px;">Identity Authorization</p>
                    <div style="margin:40px 0;font-size:48px;font-weight:900;letter-spacing:10px;color:#fff;">${code}</div>
                    <p style="color:#666;font-size:10px;text-transform:uppercase;">This code is for your secure access.<br/>It will expire in 10 minutes.</p>
                </div>
            `,
        }),
    });

    if (!response.ok) {
        throw new Error('Unable to send authorization code.');
    }
}

async function sendSms(recipient: string) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const cleanPhone = recipient.replace('+', '');

    if (!authKey || !templateId) {
        if (process.env.NODE_ENV !== 'development') {
            throw new Error('SMS provider not configured');
        }
        console.log(`MOCK SMS OTP for ${recipient}: 123456`);
        return;
    }

    const response = await fetch(`https://api.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${cleanPhone}&authkey=${authKey}`, {
        method: 'POST',
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || data.type === 'error') {
        throw new Error(data.message || 'Failed to send OTP.');
    }
}

export async function sendGuestOtp(db: Firestore, type: 'email' | 'phone', recipient: string) {
    validateOtpConfig();

    if (type === 'phone') {
        await sendSms(recipient);
        return { message: 'If valid, a secret has been dispatched.' };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const docRef = db.collection('otps').doc(`auth_${recipient}`);
    const existing = await docRef.get();

    if (existing.exists) {
        const data = existing.data() || {};
        const lastSent = typeof data.lastSent?.toDate === 'function' ? data.lastSent.toDate() : new Date(data.lastSent || 0);
        if (Date.now() - lastSent.getTime() < OTP_COOLDOWN_SECONDS * 1000) {
            throw new Error(`Please wait ${OTP_COOLDOWN_SECONDS}s before requesting another code.`);
        }
    }

    await docRef.set({
        codeHash: hashOtp(code),
        type: 'auth',
        expiresAt,
        lastSent: new Date(),
        attempts: 0,
    });

    await sendEmail(recipient, code);
    return { message: 'If valid, a secret has been dispatched.' };
}

export async function verifyGuestOtp(db: Firestore, type: 'email' | 'phone', recipient: string, code: string) {
    if (type === 'phone') {
        const authKey = process.env.MSG91_AUTH_KEY;
        const cleanPhone = recipient.replace('+', '');

        if (!authKey) {
            if (process.env.NODE_ENV === 'development' && code === '123456') return { success: true };
            throw new Error('SMS provider not configured');
        }

        const response = await fetch(`https://api.msg91.com/api/v5/otp/verify?otp=${code}&mobile=${cleanPhone}&authkey=${authKey}`, {
            method: 'GET',
        });
        const data: any = await response.json().catch(() => ({}));
        if (!response.ok || data.type === 'error' || data.message === 'OTP not match') {
            throw new Error(data.message || 'Invalid security code.');
        }
        return { success: data.type === 'success' };
    }

    const docRef = db.collection('otps').doc(`auth_${recipient}`);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error('No ritual initiated for this identity.');
    const data = doc.data() || {};
    const expiresAt = typeof data.expiresAt?.toDate === 'function' ? data.expiresAt.toDate() : new Date(data.expiresAt);

    if (new Date() > expiresAt) {
        throw new Error('Authorization code expired.');
    }

    if ((data.attempts || 0) >= MAX_OTP_ATTEMPTS) {
        throw new Error('Too many attempts. Ritual reset required.');
    }

    const storedHash = data.codeHash || data.code;
    const inputHash = hashOtp(code);
    
    if (inputHash !== storedHash) {
        fastify.log.warn({ recipient, inputHash, storedHash }, 'OTP Hash Mismatch');
        await docRef.update({ attempts: (data.attempts || 0) + 1 });
        throw new Error('Invalid authorization code.');
    }

    await docRef.delete();
    return { success: true };
}


/**
 * CRITICAL INFRASTRUCTURE HARDENING:
 * This module enforces strict validation of environment variables.
 * If a critical secret is missing in production, the application will fail-fast
 * rather than leaking sensitive data or behaving unpredictably.
 */

const REQUIRED_ENVS = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'RESEND_API_KEY',
    'TICKET_SECRET'
];

export function validateConfig() {
    const missing = REQUIRED_ENVS.filter(key => !process.env[key]);

    if (missing.length > 0 && process.env.NODE_ENV === 'production') {
        throw new Error(`🛑 SECURITY BREACH: Missing critical environment variables: ${missing.join(', ')}`);
    }

    // Sanity check for Private Key format
    const pk = process.env.FIREBASE_PRIVATE_KEY;
    if (pk && !pk.includes('BEGIN PRIVATE KEY') && process.env.NODE_ENV === 'production') {
        console.warn('⚠️  WARNING: FIREBASE_PRIVATE_KEY format seems invalid. Ensure it includes header/footer.');
    }
}

// Global Security Constants
export const SECURITY_CONFIG = {
    OTP_COOLDOWN_SECONDS: 60,
    OTP_EXPIRY_MINUTES: 10,
    MAX_OTP_ATTEMPTS: 5,
    TRANSFER_BLOCK_HOURS_BEFORE_EVENT: 4,
};

// Auto-validate on load (Server-side only)
if (typeof window === 'undefined') {
    validateConfig();
}

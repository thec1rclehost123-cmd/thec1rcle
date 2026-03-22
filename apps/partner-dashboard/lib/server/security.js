/**
 * Security constants for the partner-dashboard.
 * Swap provider or adjust limits here — callers are unaffected.
 */
export const SECURITY_CONFIG = {
    OTP_COOLDOWN_SECONDS: 60,
    OTP_EXPIRY_MINUTES: 10,
    MAX_OTP_ATTEMPTS: 5,
    // How long an OTP completion record stays valid after verification
    OTP_COMPLETION_EXPIRY_MINUTES: 30,
};

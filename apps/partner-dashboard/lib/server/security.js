/**
 * Security constants for the partner-dashboard.
 * Swap provider or adjust limits here — callers are unaffected.
 */
export const SECURITY_CONFIG = {
  OTP_COOLDOWN_SECONDS: 60,
  OTP_EXPIRY_MINUTES: 10,
  MAX_OTP_ATTEMPTS: 5,
  // How long an OTP completion record stays valid after verification
  // Extended to 120 min to accommodate the full KYC onboarding flow (identity + bank docs)
  OTP_COMPLETION_EXPIRY_MINUTES: 120,
};

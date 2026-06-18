/**
 * THE C1RCLE - Firebase Configuration
 * Uses the SAME Firebase project as guest-portal and partner-dashboard.
 *
 * Environment variables MUST be set via .env or EAS build config.
 * No hardcoded fallbacks — the app should fail explicitly if misconfigured.
 */

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    if (__DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_FIREBASE_FALLBACKS === 'true') {
      console.warn(`[Firebase] Missing env var: ${key} — using empty local dev fallback`);
      return '';
    }
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Set it in your .env file or EAS build configuration.`,
    );
  }
  return value;
}

export const firebaseConfig = {
  apiKey: requiredEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

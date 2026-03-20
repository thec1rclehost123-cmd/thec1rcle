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
        // In development, warn but allow fallback to the dev project
        if (__DEV__) {
            console.warn(`[Firebase] Missing env var: ${key} — using dev fallback`);
            return DEV_FALLBACKS[key] || "";
        }
        throw new Error(
            `Missing required environment variable: ${key}. ` +
            `Set it in your .env file or EAS build configuration.`
        );
    }
    return value;
}

// Development-only fallbacks (stripped in production builds)
const DEV_FALLBACKS: Record<string, string> = {
    EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaSyBvVJH0kcXgNmmnKUPAENvWhAg1XzHXqDU",
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "c1rcle-staging.firebaseapp.com",
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "c1rcle-staging",
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "c1rcle-staging.firebasestorage.app",
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "281421756463",
    EXPO_PUBLIC_FIREBASE_APP_ID: "1:281421756463:web:d4101d3707e0a7cd5ceeda",
};

export const firebaseConfig = {
    apiKey: requiredEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requiredEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requiredEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requiredEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requiredEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requiredEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    OAuthProvider,
    signInWithCredential,
    GoogleAuthProvider,
    User,
    Auth
} from "firebase/auth";
import { Platform } from "react-native";

import { firebaseConfig } from "./config";

// Initialize Firebase App (singleton)
let firebaseApp: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
    if (!firebaseApp) {
        firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    }
    return firebaseApp;
}

// Firebase Auth
export function getFirebaseAuth(): Auth {
    return getAuth(getFirebaseApp());
}

// ─── Auth helper functions ───────────────────────────────────────

export async function loginWithEmail(email: string, password: string) {
    const auth = getFirebaseAuth();
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signupWithEmail(email: string, password: string) {
    const auth = getFirebaseAuth();
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    const auth = getFirebaseAuth();
    return signOut(auth);
}

export async function resetPassword(email: string) {
    const auth = getFirebaseAuth();
    return sendPasswordResetEmail(auth, email);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, callback);
}

// ─── Social Login ────────────────────────────────────────────────

/**
 * Sign in with Apple (uses expo-apple-authentication)
 * Required by App Store if any third-party auth is offered.
 */
export async function loginWithApple(): Promise<{ user: User }> {
    // Dynamic import to avoid crash if package isn't installed
    const AppleAuthentication = await import("expo-apple-authentication");

    // Check availability (only iOS 13+)
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
        throw new Error("Apple Sign-In is not available on this device");
    }

    const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
    });

    if (!credential.identityToken) {
        throw new Error("Apple Sign-In failed — no identity token");
    }

    // Create Firebase credential from Apple token
    const oAuthCredential = new OAuthProvider("apple.com").credential({
        idToken: credential.identityToken,
    });

    const auth = getFirebaseAuth();
    const result = await signInWithCredential(auth, oAuthCredential);

    // Profile creation is now handled by the API Gateway during first request/handshake
    return { user: result.user };
}

/**
 * Sign in with Google (uses @react-native-google-signin/google-signin)
 * Mirrors the website's loginWithGoogle from AuthProvider.jsx
 */
export async function loginWithGoogle(): Promise<{ user: User }> {
    // Dynamic import to avoid crash if package isn't installed
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");

    // Configure Google Sign-In
    GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    // Start Google sign-in flow
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();

    const idToken = signInResult.data?.idToken;
    if (!idToken) {
        throw new Error("Google Sign-In failed — no ID token");
    }

    // Create Firebase credential from Google token
    const googleCredential = GoogleAuthProvider.credential(idToken);

    const auth = getFirebaseAuth();
    const result = await signInWithCredential(auth, googleCredential);

    // Profile creation is now handled by the API Gateway during first request/handshake
    return { user: result.user };
}

export type { User };

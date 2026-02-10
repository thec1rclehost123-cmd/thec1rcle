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
import { getFirestore, Firestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
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

// Firestore Database
export function getFirebaseDb(): Firestore {
    return getFirestore(getFirebaseApp());
}

// Firebase Storage
export function getFirebaseStorage(): FirebaseStorage {
    return getStorage(getFirebaseApp());
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
 * Ensure a Firestore user profile exists after social login.
 * Mirrors the guest-portal's AuthProvider.ensureProfile() behavior.
 */
async function ensureUserProfile(user: User): Promise<void> {
    try {
        const db = getFirebaseDb();
        const profileRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(profileRef);

        if (!snapshot.exists()) {
            const now = new Date().toISOString();
            await setDoc(profileRef, {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "Member",
                photoURL: user.photoURL || "",
                gender: "",
                phoneNumber: user.phoneNumber || "",
                attendedEvents: [],
                city: "",
                instagram: "",
                createdAt: now,
                updatedAt: now,
            });
        }
    } catch (error) {
        console.error("[Auth] Failed to ensure user profile:", error);
        // Don't block login — profile can be created later
    }
}

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

    // Create Firestore profile if needed (same as website)
    await ensureUserProfile(result.user);

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

    // Create Firestore profile if needed (same as website)
    await ensureUserProfile(result.user);

    return { user: result.user };
}

export type { User };


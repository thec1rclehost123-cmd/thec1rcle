import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    User,
    Auth
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
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

// Auth helper functions
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

export type { User };

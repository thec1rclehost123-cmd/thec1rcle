import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseConfig } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getApp } from "firebase/app";

// Initialize Firebase Compat
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("[Firebase] Compat initialized");
}

const app = getApp();
let authInstance;

// Hybrid Initialization for Persistence
// We try to initialize Auth with AsyncStorage using the Modular API
// This ensures the underlying Auth instance (shared with Compat) has persistence.
try {
    authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log("[Firebase] Auth initialized with Persistence (Hybrid)");
} catch (e: any) {
    if (e.code === 'auth/already-initialized') {
        // If already initialized (e.g. by Compat import side-effects), use getAuth
        authInstance = getAuth(app);
        console.log("[Firebase] Auth already initialized (Hybrid)");

        // Try to update persistence if possible? 
        // Modular SDK doesn't easily allow swapping persistence post-init for the default instance 
        // without setPersistence(), which relies on the internal implementation matching.
    } else {
        console.warn("[Firebase] Hybrid Auth init failed, falling back to Compat default:", e);
    }
}

import {
    getFirestore,
    connectFirestoreEmulator,
    initializeFirestore
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import { Platform } from "react-native";
import { IS_DEV } from "../config";

import Constants from "expo-constants";

// Initialize Firestore with long polling for better reliability in some networks (tunnels/VPNs)
export const modularDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

export const modularStorage = getStorage(app);
// Use asia-south1 for THE C1RCLE India production
export const functions = getFunctions(app, "asia-south1");
export const modularDatabase = getDatabase(app);

if (IS_DEV) {
    // Deriving host IP for physical devices/emulators
    let host = "localhost";
    // Logic for host detection:
    if (!Constants.isDevice) {
        host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    } else {
        // 2. For physical devices, try Expo hostUri, then fallback to machine IP 
        const hostUri = Constants.expoConfig?.hostUri || (Constants as any).debuggerHost;

        if (hostUri && !hostUri.includes("exp.direct") && !hostUri.includes("expo.direct")) {
            host = hostUri.split(":")[0];
        } else {
            // Using the machine IP detected in lib/api/config.ts
            // Fallback for tunnels or when hostUri is unavailable/invalid
            host = "172.16.71.170";
        }
    }

    // Toggle this to false if you want to test against production data even in DEV
    const USE_EMULATOR = false;

    if (USE_EMULATOR) {
        try {
            connectFirestoreEmulator(modularDb, host, 8080);
            connectFunctionsEmulator(functions, host, 5001);
            connectDatabaseEmulator(modularDatabase, host, 9000);
            console.log(`[Firebase] Connected to Firestore emulator at ${host}:8080 (Long Polling: ON)`);
            console.log(`[Firebase] Connected to Functions emulator at ${host}:5001`);
            console.log(`[Firebase] Connected to Database emulator at ${host}:9000`);
        } catch (e) {
            // Ignore if already connected
        }
    }
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage(); // Keeping compat for legacy if needed

// Allow manual persistence setting if needed
export async function setPersistenceLocal() {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        console.log("[Firebase] Persistence set to LOCAL");
    } catch (e) {
        console.error("[Firebase] Persistence set failed:", e);
    }
}

// Legacy accessors
export function getFirebaseAuth() {
    return auth;
}

export function getFirebaseDb() {
    return modularDb;
}

export function getFirebaseStorage() {
    return modularStorage;
}

export function getRealtimeDb() {
    return modularDatabase;
}

// Auth helper functions
export async function loginWithEmail(email: string, password: string) {
    return auth.signInWithEmailAndPassword(email, password);
}

export async function signupWithEmail(email: string, password: string) {
    return auth.createUserWithEmailAndPassword(email, password);
}

export async function logout() {
    return auth.signOut();
}

export async function resetPassword(email: string) {
    return auth.sendPasswordResetEmail(email);
}

export function subscribeToAuthState(callback: (user: any) => void) {
    return auth.onAuthStateChanged(callback);
}

export type { User } from "firebase/auth";
export default firebase;

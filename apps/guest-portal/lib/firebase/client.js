/**
 * Guest-portal Firebase client — lazy SDK loading.
 *
 * firebase/app (~20 KB) is the only static import here because initializeApp()
 * must run synchronously. firebase/auth, firebase/firestore, and
 * firebase/storage (~230 KB combined) are loaded on first use as dynamic
 * imports so they are code-split from the initial bundle.
 *
 * All exported getters are async. Call sites must await them.
 * Instances are singletons — the dynamic import runs exactly once per session.
 *
 * NOTE: Do NOT re-export from @c1rcle/core/client here.
 * That module statically imports all Firebase SDKs and would undo the savings.
 */

import { getApp, getApps, initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let _app = null;

function getFirebaseApp() {
  if (!_app) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
      throw new Error("Missing Firebase client configuration. Set NEXT_PUBLIC_FIREBASE_* env vars.");
    }
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}

// Singleton instances — populated on first async call, reused thereafter.
let _auth = null;
let _db = null;
let _storage = null;

/** Returns the Firebase Auth instance. Loads firebase/auth on first call. */
export async function getFirebaseAuth() {
  if (!_auth) {
    const { getAuth } = await import("firebase/auth");
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

/** Returns the Firestore instance. Loads firebase/firestore on first call. */
export async function getFirebaseDb() {
  if (!_db) {
    const { getFirestore } = await import("firebase/firestore");
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
}

/** Returns the Firebase Storage instance. Loads firebase/storage on first call. */
export async function getFirebaseStorage() {
  if (!_storage) {
    const { getStorage } = await import("firebase/storage");
    _storage = getStorage(getFirebaseApp());
  }
  return _storage;
}

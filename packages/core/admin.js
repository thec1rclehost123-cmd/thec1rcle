import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let adminApp;
let adminDb;
let adminAuth;
let adminStorage;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // ── HARDENED PARSING ──
    // 1. Strip surrounding quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    // 2. Unescape \n into real line breaks
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Remove debug logs to avoid clutter/leaks
  // console.log("DEBUG: Processed PK Len:", privateKey?.length);

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket,
    // Aliases for compatibility
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}; // End getAdminConfig

const hasAdminConfig = () => {
  const config = getAdminConfig();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
};

export const isToyMode = () => {
  return process.env.DEV_TOY_MODE === 'true';
};

export const isFirebaseConfigured = () => hasAdminConfig() && !isToyMode();

const assertAdminConfig = () => {
  if (isToyMode()) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [CORE] DEV_TOY_MODE IS ACTIVE. OPERATING IN TOY MODE.');
    return null;
  }
  if (!hasAdminConfig()) {
    throw new Error(
      'CRITICAL: Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }
  return getAdminConfig();
};

export function getAdminApp() {
  if (adminApp) return adminApp;

  // Hardened Singleton: Check global scope to bridge module resolution gaps
  if (typeof global !== 'undefined' && global._adminApp) {
    adminApp = global._adminApp;
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length) {
    adminApp = getApp();
    if (typeof global !== 'undefined') global._adminApp = adminApp;
    return adminApp;
  }

  const credentials = assertAdminConfig();
  if (!credentials) {
    // Return a dummy object for Toy Mode
    return { name: '[DEFAULT]', options: {} };
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
      storageBucket: credentials.storageBucket,
    });
    if (typeof global !== 'undefined') global._adminApp = adminApp;
  } catch (err) {
    // Definitive Duplicate Check: If someone else beat us to it
    if (err.code === 'app/duplicate-app') {
      adminApp = getApp();
      if (typeof global !== 'undefined') global._adminApp = adminApp;
      return adminApp;
    }
    console.error('FATAL: Failed to initialize Firebase Admin:', err);
    throw err;
  }
  return adminApp;
}

export function getAdminDb() {
  if (!adminDb) {
    if (isToyMode()) {
      console.warn('⚠️ [CORE] Firebase Admin operating in TOY MODE (No Database connectivity)');
      return null;
    }

    adminDb = getFirestore(getAdminApp());
    try {
      adminDb.settings({ ignoreUndefinedProperties: true });
    } catch (e) {
      // Settings already applied by a previous call in this process lifecycle
    }
  }
  return adminDb;
}

export function getAdminAuth() {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminStorage() {
  if (!adminStorage) {
    adminStorage = getStorage(getAdminApp());
  }
  return adminStorage;
}

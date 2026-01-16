import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let adminApp;
let adminDb;
let adminAuth;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // 1. Handle literal \n replacement
    privateKey = privateKey.replace(/\\n/g, "\n");

    // 2. Remove any surrounding quotes if they somehow got into the string
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }

    // 3. Robustly reconstruct the PEM
    //    Remove header, footer first to isolate body
    let body = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "");

    //    Clean body: keep ONLY valid Base64 chars (A-Z, a-z, 0-9, +, /, =)
    //    This aggressively strips whitespace, newlines, escaped newlines, and garbage chars like backslashes
    body = body.replace(/[^a-zA-Z0-9+/=]/g, "");

    //    Reformat body into 64-char lines
    const formattedBody = body.match(/.{1,64}/g)?.join("\n");

    if (formattedBody) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----\n`;
    }
  }

  // Remove debug logs to avoid clutter/leaks
  // console.log("DEBUG: Processed PK Len:", privateKey?.length);

  return {
    projectId,
    clientEmail,
    privateKey,
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
  // Toy mode is ONLY allowed if explicitly enabled AND config is missing
  return process.env.DEV_TOY_MODE === "true" && !hasAdminConfig();
};

export const isFirebaseConfigured = () => hasAdminConfig();

const assertAdminConfig = () => {
  if (!hasAdminConfig()) {
    if (process.env.DEV_TOY_MODE === "true") {
      console.warn("\x1b[33m%s\x1b[0m", "⚠️  [CORE] FIREBASE NOT CONFIGURED. OPERATING IN TOY MODE.");
      return null;
    }
    throw new Error("CRITICAL: Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. Toy mode is disabled unless DEV_TOY_MODE=true.");
  }
  return getAdminConfig();
};

export function getAdminApp() {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length) {
    adminApp = getApp();
    return adminApp;
  }

  const credentials = assertAdminConfig();
  if (!credentials) {
    // Return a dummy object for Toy Mode
    return { name: "[DEFAULT]", options: {} };
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey
      })
    });
  } catch (err) {
    console.error("FATAL: Failed to initialize Firebase Admin:", err);
    throw err;
  }
  return adminApp;
}

export function getAdminDb() {
  if (!adminDb) {
    if (isToyMode()) {
      console.warn("⚠️ [CORE] Firebase Admin operating in TOY MODE (No Database connectivity)");
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

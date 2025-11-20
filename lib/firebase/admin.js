import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp;
let adminDb;

const getAdminConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return { projectId, clientEmail, privateKey };
};

const hasAdminConfig = () => {
  const config = getAdminConfig();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
};

export const isFirebaseConfigured = () => hasAdminConfig();

const assertAdminConfig = () => {
  if (!hasAdminConfig()) {
    throw new Error("Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
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
  adminApp = initializeApp({
    credential: cert(credentials)
  });
  return adminApp;
}

export function getAdminDb() {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

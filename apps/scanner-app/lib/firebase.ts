import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';

function requiredPublicEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Scanner App environment variable: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const getPersistence = () => {
  if (Platform.OS === 'web') {
    return browserLocalPersistence;
  }

  const authLib = firebaseAuth as any;
  if (typeof authLib.getReactNativePersistence === 'function') {
    return authLib.getReactNativePersistence(AsyncStorage);
  }
  return undefined;
};

export const auth = initializeAuth(app, {
  persistence: getPersistence(),
});
export default app;

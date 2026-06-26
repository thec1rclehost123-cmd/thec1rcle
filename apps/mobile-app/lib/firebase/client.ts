import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  OAuthProvider,
  signInWithCredential,
  GoogleAuthProvider,
  PhoneAuthProvider,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  type AuthCredential,
  type User,
  type Auth,
} from 'firebase/auth';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './config';

// Initialize Firebase App (singleton)
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;

type PendingProviderLink = {
  email: string;
  providerId: string;
  providerName: string;
  credential: AuthCredential;
};

let pendingProviderLink: PendingProviderLink | null = null;

type ReactNativePersistenceFactory = (storage: typeof AsyncStorage) => any;

function getReactNativeAuthPersistence() {
  try {
    const authModule = require('@firebase/auth') as {
      getReactNativePersistence?: ReactNativePersistenceFactory;
    };
    return authModule.getReactNativePersistence?.(AsyncStorage);
  } catch {
    return undefined;
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

// Firebase Auth
export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    try {
      const persistence = getReactNativeAuthPersistence();
      firebaseAuth = initializeAuth(getFirebaseApp(), {
        ...(persistence ? { persistence } : {}),
      });
    } catch (error: any) {
      // If auth is already initialized elsewhere (e.g. fast refresh), fallback to getAuth
      const { getAuth } = require('firebase/auth');
      firebaseAuth = getAuth(getFirebaseApp());
    }
  }
  return firebaseAuth;
}

// ─── Auth helper functions ───────────────────────────────────────

export async function loginWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  await linkPendingProviderIfNeeded(result.user);
  return result;
}

export async function signupWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const auth = getFirebaseAuth();
  clearPendingProviderLink();
  return signOut(auth);
}

export async function resetPassword(email: string) {
  const auth = getFirebaseAuth();
  return sendPasswordResetEmail(auth, email);
}

export async function sendPhoneVerificationCode(phoneNumber: string, verifier: any) {
  const provider = new PhoneAuthProvider(getFirebaseAuth());
  return provider.verifyPhoneNumber(phoneNumber, verifier);
}

export async function loginWithPhoneVerificationCode(verificationId: string, code: string) {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  return signInWithCredential(getFirebaseAuth(), credential);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export function getPendingProviderLink() {
  return pendingProviderLink
    ? {
        email: pendingProviderLink.email,
        providerId: pendingProviderLink.providerId,
        providerName: pendingProviderLink.providerName,
      }
    : null;
}

export function clearPendingProviderLink() {
  pendingProviderLink = null;
}

function normalizeEmail(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

async function linkPendingProviderIfNeeded(user: User) {
  if (!pendingProviderLink) return;

  const pending = pendingProviderLink;
  if (normalizeEmail(user.email) !== normalizeEmail(pending.email)) {
    pendingProviderLink = null;
    return;
  }

  try {
    await linkWithCredential(user, pending.credential);
  } catch (error: any) {
    if (error?.code !== 'auth/provider-already-linked') {
      throw error;
    }
  } finally {
    pendingProviderLink = null;
  }
}

function buildProviderLinkError(
  providerName: string,
  email: string,
  signInMethods: string[],
  credential: AuthCredential,
) {
  pendingProviderLink = {
    email,
    providerId: credential.providerId,
    providerName,
    credential,
  };

  const requiresPassword = signInMethods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD);
  const message = requiresPassword
    ? `We found an existing account for ${email}. Enter your password to link ${providerName} and continue.`
    : `We found an existing account for ${email}. Sign in with your original method first, then try ${providerName} again.`;
  const error = new Error(message) as Error & {
    code?: string;
    email?: string;
    signInMethods?: string[];
    providerName?: string;
  };
  error.code = requiresPassword
    ? 'auth/link-with-password-required'
    : 'auth/account-exists-with-different-credential';
  error.email = email;
  error.signInMethods = signInMethods;
  error.providerName = providerName;
  return error;
}

async function handleAccountExistsWithDifferentCredential(
  error: any,
  credential: AuthCredential,
  fallbackEmail: string | null | undefined,
  providerName: string,
) {
  if (error?.code !== 'auth/account-exists-with-different-credential') {
    throw error;
  }

  const auth = getFirebaseAuth();
  const email = normalizeEmail(error.customData?.email || error.email || fallbackEmail);
  if (!email) {
    throw error;
  }

  const signInMethods = await fetchSignInMethodsForEmail(auth, email);
  throw buildProviderLinkError(providerName, email, signInMethods, credential);
}

// ─── Social Login ────────────────────────────────────────────────

/**
 * Sign in with Apple (uses expo-apple-authentication)
 * Required by App Store if any third-party auth is offered.
 */
export async function loginWithApple(): Promise<{ user: User }> {
  // Dynamic import to avoid crash if package isn't installed
  const AppleAuthentication = await import('expo-apple-authentication');

  // Check availability (only iOS 13+)
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple Sign-In is not available on this device');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In failed — no identity token');
  }

  // Create Firebase credential from Apple token
  const oAuthCredential = new OAuthProvider('apple.com').credential({
    idToken: credential.identityToken,
  });

  const auth = getFirebaseAuth();
  let result;
  try {
    result = await signInWithCredential(auth, oAuthCredential);
  } catch (error: any) {
    await handleAccountExistsWithDifferentCredential(
      error,
      oAuthCredential,
      credential.email,
      'Apple',
    );
    throw error;
  }

  // Profile creation is now handled by the API Gateway during first request/handshake
  return { user: result.user };
}

/**
 * Sign in with Google (uses @react-native-google-signin/google-signin)
 * Mirrors the website's loginWithGoogle from AuthProvider.jsx
 */
export async function loginWithGoogle(): Promise<{ user: User }> {
  if (!NativeModules.RNGoogleSignin) {
    throw new Error(
      'Google Sign-In is not supported in this client (e.g. Expo Go). Please use Email or Apple Login instead.',
    );
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');

    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    // Start Google sign-in flow
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();

    const idToken = signInResult.data?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In failed — no ID token');
    }

    // Create Firebase credential from Google token
    const googleCredential = GoogleAuthProvider.credential(idToken);

    const auth = getFirebaseAuth();
    const result = await signInWithCredential(auth, googleCredential).catch(async (error) => {
      await handleAccountExistsWithDifferentCredential(
        error,
        googleCredential,
        signInResult.data?.user?.email,
        'Google',
      );
      throw error;
    });

    // Profile creation is now handled by the API Gateway during first request/handshake
    return { user: result.user };
  } catch (e: any) {
    if (e?.code) {
      throw e;
    }
    if (__DEV__) console.error('Google Sign-In failed:', e);
    throw new Error(
      e.message ||
        'Google Sign-In is not supported in this client. Please use Email or Apple Login instead.',
    );
  }
}

export type { User };

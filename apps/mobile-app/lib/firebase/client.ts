import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, type AppCheck } from 'firebase/app-check';
import { NativeModules } from 'react-native';
import { firebaseConfig } from './config';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Initialize Web Firebase App (for App Check / API compatibility if needed)
let firebaseApp: FirebaseApp;
let firebaseAppCheck: AppCheck | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

export function initAppCheck(): AppCheck {
  if (!firebaseAppCheck) {
    const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || '';
    firebaseAppCheck = initializeAppCheck(getFirebaseApp(), {
      provider: new CustomProvider({
        getToken: async () => ({
          token: debugToken,
          expireTimeMillis: Date.now() + 1000 * 60 * 60, // 1 hour
        }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return firebaseAppCheck;
}

// Firebase Auth Native
export function getFirebaseAuth() {
  return auth();
}

type PendingProviderLink = {
  email: string;
  providerId: string;
  providerName: string;
  credential: FirebaseAuthTypes.AuthCredential;
};

let pendingProviderLink: PendingProviderLink | null = null;

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

async function linkPendingProviderIfNeeded(user: FirebaseAuthTypes.User) {
  if (!pendingProviderLink) return;

  const pending = pendingProviderLink;
  if (normalizeEmail(user.email) !== normalizeEmail(pending.email)) {
    pendingProviderLink = null;
    return;
  }

  try {
    await user.linkWithCredential(pending.credential);
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
  credential: FirebaseAuthTypes.AuthCredential,
) {
  pendingProviderLink = {
    email,
    providerId: credential.providerId,
    providerName,
    credential,
  };

  const requiresPassword = signInMethods.includes('password');
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
  credential: FirebaseAuthTypes.AuthCredential,
  fallbackEmail: string | null | undefined,
  providerName: string,
) {
  if (error?.code !== 'auth/account-exists-with-different-credential') {
    throw error;
  }

  const email = normalizeEmail(error.customData?.email || error.email || fallbackEmail);
  if (!email) {
    throw error;
  }

  const signInMethods = await auth().fetchSignInMethodsForEmail(email);
  throw buildProviderLinkError(providerName, email, signInMethods, credential);
}

export async function loginWithEmail(email: string, password: string) {
  const result = await auth().signInWithEmailAndPassword(email, password);
  await linkPendingProviderIfNeeded(result.user);
  return result;
}

export async function signupWithEmail(email: string, password: string) {
  const result = await auth().createUserWithEmailAndPassword(email, password);
  return result;
}

export async function sendVerificationEmail(user: FirebaseAuthTypes.User, url: string) {
  return user.sendEmailVerification({
    url,
    handleCodeInApp: true,
    iOS: { bundleId: 'com.c1rcle.app' },
    android: { packageName: 'com.c1rcle.app', installApp: false, minimumVersion: '12' },
  });
}

export async function applyVerificationCode(code: string) {
  return auth().applyActionCode(code);
}

export async function logout() {
  clearPendingProviderLink();
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch (e) {
    // Ignore errors (e.g., if Google Sign-In wasn't configured or active)
  }
  return auth().signOut();
}

export async function resetPassword(email: string) {
  return auth().sendPasswordResetEmail(email);
}

export async function sendPhoneVerificationCode(phoneNumber: string, verifier?: any) {
  return auth().signInWithPhoneNumber(phoneNumber);
}

export async function loginWithPhoneVerificationCode(verificationId: string, code: string) {
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  return auth().signInWithCredential(credential);
}

export async function linkWithPhoneVerificationCode(verificationId: string, code: string) {
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('No user signed in to link');
  return currentUser.linkWithCredential(credential);
}

export async function linkEmailToUser(email: string) {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error('No user signed in to link');
  return currentUser.updateEmail(email);
}

export function subscribeToAuthState(callback: (user: FirebaseAuthTypes.User | null) => void) {
  return auth().onAuthStateChanged(callback);
}

export async function loginWithApple(): Promise<{ user: FirebaseAuthTypes.User }> {
  const AppleAuthentication = await import('expo-apple-authentication');

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

  const oAuthCredential = auth.AppleAuthProvider.credential(credential.identityToken);

  let result;
  try {
    result = await auth().signInWithCredential(oAuthCredential);
  } catch (error: any) {
    await handleAccountExistsWithDifferentCredential(
      error,
      oAuthCredential,
      credential.email,
      'Apple',
    );
    throw error;
  }

  return { user: result.user };
}

export async function loginWithGoogle(): Promise<{ user: FirebaseAuthTypes.User }> {
  if (!NativeModules.RNGoogleSignin) {
    throw new Error(
      'Google Sign-In is not supported in this client. Please use Email or Apple Login instead.',
    );
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');

    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();

    const idToken = signInResult.data?.idToken || tokens.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In failed — no ID token');
    }

    const accessToken = tokens.accessToken;
    if (!accessToken) {
      throw new Error('Google Sign-In failed — no access token');
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken, accessToken);

    const result = await auth().signInWithCredential(googleCredential).catch(async (error) => {
      await handleAccountExistsWithDifferentCredential(
        error,
        googleCredential,
        signInResult.data?.user?.email,
        'Google',
      );
      throw error;
    });

    return { user: result.user };
  } catch (e: any) {
    if (e?.code) {
      throw e;
    }
    if (__DEV__) console.error('Google Sign-In failed:', e);
    throw new Error(
      e.message ||
        'Google Sign-In failed.',
    );
  }
}

export type User = FirebaseAuthTypes.User;

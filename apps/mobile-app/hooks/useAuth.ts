import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { completeAuthSessionAfterSignIn, useAuthStore } from '@/store/authStore';
import {
  loginWithEmail,
  signupWithEmail,
  logout,
  resetPassword,
  loginWithApple as firebaseLoginWithApple,
  loginWithGoogle as firebaseLoginWithGoogle,
  loginWithPhoneVerificationCode,
  sendPhoneVerificationCode,
  sendVerificationEmail,
  getPendingProviderLink,
  linkWithPhoneVerificationCode,
  linkEmailToUser,
} from '@/lib/firebase';

async function completeServerHandshake(user: Awaited<ReturnType<typeof loginWithEmail>>['user']) {
  try {
    await completeAuthSessionAfterSignIn(user);
  } catch (err: any) {
    if (__DEV__) console.warn('[Auth] Server handshake failed:', err?.message);
    throw new Error(err?.message || 'Session sync failed');
  }
}

function getActionErrorMessage(err: any): string {
  if (err?.code === 'auth/link-with-password-required' && err?.message) return err.message;
  const code =
    err?.code ||
    (typeof err?.message === 'string' ? err.message.match(/\[(auth\/[^\]]+)\]/)?.[1] : null);

  if (code) {
    const mapped = getErrorMessage(code);
    if (mapped) return mapped;
  }
  return err?.message || 'Something went wrong. Please try again';
}

export function useAuth() {
  const { user, loading, initialized, authSyncFailed, authSyncError } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processMagicEmail = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      // 1. Attempt to log in first
      const result = await loginWithEmail(email, password);

      await completeServerHandshake(result.user);
      return { success: true, action: 'login' };
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // 2. User does not exist, so auto-sign them up
        try {
          const result = await signupWithEmail(email, password);

          // 3. Send the Verification Link Deep Link
          // We must use a whitelisted domain for the ActionCodeSettings URL.
          // Since Firebase Auth will wrap this in a Dynamic Link for the app, it will still redirect back to the app!
          const redirectUrl = `https://c1rcle-staging.firebaseapp.com/verify?email=${encodeURIComponent(email)}`;
          await sendVerificationEmail(result.user, redirectUrl);

          return { success: true, action: 'signup_verification_sent' };
        } catch (signupErr: any) {
          const message = getActionErrorMessage(signupErr);
          setError(message);
          return { success: false, error: message };
        }
      } else {
        // Real login error (e.g. wrong password for existing user, network error)
        const message = getActionErrorMessage(err);
        setError(message);
        return { success: false, error: message };
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await signupWithEmail(email, password);
      await completeServerHandshake(result.user);
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    try {
      await logout();
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      return { success: true };
    } catch (err: any) {
      const message = getErrorMessage(err.code) || err.message || 'Something went wrong. Please try again';
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ─── Social Login ────────────────────────────────────────────

  const loginApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setError('Apple Sign-In is only available on iOS');
      return { success: false, error: 'Apple Sign-In is only available on iOS' };
    }

    setAuthLoading(true);
    setError(null);
    try {
      const result = await firebaseLoginWithApple();
      await completeServerHandshake(result.user);
      return { success: true };
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        setAuthLoading(false);
        return { success: false, error: null };
      }

      const pendingLink = getPendingProviderLink();
      const message = getActionErrorMessage(err) || 'Apple Sign-In failed';
      setError(message);
      return {
        success: false,
        error: message,
        requiresPasswordLink: err.code === 'auth/link-with-password-required',
        email: err.email || pendingLink?.email,
      };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await firebaseLoginWithGoogle();
      await completeServerHandshake(result.user);
      return { success: true };
    } catch (err: any) {
      if (err.code === 'SIGN_IN_CANCELLED' || err.code === '12501') {
        setAuthLoading(false);
        return { success: false, error: null };
      }
      const pendingLink = getPendingProviderLink();
      const message = getActionErrorMessage(err) || 'Google Sign-In failed';
      setError(message);
      return {
        success: false,
        error: message,
        requiresPasswordLink: err.code === 'auth/link-with-password-required',
        email: err.email || pendingLink?.email,
      };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const sendPhoneCode = useCallback(async (phoneNumber: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      const confirmation = await sendPhoneVerificationCode(phoneNumber);
      return { success: true, verificationId: confirmation.verificationId };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const confirmPhoneCode = useCallback(async (verificationId: string, code: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await loginWithPhoneVerificationCode(verificationId, code);
      await completeServerHandshake(result.user);
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const linkPhoneCode = useCallback(async (verificationId: string, code: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await linkWithPhoneVerificationCode(verificationId, code);
      // We don't need a full server handshake for linking, but we could sync if necessary.
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const linkEmail = useCallback(async (email: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await linkEmailToUser(email);
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Surface server-sync failure as a persistent error when no action-level error is set
  const displayError =
    error ||
    (authSyncFailed && authSyncError ? 'Connection issue. Please check your network and try again.' : null);

  return {
    user,
    loading: loading || authLoading,
    initialized,
    error: displayError,
    authSyncFailed,
    login: processMagicEmail,
    signup,
    signOut,
    sendResetEmail,
    loginApple,
    loginGoogle,
    sendPhoneCode,
    confirmPhoneCode,
    linkPhoneCode,
    linkEmail,
    setError,
    clearError: () => setError(null),
  };
}

// Convert Firebase error codes to user-friendly messages
function getErrorMessage(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists. Try a different login method.';
    case 'auth/link-with-password-required':
      return 'Enter your password to link this sign-in method and continue.';
    case 'auth/invalid-phone-number':
      return 'That phone number does not look right. Check the country code and number, then try again.';
    case 'auth/invalid-verification-code':
      return 'The OTP code is incorrect';
    case 'auth/missing-verification-code':
      return 'Please enter the OTP code';
    case '10':
    case 'DEVELOPER_ERROR':
      return 'Google Sign-In is not configured for this Android build. Rebuild the dev client and try again.';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Google Play Services is unavailable or needs an update on this device.';
    case 'IN_PROGRESS':
      return 'Google Sign-In is already in progress. Please wait a moment and try again.';
    default:
      return null;
  }
}

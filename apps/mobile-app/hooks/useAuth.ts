import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { syncAuthSession } from '@/lib/api';
import {
  loginWithEmail,
  signupWithEmail,
  logout,
  resetPassword,
  loginWithApple as firebaseLoginWithApple,
  loginWithGoogle as firebaseLoginWithGoogle,
  loginWithPhoneVerificationCode,
  sendPhoneVerificationCode,
  getPendingProviderLink,
} from '@/lib/firebase';

async function completeServerHandshake() {
  await syncAuthSession();
}

function getActionErrorMessage(err: any): string {
  if (err?.code === 'auth/link-with-password-required' && err?.message) return err.message;
  if (err?.code) return getErrorMessage(err.code);
  return err?.message || 'Something went wrong. Please try again';
}

export function useAuth() {
  const { user, loading, initialized } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
      await completeServerHandshake();
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await signupWithEmail(email, password);
      await completeServerHandshake();
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
      const message = getErrorMessage(err.code);
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
      await firebaseLoginWithApple();
      await completeServerHandshake();
      return { success: true };
    } catch (err: any) {
      // User cancelled Apple Sign-In — not an error
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
      await firebaseLoginWithGoogle();
      await completeServerHandshake();
      return { success: true };
    } catch (err: any) {
      // User cancelled Google Sign-In — not an error
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

  const sendPhoneCode = useCallback(async (phoneNumber: string, verifier: any) => {
    setAuthLoading(true);
    setError(null);
    try {
      const verificationId = await sendPhoneVerificationCode(phoneNumber, verifier);
      return { success: true, verificationId };
    } catch (err: any) {
      const message = err.message || getErrorMessage(err.code);
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
      await loginWithPhoneVerificationCode(verificationId, code);
      await completeServerHandshake();
      return { success: true };
    } catch (err: any) {
      const message = getActionErrorMessage(err);
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return {
    user,
    loading: authLoading,
    initialized,
    error,
    login,
    signup,
    signOut,
    sendResetEmail,
    loginApple,
    loginGoogle,
    sendPhoneCode,
    confirmPhoneCode,
    clearError: () => setError(null),
  };
}

// Convert Firebase error codes to user-friendly messages
function getErrorMessage(code: string): string {
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
      return 'Please enter a valid phone number with country code';
    case 'auth/invalid-verification-code':
      return 'The OTP code is incorrect';
    case 'auth/missing-verification-code':
      return 'Please enter the OTP code';
    default:
      return 'Something went wrong. Please try again';
  }
}

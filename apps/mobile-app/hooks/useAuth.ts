import { useState, useCallback } from "react";
import { Platform } from "react-native";

import {
  loginWithEmail,
  signupWithEmail,
  logout,
  resetPassword,
  loginWithApple as firebaseLoginWithApple,
  loginWithGoogle as firebaseLoginWithGoogle,
} from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const { user, loading, initialized } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
      return { success: true };
    } catch (err: any) {
      const message = getErrorMessage(err.code);
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
      return { success: true };
    } catch (err: any) {
      const message = getErrorMessage(err.code);
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
    if (Platform.OS !== "ios") {
      setError("Apple Sign-In is only available on iOS");
      return { success: false, error: "Apple Sign-In is only available on iOS" };
    }

    setAuthLoading(true);
    setError(null);
    try {
      await firebaseLoginWithApple();
      return { success: true };
    } catch (err: any) {
      // User cancelled Apple Sign-In — not an error
      if (err.code === "ERR_REQUEST_CANCELED") {
        setAuthLoading(false);
        return { success: false, error: null };
      }
      const message = err.message || "Apple Sign-In failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    setAuthLoading(true);
    setError(null);
    try {
      await firebaseLoginWithGoogle();
      return { success: true };
    } catch (err: any) {
      // User cancelled Google Sign-In — not an error
      if (err.code === "SIGN_IN_CANCELLED" || err.code === "12501") {
        setAuthLoading(false);
        return { success: false, error: null };
      }
      const message = err.message || "Google Sign-In failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return {
    user,
    loading: loading || authLoading,
    initialized,
    error,
    login,
    signup,
    signOut,
    sendResetEmail,
    loginApple,
    loginGoogle,
    clearError: () => setError(null),
  };
}

// Convert Firebase error codes to user-friendly messages
function getErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address";
    case "auth/user-disabled":
      return "This account has been disabled";
    case "auth/user-not-found":
      return "No account found with this email";
    case "auth/wrong-password":
      return "Incorrect password";
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/weak-password":
      return "Password should be at least 6 characters";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later";
    case "auth/network-request-failed":
      return "Network error. Please check your connection";
    case "auth/account-exists-with-different-credential":
      return "An account with this email already exists. Try a different login method.";
    default:
      return "Something went wrong. Please try again";
  }
}

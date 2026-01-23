import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import {
    loginWithEmail,
    signupWithEmail,
    logout,
    resetPassword
} from "@/lib/firebase";

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

    return {
        user,
        loading: loading || authLoading,
        initialized,
        error,
        login,
        signup,
        signOut,
        sendResetEmail,
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
        default:
            return "Something went wrong. Please try again";
    }
}

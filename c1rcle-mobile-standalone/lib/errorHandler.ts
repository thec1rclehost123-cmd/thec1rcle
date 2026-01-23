/**
 * THE C1RCLE Mobile — Central Error Handler
 * 
 * Consistent error handling, logging, and user notifications.
 */

import { Alert } from "react-native";
import { MOBILE_ENV, IS_PROD } from "./config";

// Mock Sentry for now as per plan
const Sentry = {
    captureException: (error: any, options: any) => {
        if (IS_PROD) {
            console.log("[SENTRY MOCK] Capturing Exception:", error, options);
            // In a real app, this would call Sentry.captureException(error, options)
        }
    }
};

interface ErrorOptions {
    showAlert?: boolean;
    silent?: boolean;
    extra?: Record<string, any>;
}

/**
 * Handle API and Runtime errors consistently
 */
export async function handleApiError(
    error: any,
    context: string,
    options: ErrorOptions = { showAlert: true }
) {
    const errorMessage = error?.message || String(error);

    // 1. Log to console
    console.error(`🔴 [${context}] Error:`, errorMessage);
    if (!IS_PROD && error?.stack) {
        console.error(error.stack);
    }

    // 2. Track to Sentry if in production
    if (IS_PROD || MOBILE_ENV === "staging") {
        Sentry.captureException(error, {
            extra: {
                context,
                ...options.extra
            }
        });
    }

    // 3. Notify user
    if (options.showAlert && !options.silent) {
        // Use user-friendly language as requested
        const userTitle = "Something went wrong";
        const userMessage = "We're on it. Please try again or check your connection.";

        Alert.alert(
            userTitle,
            MOBILE_ENV !== "prod" ? `${userMessage}\n\n[${context}]: ${errorMessage}` : userMessage,
            [{ text: "OK" }]
        );
    }

    return {
        success: false,
        error: errorMessage,
        context
    };
}

/**
 * Custom error class for API errors
 */
export class AppError extends Error {
    context: string;
    code?: string;

    constructor(message: string, context: string, code?: string) {
        super(message);
        this.name = "AppError";
        this.context = context;
        this.code = code;
    }
}

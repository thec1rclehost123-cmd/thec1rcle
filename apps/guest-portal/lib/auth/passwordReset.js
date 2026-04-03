import { sendPasswordResetEmail } from "firebase/auth";

function getGuestPortalBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "")
    );
}

function buildActionCodeSettings(email) {
    const baseUrl = getGuestPortalBaseUrl();
    if (!baseUrl) return undefined;

    const continueUrl = new URL("/login", baseUrl);
    continueUrl.searchParams.set("reset", "1");
    if (email) continueUrl.searchParams.set("email", email);

    return {
        url: continueUrl.toString(),
        handleCodeInApp: false,
    };
}

export async function sendOperationalPasswordResetEmail(auth, email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
        const error = new Error("Please enter your email address");
        error.code = "auth/missing-email";
        throw error;
    }

    const actionCodeSettings = buildActionCodeSettings(normalizedEmail);
    if (actionCodeSettings) {
        return sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);
    }
    return sendPasswordResetEmail(auth, normalizedEmail);
}

export function getPasswordResetErrorMessage(error, { generic = false } = {}) {
    if (generic) {
        return "Something went wrong. If that account exists, we sent a link.";
    }

    switch (error?.code) {
        case "auth/missing-email":
            return "Please enter your email address";
        case "auth/invalid-email":
            return "Invalid email address";
        case "auth/user-not-found":
            return "No account found with this email address";
        case "auth/too-many-requests":
            return "Too many requests. Please try again later";
        case "auth/network-request-failed":
            return "Network error. Check your connection and try again.";
        default:
            return "Failed to send reset email. Please try again.";
    }
}

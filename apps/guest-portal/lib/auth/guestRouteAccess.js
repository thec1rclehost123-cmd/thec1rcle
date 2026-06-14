function sanitizeReturnUrl(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
    return trimmed;
}

export function getReturnUrl(searchParams, fallback = "/profile") {
    if (!searchParams) return fallback;
    const read = (key) => {
        if (typeof searchParams.get === "function") return searchParams.get(key);
        return searchParams[key];
    };

    return sanitizeReturnUrl(
        read("next") || read("returnUrl") || read("redirect"),
        fallback,
    );
}

export function buildAuthCallbackUrl(returnUrl = "/profile") {
    return `/auth/callback?next=${encodeURIComponent(returnUrl)}`;
}

export function buildLoginUrl(returnUrl = "/profile", { onboarding = false } = {}) {
    const suffix = onboarding ? "&onboarding=1" : "";
    return `/login?next=${encodeURIComponent(returnUrl)}${suffix}`;
}

export function buildSignupUrl(returnUrl = "/profile") {
    return `/signup?next=${encodeURIComponent(returnUrl)}`;
}

export function getAuthPageRedirect(bootstrap, returnUrl = "/profile") {
    if (bootstrap?.routeAccess?.shouldRedirectFromAuthPages) {
        return buildAuthCallbackUrl(returnUrl);
    }
    return null;
}

export function getProfileEntryRedirect(bootstrap) {
    const uid = bootstrap?.identity?.uid;
    return uid ? `/profile/${uid}` : buildLoginUrl("/profile");
}

export function shouldRouteCallbackToOnboarding({ bootstrap, profile }) {
    if (bootstrap?.routeAccess?.requiresOnboarding) return true;
    return profile !== null && profile?.onboardingComplete === false;
}

export function resolveReturnUrl(returnUrl, bootstrap) {
    if (returnUrl === "/profile" && bootstrap?.identity?.uid) {
        return `/profile/${bootstrap.identity.uid}`;
    }
    return returnUrl;
}

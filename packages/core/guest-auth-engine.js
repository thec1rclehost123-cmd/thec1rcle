const SAFE_PROFILE_UPDATE_FIELDS = new Set([
    "displayName",
    "name",
    "bio",
    "city",
    "gender",
    "instagram",
    "phone",
    "phoneNumber",
    "photoURL",
    "avatar",
    "socials",
    "onboardingComplete",
]);

export function normalizeGuestEmail(email) {
    return String(email || "").trim().toLowerCase();
}

export function filterGuestProfileUpdates(updates = {}) {
    const output = {};
    for (const [key, value] of Object.entries(updates || {})) {
        if (SAFE_PROFILE_UPDATE_FIELDS.has(key) && value !== undefined) {
            output[key] = value;
        }
    }
    return output;
}

export function isGuestOnboardingComplete(profile = {}) {
    if (profile.onboardingComplete === true) return true;
    return Boolean(profile.displayName || profile.name) && Boolean(profile.gender);
}

export function buildGuestAuthProfile(profile = {}) {
    const photoURL = profile.photoURL || profile.avatar || null;
    return {
        uid: profile.uid || profile.id || null,
        displayName: profile.displayName || profile.name || "",
        email: profile.email || null,
        photoURL,
        avatar: photoURL,
        gender: profile.gender || null,
        city: profile.city || null,
        onboardingComplete: isGuestOnboardingComplete(profile),
    };
}

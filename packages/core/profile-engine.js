/**
 * THE C1RCLE - Master Profile Engine
 * Centralizes profile management, validation, and safe data updates.
 */

export const PROFILE_SAFE_FIELDS = [
    // Identity Layer
    "displayName", "bio", "coverImage", "profileImage", "photos",
    "photoURL", "coverURL", "tagline", "slug", "categoryTag", "username", "handle",
    // Location
    "city", "neighborhood", "address", "phone", "email", "website", "whatsapp",
    // Extended Social Links
    "socialLinks",
    // Genre & Style
    "genres", "styleTags",
    // Actions / CTA Layer
    "ctas",
    // Events & Highlights
    "pinnedEventIds",
    // Collaborations & Affiliations
    "collaborations", "affiliations",
    // Media Categories
    "mediaGallery", "videos",
    // Venue-specific
    "tags", "amenities", "openingHours", "capacity", "venueType",
    // Host-specific  
    "role", "achievements", "pressSnippets"
    // Note: status, visibility, isVerified, and isFeatured are ADMIN-ONLY fields and must not be here.
];

/**
 * Filters a profile update object to only include safe fields.
 */
export function filterSafeProfileUpdates(updates) {
    const safeUpdates = {};
    for (const field of PROFILE_SAFE_FIELDS) {
        if (updates[field] !== undefined) {
            safeUpdates[field] = updates[field];
        }
    }
    return safeUpdates;
}

export default {
    PROFILE_SAFE_FIELDS,
    filterSafeProfileUpdates
};

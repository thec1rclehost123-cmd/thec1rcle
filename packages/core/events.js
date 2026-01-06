/**
 * THE C1RCLE - Shared Event Utilities
 * Source of truth for lifecycle states, city normalization, and event mapping.
 */

// --- 1. Lifecycle States ---
export const EVENT_LIFECYCLE = {
    DRAFT: "draft",           // Private, only creator sees
    SUBMITTED: "submitted",   // Pending club/admin approval (if host created)
    NEEDS_CHANGES: "needs_changes", // Rejected with notes
    APPROVED: "approved",     // Approval received, ready for public status
    SCHEDULED: "scheduled",   // Publicly listed, tickets available (Future date)
    LIVE: "live",             // Currently happening
    COMPLETED: "completed",   // Event ended
    CANCELLED: "cancelled"    // Shutdown
};

export const PUBLIC_LIFECYCLE_STATES = [
    EVENT_LIFECYCLE.SCHEDULED,
    EVENT_LIFECYCLE.LIVE
];

// --- 2. City Normalization ---
export const CITY_MAP = [
    { key: "pune-in", label: "Pune, IN", matches: ["pune", "kp", "koregaon", "baner", "viman", "magarpatta", "hinjewadi", "kalyani"] },
    { key: "mumbai-in", label: "Mumbai, IN", matches: ["mumbai", "bandra", "andheri", "juhu", "worli", "colaba", "powai", "thane", "navi mumbai"] },
    { key: "bengaluru-in", label: "Bengaluru, IN", matches: ["bangalore", "bengaluru", "blr", "koramangala", "indiranagar", "hsr", "whitefield", "electronic city"] },
    { key: "goa-in", label: "Goa, IN", matches: ["goa", "anjuna", "morjim", "panjim", "panaji", "vagator", "baga", "calangute", "siolim", "assagao"] },
    { key: "delhi-in", label: "Delhi NCR, IN", matches: ["delhi", "gurgaon", "noida", "ncr", "saket", "hauz khas", "gurugram"] },
    { key: "hyderabad-in", label: "Hyderabad, IN", matches: ["hyderabad", "jubilee", "banjara", "hitech", "gachibowli"] },
    { key: "chennai-in", label: "Chennai, IN", matches: ["chennai", "madras", "adyar", "velachery", "omr"] },
    { key: "kolkata-in", label: "Kolkata, IN", matches: ["kolkata", "calcutta", "salt lake", "new town"] },
    { key: "jaipur-in", label: "Jaipur, IN", matches: ["jaipur", "pink city"] },
    { key: "chandigarh-in", label: "Chandigarh, IN", matches: ["chandigarh", "mohali", "panchkula"] }
];

export function normalizeCity(cityStr, locationStr = "") {
    const input = `${cityStr || ""} ${locationStr || ""}`.toLowerCase();

    // Find first matching city
    const found = CITY_MAP.find(c =>
        c.matches.some(m => input.includes(m)) ||
        input.includes(c.key) ||
        input.includes(c.label.toLowerCase())
    );

    return found ? found.key : "other-in";
}

export function getCityLabel(key) {
    const found = CITY_MAP.find(c => c.key === key);
    return found ? found.label : "Other City, IN";
}

// --- 3. Canonical Media Resolver ---
export function resolvePoster(event) {
    if (!event) return "/events/placeholder.svg";

    // Priority order for fields
    const poster = event.poster || event.image || event.flyer;
    if (poster && typeof poster === "string") return poster;

    // Check gallery/images arrays
    if (Array.isArray(event.images) && event.images.length > 0) return event.images[0];
    if (Array.isArray(event.gallery) && event.gallery.length > 0) return event.gallery[0];

    return "/events/placeholder.svg"; // Fallback
}

// --- 4. Canonical Event Mapper ---
/**
 * Maps a raw Firestore document to a consistent client-side object.
 * Used by Guest Portal, Partner Dashboard, and Admin Console.
 */
export function mapEventForClient(data, id) {
    if (!data) return null;

    const eventId = id || data.id || data.slug;
    const poster = resolvePoster(data);
    const cityKey = data.cityKey || normalizeCity(data.city, data.location);

    // Clean sensitive data (e.g. password codes for public consumption)
    const settings = data.settings ? { ...data.settings } : {};
    if (settings.passwordCode) delete settings.passwordCode;

    const creatorRole = data.creatorRole || (data.hostId ? "host" : "club");
    const eventType = creatorRole === "host" ? "host" : "club";
    let lifecycle = data.lifecycle || data.status || EVENT_LIFECYCLE.DRAFT;

    // Hardening: Club events never need approval. Normalize legacy 'submitted' states.
    if (eventType === "club" && (lifecycle === EVENT_LIFECYCLE.SUBMITTED || lifecycle === "pending")) {
        lifecycle = EVENT_LIFECYCLE.SCHEDULED;
    }

    // Derived Permission Flags (True for Club/Admin viewing in Partner Dashboard)
    const canApprove = eventType === "host" && (lifecycle === EVENT_LIFECYCLE.SUBMITTED || data.status === "pending");
    const canRequestEdits = eventType === "host" && (lifecycle === EVENT_LIFECYCLE.SUBMITTED || data.status === "pending");

    // Edit Rules:
    // Club can edit its own drafts.
    // Club can NEVER edit host content.
    const canEdit = eventType === "club" && lifecycle === EVENT_LIFECYCLE.DRAFT;

    return {
        ...data,
        id: eventId,
        poster,
        image: poster, // Maintain legacy compat
        posterUrl: poster, // Admin Console compatibility
        cityKey,
        cityLabel: getCityLabel(cityKey),
        lifecycle,
        eventType,
        canApprove,
        canEdit,
        canRequestEdits,
        settings,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        // Visibility flag helper for easy template logic
        isPublic: PUBLIC_LIFECYCLE_STATES.includes(lifecycle)
    };
}

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

const CLUBS_COLLECTION = "venues";
const HOSTS_COLLECTION = "hosts";
const PROFILE_POSTS_COLLECTION = "profile_posts";
const PROFILE_HIGHLIGHTS_COLLECTION = "profile_highlights";

/**
 * Helper to serialize Firestore docs to plain objects for RSC
 */
const serializeDoc = (doc) => {
    const data = doc.data();
    const serialized = { id: doc.id, ...data };

    // Convert Timestamps to ISO strings
    Object.keys(serialized).forEach(key => {
        if (serialized[key] && typeof serialized[key].toDate === 'function') {
            serialized[key] = serialized[key].toDate().toISOString();
        }
    });

    return serialized;
};

/**
 * Get posts for a profile (Venue or Host)
 */
export async function getProfilePosts(profileId, type, limit = 20) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROFILE_POSTS_COLLECTION)
        .where("profileId", "==", profileId)
        .where("profileType", "==", type)
        .limit(limit)
        .get();

    return snapshot.docs
        .map(serializeDoc)
        .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });
}

/**
 * Get highlights for a profile
 */
export async function getProfileHighlights(profileId, type) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROFILE_HIGHLIGHTS_COLLECTION)
        .where("profileId", "==", profileId)
        .where("profileType", "==", type)
        .get();

    const now = new Date().toISOString();
    return snapshot.docs
        .map(serializeDoc)
        .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        })
        .filter(h => h.permanent || !h.expiresAt || h.expiresAt > now);
}

/**
 * Get profile stats
 */
export async function getProfileStats(profileId, type) {
    if (!isFirebaseConfigured()) {
        return {
            followersCount: 1200,
            postsCount: 5,
            totalLikes: 450,
            totalViews: 2800
        };
    }

    // In a real app, these would be aggregated or read from a stats doc
    // For now we can fetch and count
    const posts = await getProfilePosts(profileId, type);
    const highlights = await getProfileHighlights(profileId, type);

    // Followers count is usually on the main profile doc
    const db = getAdminDb();
    const collection = type === "venue" ? CLUBS_COLLECTION : HOSTS_COLLECTION;
    const profileDoc = await db.collection(collection).doc(profileId).get();
    const profileData = profileDoc.data();

    return {
        followersCount: profileData?.followersCount || profileData?.followers || 0,
        postsCount: posts.length,
        highlightsCount: highlights.length,
        totalLikes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
        totalViews: highlights.reduce((sum, h) => sum + (h.views || 0), 0)
    };
}

/**
 * Profile Store — Direct Firebase Admin (no API gateway required)
 * 
 * Rewritten to use Firebase Admin directly so the partner-dashboard works 
 * without the gateway running in dev.
 */

import { getAdminDb } from "../firebase/admin";

/**
 * Utility to serialize Firestore documents for Next.js
 */
const serialize = (obj) => {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
            return new Date(value.seconds * 1000).toISOString();
        }
        return value;
    }));
};

/**
 * Get a club or host profile
 */
export async function getProfile(profileId, type = "venue") {
    const db = getAdminDb();
    const collection = type === "venue" ? "venues" : "hosts";
    try {
        const doc = await db.collection(collection).doc(profileId).get();
        if (!doc.exists) return null;
        return serialize({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("[ProfileStore] getProfile failed:", error.message);
        return null;
    }
}

/**
 * Update profile details
 */
export async function updateProfile(profileId, type = "venue", updates) {
    const db = getAdminDb();
    const collection = type === "venue" ? "venues" : "hosts";
    const data = {
        ...updates,
        updatedAt: new Date().toISOString()
    };
    await db.collection(collection).doc(profileId).update(data);
    return { id: profileId, ...data };
}

/**
 * Get posts for a profile
 */
export async function getProfilePosts(profileId, type, limitCount = 20) {
    const db = getAdminDb();
    try {
        const snapshot = await db.collection("posts")
            .where("profileId", "==", profileId)
            .where("isActive", "==", true)
            .orderBy("createdAt", "desc")
            .limit(limitCount)
            .get();
        return serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
        console.error("[ProfileStore] getProfilePosts failed:", error.message);
        return [];
    }
}

/**
 * Get highlights for a profile
 */
export async function getProfileHighlights(profileId, type) {
    const db = getAdminDb();
    try {
        const snapshot = await db.collection("profile_highlights")
            .where("profileId", "==", profileId)
            .where("isActive", "==", true)
            .get();
        return serialize(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
        console.error("[ProfileStore] getProfileHighlights failed:", error.message);
        return [];
    }
}

/**
 * Get profile statistics
 */
export async function getProfileStats(profileId, type) {
    // This is often aggregated in Realtime or periodic jobs.
    // For now, return basic counts.
    try {
        const [posts, highlights, profile] = await Promise.all([
            getProfilePosts(profileId, type, 1),
            getProfileHighlights(profileId, type),
            getProfile(profileId, type)
        ]);

        return {
            followersCount: profile?.followersCount || 0,
            postsCount: posts.length,
            highlightsCount: highlights.length,
            totalLikes: profile?.totalLikes || 0,
            totalViews: profile?.totalViews || 0
        };
    } catch (error) {
        return { followersCount: 0, postsCount: 0, highlightsCount: 0 };
    }
}

/**
 * Create a new post for a profile
 */
export async function createPost(profileId, type, data) {
    const db = getAdminDb();
    const post = {
        ...data,
        profileId,
        profileType: type,
        isActive: true,
        createdAt: new Date().toISOString()
    };
    const docRef = await db.collection("posts").add(post);
    return { id: docRef.id, ...post };
}

/**
 * Create a new highlight for a profile
 */
export async function createHighlight(profileId, type, data) {
    const db = getAdminDb();
    const highlight = {
        ...data,
        profileId,
        isActive: true,
        createdAt: new Date().toISOString()
    };
    const docRef = await db.collection("profile_highlights").add(highlight);
    return { id: docRef.id, ...highlight };
}

/**
 * Delete a post
 */
export async function deletePost(postId) {
    const db = getAdminDb();
    await db.collection("posts").doc(postId).update({
        isActive: false,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId) {
    const db = getAdminDb();
    await db.collection("profile_highlights").doc(highlightId).update({
        isActive: false,
        updatedAt: new Date().toISOString()
    });
    return { success: true };
}

export default {
    getProfile,
    updateProfile,
    getProfilePosts,
    getProfileHighlights,
    getProfileStats,
    createPost,
    createHighlight,
    deletePost,
    deleteHighlight
};



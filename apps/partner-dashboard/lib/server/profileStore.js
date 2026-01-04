/**
 * Profile Store
 * Manages club and host public profiles for discovery pages
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const CLUBS_COLLECTION = "clubs";
const HOSTS_COLLECTION = "hosts";
const PROFILE_POSTS_COLLECTION = "profile_posts";
const PROFILE_HIGHLIGHTS_COLLECTION = "profile_highlights";

// Fallback storage for development
let fallbackProfiles = {
    clubs: [],
    hosts: []
};

/**
 * Get a club or host profile
 */
export async function getProfile(profileId, type = "club") {
    const collection = type === "club" ? CLUBS_COLLECTION : HOSTS_COLLECTION;

    if (!isFirebaseConfigured()) {
        return fallbackProfiles[type + "s"]?.find(p => p.id === profileId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(collection).doc(profileId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * Update profile details
 */
export async function updateProfile(profileId, type = "club", updates, updatedBy) {
    const collection = type === "club" ? CLUBS_COLLECTION : HOSTS_COLLECTION;
    const now = new Date().toISOString();

    const updateData = {
        ...updates,
        updatedAt: now,
        lastUpdatedBy: {
            uid: updatedBy.uid,
            name: updatedBy.name || ""
        }
    };

    // Only allow safe fields
    const safeFields = [
        "displayName", "bio", "coverImage", "profileImage", "photos",
        "city", "address", "phone", "email", "website", "socialLinks",
        "tags", "amenities", "openingHours"
    ];

    const safeUpdates = {};
    for (const field of safeFields) {
        if (updateData[field] !== undefined) {
            safeUpdates[field] = updateData[field];
        }
    }
    safeUpdates.updatedAt = now;
    safeUpdates.lastUpdatedBy = updateData.lastUpdatedBy;

    if (!isFirebaseConfigured()) {
        const list = fallbackProfiles[type + "s"];
        const index = list.findIndex(p => p.id === profileId);
        if (index >= 0) {
            list[index] = { ...list[index], ...safeUpdates };
            return list[index];
        }
        return null;
    }

    const db = getAdminDb();
    await db.collection(collection).doc(profileId).update(safeUpdates);
    return await getProfile(profileId, type);
}

/**
 * Update cover image (discovery card)
 */
export async function updateCoverImage(profileId, type, imageUrl, updatedBy) {
    return await updateProfile(profileId, type, { coverImage: imageUrl }, updatedBy);
}

/**
 * Add a photo to the gallery
 */
export async function addPhoto(profileId, type, photoUrl, updatedBy) {
    const profile = await getProfile(profileId, type);
    if (!profile) throw new Error("Profile not found");

    const photos = [...(profile.photos || []), photoUrl];
    return await updateProfile(profileId, type, { photos }, updatedBy);
}

/**
 * Remove a photo from the gallery
 */
export async function removePhoto(profileId, type, photoUrl, updatedBy) {
    const profile = await getProfile(profileId, type);
    if (!profile) throw new Error("Profile not found");

    const photos = (profile.photos || []).filter(p => p !== photoUrl);
    return await updateProfile(profileId, type, { photos }, updatedBy);
}

/**
 * Create a post on the profile
 */
export async function createPost(profileId, type, postData, createdBy) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const post = {
        id,
        profileId,
        profileType: type,
        content: postData.content || "",
        imageUrl: postData.imageUrl || null,
        videoUrl: postData.videoUrl || null,
        likes: 0,
        comments: 0,
        createdBy: {
            uid: createdBy.uid,
            name: createdBy.name || ""
        },
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        // Just return the post for development
        return post;
    }

    const db = getAdminDb();
    await db.collection(PROFILE_POSTS_COLLECTION).doc(id).set(post);
    return post;
}

/**
 * Get posts for a profile
 */
export async function getProfilePosts(profileId, type, limit = 20) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PROFILE_POSTS_COLLECTION)
        .where("profileId", "==", profileId)
        .where("profileType", "==", type)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Delete a post
 */
export async function deletePost(postId, deletedBy) {
    if (!isFirebaseConfigured()) {
        return { deleted: true };
    }

    const db = getAdminDb();
    await db.collection(PROFILE_POSTS_COLLECTION).doc(postId).delete();
    return { deleted: true };
}

/**
 * Create a highlight (story-style)
 */
export async function createHighlight(profileId, type, highlightData, createdBy) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const highlight = {
        id,
        profileId,
        profileType: type,
        imageUrl: highlightData.imageUrl,
        caption: highlightData.caption || "",
        likes: 0,
        views: 0,
        expiresAt: highlightData.permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        permanent: highlightData.permanent || false,
        createdBy: {
            uid: createdBy.uid,
            name: createdBy.name || ""
        },
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        return highlight;
    }

    const db = getAdminDb();
    await db.collection(PROFILE_HIGHLIGHTS_COLLECTION).doc(id).set(highlight);
    return highlight;
}

/**
 * Get highlights for a profile
 */
export async function getProfileHighlights(profileId, type, includeExpired = false) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    let query = db.collection(PROFILE_HIGHLIGHTS_COLLECTION)
        .where("profileId", "==", profileId)
        .where("profileType", "==", type);

    const snapshot = await query.orderBy("createdAt", "desc").get();

    let highlights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter expired highlights unless includeExpired
    if (!includeExpired) {
        const now = new Date().toISOString();
        highlights = highlights.filter(h =>
            h.permanent || !h.expiresAt || h.expiresAt > now
        );
    }

    return highlights;
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId) {
    if (!isFirebaseConfigured()) {
        return { deleted: true };
    }

    const db = getAdminDb();
    await db.collection(PROFILE_HIGHLIGHTS_COLLECTION).doc(highlightId).delete();
    return { deleted: true };
}

/**
 * Get profile statistics
 */
export async function getProfileStats(profileId, type) {
    const profile = await getProfile(profileId, type);
    if (!profile) return null;

    const posts = await getProfilePosts(profileId, type);
    const highlights = await getProfileHighlights(profileId, type);

    return {
        followersCount: profile.followersCount || 0,
        postsCount: posts.length,
        highlightsCount: highlights.length,
        totalLikes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
        totalViews: highlights.reduce((sum, h) => sum + (h.views || 0), 0)
    };
}

/**
 * Get featured profiles for discovery
 */
export async function getFeaturedProfiles(type = "club", limit = 10) {
    if (!isFirebaseConfigured()) {
        return [];
    }

    const db = getAdminDb();
    const collection = type === "club" ? CLUBS_COLLECTION : HOSTS_COLLECTION;

    const snapshot = await db.collection(collection)
        .where("isVerified", "==", true)
        .orderBy("followersCount", "desc")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

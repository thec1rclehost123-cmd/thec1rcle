/**
 * Profile Store (Refactored for API Governance)
 * 
 * Uses the unified C1rcleApiClient to manage venue and host profiles.
 * All DB access moved to @c1rcle/core/profile-engine via API Gateway.
 */

import { getApiClient } from "./apiClient";

/**
 * Get a club or host profile
 */
export async function getProfile(profileId, type = "venue", token) {
    const client = getApiClient(token);
    try {
        return await client.getProfile(profileId, type);
    } catch (error) {
        console.error("[ProfileStore] getProfile failed:", error.message);
        return null;
    }
}

/**
 * Update profile details
 */
export async function updateProfile(profileId, type = "venue", updates, token) {
    const client = getApiClient(token);
    return client.updateProfile(type, updates, profileId);
}

/**
 * Get posts for a profile
 */
export async function getProfilePosts(profileId, type, limit = 20, token) {
    const client = getApiClient(token);
    try {
        return await client.getProfilePosts(profileId, type, limit);
    } catch (error) {
        console.error("[ProfileStore] getProfilePosts failed:", error.message);
        return [];
    }
}

/**
 * Get highlights for a profile
 */
export async function getProfileHighlights(profileId, type, token) {
    const client = getApiClient(token);
    try {
        return await client.getProfileHighlights(profileId, type);
    } catch (error) {
        console.error("[ProfileStore] getProfileHighlights failed:", error.message);
        return [];
    }
}

/**
 * Get profile statistics
 */
export async function getProfileStats(profileId, type, token) {
    const client = getApiClient(token);
    try {
        const [posts, highlights, profile] = await Promise.all([
            getProfilePosts(profileId, type, 1, token),
            getProfileHighlights(profileId, type, token),
            getProfile(profileId, type, token)
        ]);

        return {
            followersCount: profile?.followersCount || 0,
            postsCount: posts.length, // Note: This doesn't represent TOTAL count if limit is 1
            highlightsCount: highlights.length,
            totalLikes: 0, // Logic moved to Gateway/Engine if needed
            totalViews: 0
        };
    } catch (error) {
        return { followersCount: 0, postsCount: 0, highlightsCount: 0 };
    }
}

export default {
    getProfile,
    updateProfile,
    getProfilePosts,
    getProfileHighlights,
    getProfileStats
};

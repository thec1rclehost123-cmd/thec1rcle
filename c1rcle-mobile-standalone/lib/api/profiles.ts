/**
 * Profile API Client - Syncs with Partner Dashboard Profile Management
 * Handles venue/host posts, highlights, and extended profile data
 */

import { getFirebaseDb } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    Timestamp
} from "firebase/firestore";

// ==================== INTERFACES ====================

export interface ProfilePost {
    id: string;
    profileId: string;
    profileType: "venue" | "host";
    content: string;
    imageUrl?: string;
    videoUrl?: string;
    likes: number;
    comments: number;
    createdBy: {
        uid: string;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface ProfileHighlight {
    id: string;
    profileId: string;
    profileType: "venue" | "host";
    title: string;
    color: string;
    imageUrl?: string;
    caption?: string;
    likes: number;
    views: number;
    expiresAt?: string;
    permanent: boolean;
    createdBy: {
        uid: string;
        name: string;
    };
    createdAt: string;
}

export interface ProfileStats {
    followersCount: number;
    postsCount: number;
    highlightsCount: number;
    totalLikes: number;
    totalViews: number;
}

// ==================== HELPERS ====================

/**
 * Serialize Firestore document to plain object
 * Handles Timestamps and other Firestore-specific types
 */
function serializeDoc(data: any): any {
    if (!data) return data;
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeDoc);
    }
    if (typeof data === "object" && data !== null) {
        const result: any = {};
        for (const key of Object.keys(data)) {
            result[key] = serializeDoc(data[key]);
        }
        return result;
    }
    return data;
}

// ==================== POSTS ====================

/**
 * Fetch posts for a venue or host profile
 * Syncs with Partner Dashboard's profile_posts collection
 */
export async function getProfilePosts(
    profileId: string,
    profileType: "venue" | "host" = "venue",
    postLimit: number = 20
): Promise<ProfilePost[]> {
    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, "profile_posts"),
            where("profileId", "==", profileId),
            where("profileType", "==", profileType),
            orderBy("createdAt", "desc"),
            firestoreLimit(postLimit)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => serializeDoc({
            id: doc.id,
            ...doc.data()
        })) as ProfilePost[];
    } catch (error) {
        console.error("[ProfilesAPI] Error fetching posts:", error);
        return [];
    }
}

// ==================== HIGHLIGHTS ====================

/**
 * Fetch highlights for a venue or host profile
 * Syncs with Partner Dashboard's profile_highlights collection
 */
export async function getProfileHighlights(
    profileId: string,
    profileType: "venue" | "host" = "venue",
    includeExpired: boolean = false
): Promise<ProfileHighlight[]> {
    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, "profile_highlights"),
            where("profileId", "==", profileId),
            where("profileType", "==", profileType),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        let highlights = snapshot.docs.map(doc => serializeDoc({
            id: doc.id,
            ...doc.data()
        })) as ProfileHighlight[];

        // Filter expired unless requested
        if (!includeExpired) {
            const now = new Date().toISOString();
            highlights = highlights.filter(h =>
                h.permanent || !h.expiresAt || h.expiresAt > now
            );
        }

        return highlights;
    } catch (error) {
        console.error("[ProfilesAPI] Error fetching highlights:", error);
        return [];
    }
}

// ==================== FULL PROFILE DATA ====================

/**
 * Fetch complete profile data including posts and highlights
 * This mirrors the Partner Dashboard's /api/profile endpoint
 */
export async function getFullProfileData(
    profileId: string,
    profileType: "venue" | "host" = "venue"
): Promise<{
    posts: ProfilePost[];
    highlights: ProfileHighlight[];
    stats: ProfileStats;
} | null> {
    try {
        const [posts, highlights] = await Promise.all([
            getProfilePosts(profileId, profileType),
            getProfileHighlights(profileId, profileType)
        ]);

        const stats: ProfileStats = {
            followersCount: 0, // This comes from the venue/host doc
            postsCount: posts.length,
            highlightsCount: highlights.length,
            totalLikes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
            totalViews: highlights.reduce((sum, h) => sum + (h.views || 0), 0)
        };

        return { posts, highlights, stats };
    } catch (error) {
        console.error("[ProfilesAPI] Error fetching full profile:", error);
        return null;
    }
}

// ==================== VENUE-SPECIFIC HELPERS ====================

/**
 * Fetch venue with its posts and highlights combined
 * This is the primary method for the venue detail screen
 */
export async function getVenueWithContent(venueId: string): Promise<{
    posts: ProfilePost[];
    highlights: ProfileHighlight[];
} | null> {
    return getFullProfileData(venueId, "venue");
}

/**
 * Fetch host with their posts and highlights combined
 */
export async function getHostWithContent(hostId: string): Promise<{
    posts: ProfilePost[];
    highlights: ProfileHighlight[];
} | null> {
    return getFullProfileData(hostId, "host");
}

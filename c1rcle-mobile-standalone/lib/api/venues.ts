/**
 * Venue API Client
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
    runTransaction,
    serverTimestamp,
    deleteDoc,
    setDoc
} from "firebase/firestore";

export interface Venue {
    id: string;
    slug: string;
    name: string;
    area: string;
    neighborhood?: string;
    address?: string;
    image?: string;
    coverURL?: string;
    coverImage?: string; // Partner Dashboard uses this field
    profileImage?: string;
    photoURL?: string;
    followers: number;
    followersCount?: number; // Alternative field name from Partner Dashboard
    tags: string[];
    vibes?: string[]; // Genre/vibe tags for filtering
    genres?: string[]; // Music genres
    styleTags?: string[]; // Style descriptors
    tablesAvailable: boolean;
    description?: string;
    bio?: string;
    tagline?: string;
    rules?: string[];
    dressCode?: string;
    isVerified?: boolean;
    isFeatured?: boolean;
    primaryCta?: string;
    whatsapp?: string;
    website?: string;
    phone?: string;
    email?: string;
    socialLinks?: {
        instagram?: string;
        twitter?: string;
        spotify?: string;
        soundcloud?: string;
        youtube?: string;
        tiktok?: string;
    };
    specialty?: string;
    venueType?: string;
    capacity?: number;
    amenities?: string[];
    timings?: {
        [key: string]: string;
    };
    openingHours?: {
        [key: string]: string;
    };
    city?: string;
    photos?: string[];
    mediaGallery?: {
        photos?: string[];
        flyers?: string[];
        press?: string[];
    };
    videos?: Array<{
        url: string;
        type: string;
        title?: string;
        thumbnail?: string;
    }>;
    businessDetails?: {
        gst?: string;
        fssai?: string;
        registeredName?: string;
        placeName?: string;
    };
    gst?: string;
    fssai?: string;
    registeredName?: string;
    placeName?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    // CTA configuration from Partner Dashboard
    ctas?: Array<{
        type: "primary" | "secondary";
        label: string;
        action: string;
        url?: string;
    }>;
    // Collaboration data
    collaborations?: Array<{
        name: string;
        type: string;
        logo?: string;
        verified?: boolean;
    }>;
    affiliations?: string[];
    // Pinned events
    pinnedEventIds?: string[];
}

/**
 * Fetch venue details by ID or Slug
 */
export async function getVenue(idOrSlug: string): Promise<Venue | null> {
    const db = getFirebaseDb();

    // Try by document ID first
    const venueRef = doc(db, "venues", idOrSlug);
    const snap = await getDoc(venueRef);

    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Venue;
    }

    // Try by slug
    const q = query(collection(db, "venues"), where("slug", "==", idOrSlug));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Venue;
    }

    return null;
}

/**
 * Follow a venue
 */
export async function followVenue(venueId: string, userId: string): Promise<boolean> {
    const db = getFirebaseDb();
    const followId = `${venueId}_${userId}`;
    const followRef = doc(db, "venue_follows", followId);
    const venueRef = doc(db, "venues", venueId);

    try {
        await runTransaction(db, async (transaction) => {
            const followSnap = await transaction.get(followRef);
            if (followSnap.exists()) return; // Already following

            transaction.set(followRef, {
                venueId,
                userId,
                createdAt: serverTimestamp()
            });

            // Increment follower count on venue
            const venueSnap = await transaction.get(venueRef);
            if (venueSnap.exists()) {
                const currentFollowers = venueSnap.data().followers || 0;
                transaction.update(venueRef, {
                    followers: currentFollowers + 1
                });
            }
        });
        return true;
    } catch (e) {
        console.error("Error following venue:", e);
        return false;
    }
}

/**
 * Unfollow a venue
 */
export async function unfollowVenue(venueId: string, userId: string): Promise<boolean> {
    const db = getFirebaseDb();
    const followId = `${venueId}_${userId}`;
    const followRef = doc(db, "venue_follows", followId);
    const venueRef = doc(db, "venues", venueId);

    try {
        await runTransaction(db, async (transaction) => {
            const followSnap = await transaction.get(followRef);
            if (!followSnap.exists()) return; // Not following

            transaction.delete(followRef);

            // Decrement follower count on venue
            const venueSnap = await transaction.get(venueRef);
            if (venueSnap.exists()) {
                const currentFollowers = venueSnap.data().followers || 0;
                transaction.update(venueRef, {
                    followers: Math.max(0, currentFollowers - 1)
                });
            }
        });
        return true;
    } catch (e) {
        console.error("Error unfollowing venue:", e);
        return false;
    }
}

/**
 * Check if following
 */
export async function isFollowing(venueId: string, userId: string): Promise<boolean> {
    const db = getFirebaseDb();
    const followId = `${venueId}_${userId}`;
    const followRef = doc(db, "venue_follows", followId);
    const snap = await getDoc(followRef);
    return snap.exists();
}

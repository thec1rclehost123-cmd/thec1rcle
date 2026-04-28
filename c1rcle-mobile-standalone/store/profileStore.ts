/**
 * User Profile Store
 * Extended user profile data beyond Firebase Auth
 */

import { create } from "zustand";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    coverPhotoUrl?: string;  // Cover photo for Orb-style profile
    bio?: string;
    tagline?: string;  // Short tagline (e.g., "Nightlife explorer • Loves techno")
    city?: string;
    phone?: string;
    gender?: "male" | "female" | "other" | "prefer_not_to_say";
    dateOfBirth?: string;
    createdAt: string;
    updatedAt: string;

    // Social
    eventsAttended?: number;
    connections?: number;
    followingVenues?: string[]; // List of venue IDs
    instagram?: string; // Instagram handle
    snapchat?: string; // Snapchat handle

    // Privacy
    privacy?: {
        showUpcomingEvents: boolean;
        showAttendedEvents: boolean;
        showStats: boolean;
        isPrivateProfile: boolean;
    };

    // Status
    isVerified?: boolean;
    isPremium?: boolean;
}

interface ProfileState {
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;

    // Actions
    loadProfile: (userId: string) => Promise<void>;
    updateProfile: (userId: string, updates: Partial<UserProfile>) => Promise<boolean>;
    toggleFollowVenue: (userId: string, venueId: string) => Promise<void>;
    subscribeToProfile: (userId: string) => () => void;
    clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
    profile: null,
    loading: false,
    error: null,

    loadProfile: async (userId: string) => {
        set({ loading: true, error: null });

        try {
            const db = getFirebaseDb();
            const profileRef = doc(db, "users", userId);
            const snapshot = await getDoc(profileRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                set({
                    profile: {
                        uid: userId,
                        ...data,
                    } as UserProfile,
                    loading: false,
                });
            } else {
                // Create initial profile
                const initialProfile: UserProfile = {
                    uid: userId,
                    email: "",
                    displayName: "",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                await setDoc(profileRef, initialProfile);
                set({ profile: initialProfile, loading: false });
            }
        } catch (error: any) {
            console.error("Error loading profile:", error);
            set({ error: error.message, loading: false });
        }
    },

    updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
        const { profile } = get();

        // Optimistic update
        if (profile) {
            set({
                profile: {
                    ...profile,
                    ...updates,
                    updatedAt: new Date().toISOString(),
                },
            });
        }

        try {
            const db = getFirebaseDb();
            const profileRef = doc(db, "users", userId);

            await updateDoc(profileRef, {
                ...updates,
                updatedAt: new Date().toISOString(),
            });

            return true;
        } catch (error: any) {
            console.error("Error updating profile:", error);
            set({ error: error.message });

            // Revert optimistic update
            if (profile) {
                set({ profile });
            }

            return false;
        }
    },

    subscribeToProfile: (userId: string) => {
        const db = getFirebaseDb();
        const profileRef = doc(db, "users", userId);

        const unsubscribe = onSnapshot(profileRef, (snapshot) => {
            if (snapshot.exists()) {
                set({
                    profile: {
                        uid: userId,
                        ...snapshot.data(),
                    } as UserProfile,
                });
            }
        }, (error) => {
            console.error("Profile subscription error:", error);
            set({ error: error.message });
        });

        return unsubscribe;
    },

    toggleFollowVenue: async (userId: string, venueId: string) => {
        const { profile } = get();
        if (!profile) return;

        const { followVenue, unfollowVenue } = await import("@/lib/api/venues");

        const isFollowing = profile.followingVenues?.includes(venueId);
        const newFollowing = isFollowing
            ? (profile.followingVenues || []).filter(id => id !== venueId)
            : [...(profile.followingVenues || []), venueId];

        // Optimistic update
        set({
            profile: {
                ...profile,
                followingVenues: newFollowing
            }
        });

        try {
            const db = getFirebaseDb();
            const profileRef = doc(db, "users", userId);

            if (isFollowing) {
                await unfollowVenue(venueId, userId);
            } else {
                await followVenue(venueId, userId);
            }

            await updateDoc(profileRef, {
                followingVenues: newFollowing,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error toggling venue follow:", error);
            // Revert optimistic update
            set({ profile });
        }
    },

    clearProfile: () => {
        set({ profile: null, loading: false, error: null });
    },
}));

export default useProfileStore;

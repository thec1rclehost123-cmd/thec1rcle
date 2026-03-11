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
    bio?: string;
    city?: string;
    phone?: string;
    gender?: "male" | "female" | "other" | "prefer_not_to_say";
    dateOfBirth?: string;
    createdAt: string;
    updatedAt: string;

    // Social
    eventsAttended?: number;
    connections?: number;

    // Personalisation
    vibeTags?: string[];

    // Status
    isVerified?: boolean;
    isPremium?: boolean;
}

interface ProfileState {
    profile: UserProfile | null;
    loading: boolean;
    error: string | null;
    _unsubscribe: (() => void) | null;

    // Actions
    loadProfile: (userId: string) => Promise<void>;
    updateProfile: (userId: string, updates: Partial<UserProfile>) => Promise<boolean>;
    subscribeToProfile: (userId: string) => () => void;
    clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
    profile: null,
    loading: false,
    error: null,
    _unsubscribe: null,

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
        // Clean up any existing subscription before starting a new one
        get()._unsubscribe?.();

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

        set({ _unsubscribe: unsubscribe });
        return unsubscribe;
    },

    clearProfile: () => {
        // Unsubscribe from Firestore before clearing state
        get()._unsubscribe?.();
        set({ profile: null, loading: false, error: null, _unsubscribe: null });
    },
}));

export default useProfileStore;

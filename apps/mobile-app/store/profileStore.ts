/**
 * User Profile Store
 * Extended user profile data beyond Firebase Auth
 */

import { create } from "zustand";
// @c1rcle/types provides the canonical Profile shape. The local UserProfile interface below
// extends it with mobile-specific fields (gender, vibeTags, isPremium, etc.).
// When harmonizing: import type { Profile as BaseProfile } from '@c1rcle/types';
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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

function omitUndefined<T extends Record<string, any>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T;
}

function normalizeProfile(userId: string, data?: Partial<UserProfile>): UserProfile {
    const authUser = getFirebaseAuth().currentUser;
    const now = new Date().toISOString();
    const rawData = (data ?? {}) as Record<string, any>;

    return {
        uid: userId,
        email: rawData.email ?? authUser?.email ?? "",
        displayName: rawData.displayName ?? rawData.name ?? authUser?.displayName ?? "",
        photoURL: rawData.photoURL ?? rawData.avatar ?? authUser?.photoURL ?? "",
        bio: rawData.bio ?? "",
        city: rawData.city ?? "",
        phone: rawData.phone ?? rawData.phoneNumber ?? authUser?.phoneNumber ?? "",
        gender: data?.gender,
        dateOfBirth: data?.dateOfBirth,
        createdAt: rawData.createdAt ?? authUser?.metadata.creationTime ?? now,
        updatedAt: rawData.updatedAt ?? now,
        eventsAttended: data?.eventsAttended,
        connections: data?.connections,
        vibeTags: data?.vibeTags,
        isVerified: data?.isVerified,
        isPremium: data?.isPremium,
    };
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
                set({
                    profile: normalizeProfile(userId, snapshot.data()),
                    loading: false,
                });
            } else {
                const initialProfile = normalizeProfile(userId);
                await setDoc(profileRef, initialProfile, { merge: true });
                set({ profile: initialProfile, loading: false });
            }
        } catch (error: any) {
            console.error("Error loading profile:", error);
            set({ error: error.message, loading: false });
        }
    },

    updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
        const { profile } = get();
        const now = new Date().toISOString();
        const nextProfile = normalizeProfile(userId, {
            ...(profile ?? {}),
            ...updates,
            updatedAt: now,
        });

        // Optimistic update
        set({ profile: nextProfile, error: null });

        try {
            const db = getFirebaseDb();
            const profileRef = doc(db, "users", userId);
            const payload = omitUndefined({
                ...nextProfile,
                ...updates,
                uid: userId,
                updatedAt: now,
            });

            await setDoc(profileRef, payload, { merge: true });

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
                    profile: normalizeProfile(userId, snapshot.data()),
                    loading: false,
                });
            } else {
                set({
                    profile: normalizeProfile(userId),
                    loading: false,
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

/**
 * User Profile Store
 * Extended user profile data beyond Firebase Auth
 */

import { create } from 'zustand';
// @c1rcle/types provides the canonical Profile shape. The local UserProfile interface below
// extends it with mobile-specific fields (gender, vibeTags, isPremium, etc.).
// When harmonizing: import type { Profile as BaseProfile } from '@c1rcle/types';
import { getFirebaseAuth } from '@/lib/firebase';
import { getFirebaseApp } from '@/lib/firebase/client';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

function getDb() {
  return getFirestore(getFirebaseApp());
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
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
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function normalizeProfile(userId: string, data?: Partial<UserProfile>): UserProfile {
  const authUser = getFirebaseAuth().currentUser;
  const now = new Date().toISOString();
  const rawData = (data ?? {}) as Record<string, any>;

  return {
    uid: userId,
    email: rawData.email ?? authUser?.email ?? '',
    displayName: rawData.displayName ?? rawData.name ?? authUser?.displayName ?? '',
    photoURL: rawData.photoURL ?? rawData.avatar ?? authUser?.photoURL ?? '',
    bio: rawData.bio ?? '',
    city: rawData.city ?? '',
    phone: rawData.phone ?? rawData.phoneNumber ?? authUser?.phoneNumber ?? '',
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
      const docSnap = await getDoc(doc(getDb(), 'users', userId));
      const data = docSnap.exists() ? docSnap.data() : undefined;
      const profile = normalizeProfile(userId, data);

      if (!docSnap.exists()) {
        // First-time user: write initial profile to Firestore
        await setDoc(doc(getDb(), 'users', userId), omitUndefined(profile), { merge: true });
      }

      set({ profile, loading: false });
    } catch (error: any) {
      console.error('Error loading profile:', error);
      // Fallback to auth-derived profile so the app stays usable
      set({ profile: normalizeProfile(userId), error: error.message, loading: false });
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
      await setDoc(doc(getDb(), 'users', userId), omitUndefined({ ...updates, updatedAt: now }), {
        merge: true,
      });
      return true;
    } catch (error: any) {
      console.error('Error updating profile:', error);
      set({ error: error.message });
      if (profile) set({ profile }); // revert
      return false;
    }
  },

  subscribeToProfile: (userId: string) => {
    // Since we migrated away from direct Firebase, we just fetch it once
    // To implement realtime safely via API Gateway requires websockets/polling
    get()._unsubscribe?.();

    get().loadProfile(userId);

    // Return dummy unsubscribe
    const unsubscribe = () => {};
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

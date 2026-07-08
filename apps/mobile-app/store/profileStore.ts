/**
 * User Profile Store
 * Extended user profile data beyond Firebase Auth
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @c1rcle/types provides the canonical Profile shape. The local UserProfile interface below
// extends it with mobile-specific fields (gender, vibeTags, isPremium, etc.).
// When harmonizing: import type { Profile as BaseProfile } from '@c1rcle/types';
import { apiFetch, deduplicateRequest } from '@/lib/api';

const NIGHTLIFE_PROFILE_PROMPT_DISMISSED_KEY = 'c1rcle_nightlife_profile_prompt_dismissed';

export interface DatingVitals {
  height?: string | null;
  gender?: string | null;
  location?: string | null;
}

export interface ProfileAnthem {
  trackId?: string;
  trackName: string;
  artistName: string;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  source?: 'itunes' | 'spotify';
  externalUrl?: string | null;
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface UserSubscription {
  tier: 'free' | 'premium';
  status?: string | null;
  expiresAt?: string | null;
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
  instagram?: string;
  spotify?: string;
  spotifyConnected?: boolean;
  spotifyProfile?: SpotifyProfile | null;
  datingActive?: boolean;
  datingPhotos?: string[];
  datingVitals?: DatingVitals;
  anthem?: ProfileAnthem | null;
  photos?: string[];
  socialProfile?: { state?: string } & Record<string, unknown>;
  notificationPreferences?: Record<string, boolean>;
  pushNewMatches?: boolean;
  pushEventUpdates?: boolean;

  // Personalisation
  vibeTags?: string[];
  prompts?: any[];

  // Onboarding funnel
  basicSetupComplete?: boolean;
  profileSetupComplete?: boolean;
  profileComplete?: boolean;
  onboardingComplete?: boolean;
  socialSetupComplete?: boolean;

  // Status
  isVerified?: boolean;
  isPremium?: boolean;
  subscription?: UserSubscription;
  supportQueue?: 'standard' | 'priority';
}

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  _unsubscribe: (() => void) | null;
  _loadPromise: Promise<void> | null;
  nightlifePromptDismissed: boolean;
  /** Tracks loaded userId to prevent redundant re-fetches */
  _loadedUserId: string | null;

  // Actions
  loadProfile: (userId: string) => Promise<void>;
  updateProfile: (userId: string, updates: Partial<UserProfile>) => Promise<boolean>;
  hydrateNightlifePromptDismissed: () => Promise<void>;
  dismissNightlifePrompt: () => Promise<void>;
  setProfileFromGateway: (userId: string, profile: Partial<UserProfile>) => void;
  subscribeToProfile: (userId: string) => () => void;
  clearProfile: () => void;
  /** Called by socialProfileStore after mutations to invalidate cached profile */
  invalidateProfileCache: () => void;
}

function omitUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function normalizeDatingVitals(value: unknown): DatingVitals | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  return {
    height: typeof raw.height === 'string' || raw.height === null ? raw.height : undefined,
    gender: typeof raw.gender === 'string' || raw.gender === null ? raw.gender : undefined,
    location: typeof raw.location === 'string' || raw.location === null ? raw.location : undefined,
  };
}

function normalizeAnthem(value: unknown): ProfileAnthem | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const trackName = typeof raw.trackName === 'string' ? raw.trackName : '';
  const artistName = typeof raw.artistName === 'string' ? raw.artistName : '';
  if (!trackName || !artistName) return undefined;

  return {
    trackId: typeof raw.trackId === 'string' ? raw.trackId : undefined,
    trackName,
    artistName,
    artworkUrl:
      typeof raw.artworkUrl === 'string' || raw.artworkUrl === null ? raw.artworkUrl : undefined,
    previewUrl:
      typeof raw.previewUrl === 'string' || raw.previewUrl === null ? raw.previewUrl : undefined,
    source: raw.source === 'spotify' || raw.source === 'itunes' ? raw.source : undefined,
    externalUrl:
      typeof raw.externalUrl === 'string' || raw.externalUrl === null ? raw.externalUrl : undefined,
  };
}

function normalizeSubscription(value: unknown, legacyPremium?: boolean): UserSubscription {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const tier = raw.tier === 'premium' || legacyPremium === true ? 'premium' : 'free';
  return {
    tier,
    status:
      typeof raw.status === 'string' ? raw.status : tier === 'premium' ? 'active' : 'inactive',
    expiresAt:
      typeof raw.expiresAt === 'string' || raw.expiresAt === null ? raw.expiresAt : undefined,
  };
}

function normalizeProfile(userId: string, data?: Partial<UserProfile>): UserProfile {
  const now = new Date().toISOString();
  const rawData = (data ?? {}) as Record<string, any>;
  const socialState = rawData.socialProfile?.state;
  const socialSetupComplete =
    rawData.socialSetupComplete === true ||
    socialState === 'complete' ||
    socialState === 'verified';
  const basicSetupComplete =
    rawData.basicSetupComplete === true ||
    rawData.profileSetupComplete === true ||
    rawData.profileComplete === true;

  return {
    uid: userId,
    email: rawData.email ?? '',
    displayName: rawData.displayName ?? rawData.name ?? '',
    photoURL: rawData.photoURL ?? rawData.avatar ?? '',
    bio: rawData.bio ?? '',
    city: rawData.city ?? '',
    phone: rawData.phone ?? rawData.phoneNumber ?? '',
    gender: data?.gender,
    dateOfBirth: data?.dateOfBirth,
    createdAt: rawData.createdAt ?? now,
    updatedAt: rawData.updatedAt ?? now,
    eventsAttended: data?.eventsAttended,
    connections: data?.connections,
    vibeTags: data?.vibeTags,
    isVerified: data?.isVerified,
    subscription: normalizeSubscription(rawData.subscription, rawData.isPremium === true),
    isPremium:
      rawData.isPremium === true ||
      rawData.subscription?.tier === 'premium' ||
      rawData.subscriptionTier === 'premium',
    supportQueue:
      rawData.supportQueue === 'priority' || rawData.subscription?.tier === 'premium'
        ? 'priority'
        : 'standard',
    instagram: data?.instagram ?? '',
    spotify: data?.spotify ?? '',
    spotifyConnected: rawData.spotify?.connected === true,
    spotifyProfile: rawData.spotify?.profile ?? null,
    datingActive: rawData.datingActive === true,
    datingVitals: normalizeDatingVitals(rawData.datingVitals),
    anthem: normalizeAnthem(rawData.anthem),
    datingPhotos: Array.isArray(rawData.datingPhotos)
      ? rawData.datingPhotos
      : Array.isArray(rawData.photos)
        ? rawData.photos
        : [],
    photos: Array.isArray(rawData.photos)
      ? rawData.photos
      : Array.isArray(rawData.datingPhotos)
        ? rawData.datingPhotos
        : [],
    notificationPreferences:
      typeof rawData.notificationPreferences === 'object' && rawData.notificationPreferences
        ? rawData.notificationPreferences
        : {},
    pushNewMatches: rawData.pushNewMatches,
    pushEventUpdates: rawData.pushEventUpdates,
    socialProfile:
      typeof rawData.socialProfile === 'object' && rawData.socialProfile
        ? rawData.socialProfile
        : undefined,
    basicSetupComplete,
    profileSetupComplete: rawData.profileSetupComplete === true || basicSetupComplete,
    profileComplete: rawData.profileComplete === true,
    onboardingComplete: rawData.onboardingComplete === true,
    socialSetupComplete,
  };
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  _unsubscribe: null,
  _loadPromise: null,
  nightlifePromptDismissed: false,
  _loadedUserId: null,

  loadProfile: async (userId: string) => {
    // If already loaded for this user, return without re-fetching
    if (get()._loadedUserId === userId && get().profile) return;

    const existing = get()._loadPromise;
    if (existing) return existing;

    const promise = (async () => {
      set({ loading: true, error: null });

      try {
        const key = `/api/v1/users/me:GET`;
        const response = await deduplicateRequest<{
          profile?: Partial<UserProfile>;
          data?: { profile?: Partial<UserProfile> };
        }>(key, () =>
          apiFetch<{ profile?: Partial<UserProfile>; data?: { profile?: Partial<UserProfile> } }>(
            '/api/v1/users/me',
            { requireAuth: true },
          ),
        );
        const data = response.profile || response.data?.profile;
        const profile = normalizeProfile(userId, data);
        set({ profile, loading: false, _loadedUserId: userId });
      } catch (error: any) {
        console.warn('Unable to load profile through gateway.', error);
        set({ profile: get().profile, error: error.message, loading: false });
      } finally {
        set({ _loadPromise: null });
      }
    })();

    set({ _loadPromise: promise });
    return promise;
  },

  updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
    const now = new Date().toISOString();
    const { profile: prevProfile } = get();
    const nextProfile = normalizeProfile(userId, {
      ...(prevProfile ?? {}),
      ...updates,
      updatedAt: now,
    });

    // Optimistic update
    set({ profile: nextProfile, error: null });

    try {
      const response = await apiFetch<{
        profile?: Partial<UserProfile>;
        data?: { profile?: Partial<UserProfile> };
      }>('/api/v1/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(omitUndefined(updates)),
      });
      const savedProfile = response.profile || response.data?.profile;
      if (savedProfile) {
        set({ profile: normalizeProfile(userId, savedProfile) });
      }

      return true;
    } catch (error: any) {
      console.warn('Error updating profile:', error);
      // Revert on failure
      set({ profile: prevProfile, error: error.message });
      return false;
    }
  },

  hydrateNightlifePromptDismissed: async () => {
    try {
      const dismissed = await AsyncStorage.getItem(NIGHTLIFE_PROFILE_PROMPT_DISMISSED_KEY);
      set({ nightlifePromptDismissed: dismissed === 'true' });
    } catch {
      set({ nightlifePromptDismissed: false });
    }
  },

  dismissNightlifePrompt: async () => {
    set({ nightlifePromptDismissed: true });
    try {
      await AsyncStorage.setItem(NIGHTLIFE_PROFILE_PROMPT_DISMISSED_KEY, 'true');
    } catch {
      // Keep the in-memory dismissal for this session even if local storage is unavailable.
    }
  },

  setProfileFromGateway: (userId: string, profile: Partial<UserProfile>) => {
    set({ profile: normalizeProfile(userId, profile), loading: false, error: null });
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

  invalidateProfileCache: () => {
    set({ _loadedUserId: null, _loadPromise: null });
  },

  clearProfile: () => {
    get()._unsubscribe?.();
    set({ profile: null, loading: false, error: null, _unsubscribe: null, _loadPromise: null, _loadedUserId: null });
  },
}));

export default useProfileStore;

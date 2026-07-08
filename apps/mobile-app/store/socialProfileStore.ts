import { create } from 'zustand';
import { apiFetch, deduplicateRequest } from '@/lib/api';
import { useProfileStore } from '@/store/profileStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialState = 'none' | 'complete' | 'verified';

export type BlockFeature = 'like_event' | 'view_interested' | 'dating' | 'chat' | 'group_chat';

export interface SocialProfile {
  state: SocialState;
  photos: string[];
  primaryPhotoIndex: number;
  city: string;
  interestedIn: ('male' | 'female' | 'nonbinary' | 'everyone')[];
  ageRangeMin: number;
  ageRangeMax: number;
  height?: number;
  smoking: string;
  drinking: string;
  sexuality: string;
  lookingFor: string[];
  isVisible: boolean;
  completedAt?: string;
  verifiedAt?: string;
  verificationPhotoHash?: string;
}

const DEFAULT_PROFILE: SocialProfile = {
  state: 'none',
  photos: [],
  primaryPhotoIndex: 0,
  city: '',
  interestedIn: ['everyone'],
  ageRangeMin: 18,
  ageRangeMax: 35,
  smoking: 'prefer_not_to_say',
  drinking: 'prefer_not_to_say',
  sexuality: 'prefer_not_to_say',
  lookingFor: ['friends'],
  isVisible: true,
};

// ── Feature copy for soft-block sheet ────────────────────────────────────────

export const BLOCK_COPY: Record<
  BlockFeature,
  { title: string; body: string; required: 'complete' | 'verified' }
> = {
  like_event: {
    title: 'Like events',
    body: 'Complete your Social Profile to show interest in events and appear in the interested list.',
    required: 'complete',
  },
  view_interested: {
    title: "See who's going",
    body: 'Complete your Social Profile to view people interested in this event.',
    required: 'complete',
  },
  dating: {
    title: 'Discover people',
    body: 'Verify your profile to swipe, match, and connect with people at events.',
    required: 'verified',
  },
  chat: {
    title: 'Send messages',
    body: 'Verify your profile to start conversations with your matches.',
    required: 'verified',
  },
  group_chat: {
    title: 'Join event chat',
    body: 'Verify your profile to join the group chat for this event.',
    required: 'verified',
  },
};

// ── Store ─────────────────────────────────────────────────────────────────────

interface SocialProfileState {
  socialState: SocialState | null; // null = not loaded
  socialProfile: SocialProfile | null;
  loading: boolean;

  // Soft block sheet
  blockVisible: boolean;
  blockFeature: BlockFeature | null;

  // Actions
  loadSocialProfile: (userId: string) => Promise<void>;
  checkAccess: (required: 'complete' | 'verified', feature: BlockFeature) => boolean;
  showBlock: (feature: BlockFeature) => void;
  hideBlock: () => void;

  // Setup
  completeSetup: (
    userId: string,
    data: Pick<
      SocialProfile,
      | 'photos'
      | 'primaryPhotoIndex'
      | 'city'
      | 'interestedIn'
      | 'ageRangeMin'
      | 'ageRangeMax'
      | 'height'
      | 'smoking'
      | 'drinking'
      | 'sexuality'
      | 'lookingFor'
      | 'isVisible'
    >,
  ) => Promise<void>;

  submitVerification: (
    userId: string,
    selfieUri: string,
  ) => Promise<{ success: boolean; message: string }>;

  // Called when user changes profile photo
  onPhotoChanged: (userId: string, newPhotoUrl: string) => Promise<void>;

  // Upload a photo to Firebase Storage, returns download URL
  uploadPhoto: (userId: string, localUri: string, index: number) => Promise<string>;
}

function stateRank(s: SocialState | null): number {
  if (s === 'verified') return 2;
  if (s === 'complete') return 1;
  return 0;
}

export const useSocialProfileStore = create<SocialProfileState>((set, get) => ({
  socialState: null,
  socialProfile: null,
  loading: false,
  blockVisible: false,
  blockFeature: null,

  // ── Load (deduplicated with profileStore) ─────────────────────────────────
  loadSocialProfile: async (userId: string) => {
    if (!userId) return;
    set({ loading: true });

    try {
      // Delegate to profileStore which may already have the data in-flight
      await useProfileStore.getState().loadProfile(userId);
      const profile = useProfileStore.getState().profile;
      const sp = (profile as any)?.socialProfile as SocialProfile | undefined;
      const state: SocialState = sp?.state ?? 'none';
      set({ socialState: state, socialProfile: sp ?? null, loading: false });
    } catch (e: any) {
      console.error('[SocialProfileStore] load error:', e);
      set({ loading: false });
    }
  },

  // ── Access check ─────────────────────────────────────────────────────────
  checkAccess: (required, feature) => {
    const { socialState } = get();
    if (socialState === null) return false; // not loaded yet
    if (stateRank(socialState) >= stateRank(required)) return true;
    get().showBlock(feature);
    return false;
  },

  showBlock: (feature) => set({ blockVisible: true, blockFeature: feature }),
  hideBlock: () => set({ blockVisible: false, blockFeature: null }),

  // ── Complete setup ────────────────────────────────────────────────────────
  completeSetup: async (userId, data) => {
    if (!userId) return;
    const profile: SocialProfile = {
      ...DEFAULT_PROFILE,
      ...data,
      state: 'complete',
      completedAt: new Date().toISOString(),
    };
      await apiFetch('/api/v1/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          photoURL: profile.photos[profile.primaryPhotoIndex] ?? profile.photos[0],
          photos: profile.photos,
          socialProfile: profile,
          socialSetupComplete: true,
        }),
      });
      useProfileStore.getState().invalidateProfileCache();
      set({ socialState: 'complete', socialProfile: profile });
  },

  // ── Verification (server-mediated upload) ─────────────────────────────────
  submitVerification: async (userId, selfieUri) => {
    try {
      // Upload selfie through API Gateway (multipart upload, server stores in Firebase Storage)
      const formData = new FormData();
      const filename = `verification-${userId}-${Date.now()}.jpg`;
      formData.append('file', {
        uri: selfieUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
      formData.append('type', 'social');

      const uploadResponse = await apiFetch<{ data?: { url?: string }; url?: string }>(
        '/api/v1/guest-profiles/avatar',
        {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      const selfieUrl = uploadResponse.data?.url || uploadResponse.url || '';

      await apiFetch('/api/v1/users/me/verification', {
        method: 'POST',
        body: JSON.stringify({
          type: 'social',
          status: 'pending',
          selfieUrl,
          metadata: { source: 'social_profile_store' },
        }),
      });

      const { socialProfile } = get();
      const updatedProfile: SocialProfile = {
        ...(socialProfile ?? DEFAULT_PROFILE),
        state: 'complete',
        verificationPhotoHash: selfieUrl.slice(-32),
      };
      set({ socialState: 'complete', socialProfile: updatedProfile });
      return { success: true, message: 'Verification submitted.' };
    } catch (e: any) {
      console.error('[SocialProfileStore] verification error:', e);
      return { success: false, message: 'Something went wrong. Please try again.' };
    }
  },

  // ── Photo change handler ──────────────────────────────────────────────────
  onPhotoChanged: async (userId, newPhotoUrl) => {
    if (!userId) return;
    const { socialProfile, socialState } = get();
    if (socialState !== 'verified' || !socialProfile) return;

    const newHash = newPhotoUrl.slice(-32);
    if (newHash === socialProfile.verificationPhotoHash) return; // same photo, no action

    // Drop to "complete" — must re-verify
    const updated: SocialProfile = {
      ...socialProfile,
      state: 'complete',
      verifiedAt: undefined,
      verificationPhotoHash: undefined,
    };
    await apiFetch('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        socialProfile: { ...updated, verifiedAt: null, verificationPhotoHash: null },
      }),
    });
    useProfileStore.getState().invalidateProfileCache();
    set({ socialState: 'complete', socialProfile: updated });
  },

  // ── Photo upload (server-mediated) ────────────────────────────────────────
  uploadPhoto: async (userId, localUri, index) => {
    // Upload through API Gateway instead of direct Firebase Storage
    const formData = new FormData();
    const filename = `social_${index}_${Date.now()}.jpg`;
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    const response = await apiFetch<{ data?: { url?: string }; url?: string }>(
      '/api/v1/guest-profiles/avatar',
      {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data?.url || response.url || '';
  },
}));

// ── Convenience hook ──────────────────────────────────────────────────────────
// Usage: const { hasAccess } = useSocialAccess("complete", "like_event")
export function useSocialAccess(required: 'complete' | 'verified', feature: BlockFeature) {
  const { checkAccess, socialState, loading } = useSocialProfileStore();
  return {
    hasAccess: stateRank(socialState) >= stateRank(required),
    socialState,
    loading,
    request: () => checkAccess(required, feature),
  };
}

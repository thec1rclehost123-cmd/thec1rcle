import { create } from 'zustand';
import { getFirebaseApp } from '@/lib/firebase/client';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function getDb() {
  return getFirestore(getFirebaseApp());
}
function getStore() {
  return getStorage(getFirebaseApp());
}

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

  // ── Load ──────────────────────────────────────────────────────────────────
  loadSocialProfile: async (userId: string) => {
    set({ loading: true });
    try {
      const snap = await getDoc(doc(getDb(), 'users', userId));
      if (!snap.exists()) {
        set({ socialState: 'none', socialProfile: null, loading: false });
        return;
      }
      const data = snap.data();
      const sp = data?.socialProfile as SocialProfile | undefined;
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
    const profile: SocialProfile = {
      ...DEFAULT_PROFILE,
      ...data,
      state: 'complete',
    };
    await setDoc(
      doc(getDb(), 'users', userId),
      { socialProfile: { ...profile, completedAt: serverTimestamp() } },
      { merge: true },
    );
    set({ socialState: 'complete', socialProfile: profile });
  },

  // ── Verification ──────────────────────────────────────────────────────────
  submitVerification: async (userId, selfieUri) => {
    try {
      // 1. Upload selfie to Storage (temp path, Cloud Function cleans up)
      const resp = await fetch(selfieUri);
      const blob = await resp.blob();
      const storageRef = ref(getStore(), `verifications/${userId}/selfie_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const selfieUrl = await getDownloadURL(storageRef);

      // 2. Write verification attempt
      await addDoc(collection(getDb(), `verificationAttempts/${userId}/attempts`), {
        userId,
        selfieUrl,
        attemptedAt: serverTimestamp(),
        result: 'pending', // Cloud Function updates this async
        matchScore: null,
      });

      // 3. For now: mark as verified immediately (replace with CF result later)
      const { socialProfile } = get();
      const updatedProfile: SocialProfile = {
        ...(socialProfile ?? DEFAULT_PROFILE),
        state: 'verified',
        verifiedAt: new Date().toISOString(),
        verificationPhotoHash: selfieUrl.slice(-32), // lightweight placeholder
      };

      await setDoc(
        doc(getDb(), 'users', userId),
        { socialProfile: { ...updatedProfile, verifiedAt: serverTimestamp() } },
        { merge: true },
      );

      set({ socialState: 'verified', socialProfile: updatedProfile });
      return { success: true, message: 'Verified!' };
    } catch (e: any) {
      console.error('[SocialProfileStore] verification error:', e);
      return { success: false, message: 'Something went wrong. Please try again.' };
    }
  },

  // ── Photo change handler ──────────────────────────────────────────────────
  onPhotoChanged: async (userId, newPhotoUrl) => {
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
    await setDoc(
      doc(getDb(), 'users', userId),
      { socialProfile: { ...updated, verifiedAt: null, verificationPhotoHash: null } },
      { merge: true },
    );
    set({ socialState: 'complete', socialProfile: updated });
  },

  // ── Photo upload ──────────────────────────────────────────────────────────
  uploadPhoto: async (userId, localUri, index) => {
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    const storageRef = ref(getStore(), `social_photos/${userId}/photo_${index}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
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

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore, type ProfilePrompt, type DatingVitals } from './profileStore';

type NightlifeSetupSeed = {
  vitals?: DatingVitals;
  prompts?: ProfilePrompt[];
  datingPhotos?: string[];
  nightlifeVibeTags?: string[];
};

interface NightlifeSetupState {
  ownerUserId: string | null;
  vitals: DatingVitals;
  prompts: ProfilePrompt[];
  datingPhotos: string[];
  nightlifeVibeTags: string[];

  // Actions
  startForUser: (userId: string, seed?: NightlifeSetupSeed) => void;
  setVitals: (vitals: Partial<DatingVitals>) => void;
  setPrompts: (prompts: ProfilePrompt[]) => void;
  setDatingPhotos: (photos: string[]) => void;
  setNightlifeVibeTags: (vibes: string[]) => void;
  commitToProfile: (userId: string) => Promise<boolean>;
  reset: () => void;
}

export const useNightlifeSetupStore = create<NightlifeSetupState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      vitals: {},
      prompts: [],
      datingPhotos: [],
      nightlifeVibeTags: [],

      startForUser: (userId, seed = {}) =>
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return {
            ownerUserId: userId,
            vitals: seed.vitals ?? {},
            prompts: seed.prompts ?? [],
            datingPhotos: seed.datingPhotos ?? [],
            nightlifeVibeTags: seed.nightlifeVibeTags ?? [],
          };
        }),
      setVitals: (updates) =>
        set((state) => ({ vitals: { ...state.vitals, ...updates } })),
      setPrompts: (prompts) => set({ prompts: prompts.slice(0, 3) }),
      setDatingPhotos: (photos) => set({ datingPhotos: photos.slice(0, 6) }),
      setNightlifeVibeTags: (vibes) => set({ nightlifeVibeTags: vibes.slice(0, 5) }),

      commitToProfile: async (userId: string) => {
        const { ownerUserId, vitals, prompts, datingPhotos, nightlifeVibeTags } = get();
        if (ownerUserId !== userId) return false;
        return useProfileStore.getState().updateProfile(userId, {
          datingVitals: vitals,
          prompts,
          datingPhotos,
          nightlifeVibeTags,
          datingActive: true,
          socialSetupComplete: true,
        });
      },

      reset: () =>
        set({
          ownerUserId: null,
          vitals: {},
          prompts: [],
          datingPhotos: [],
          nightlifeVibeTags: [],
        }),
    }),
    {
      name: 'c1rcle-nightlife-onboarding-draft-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ ownerUserId, vitals, prompts, datingPhotos, nightlifeVibeTags }) => ({
        ownerUserId,
        vitals,
        prompts,
        datingPhotos,
        nightlifeVibeTags,
      }),
    },
  ),
);

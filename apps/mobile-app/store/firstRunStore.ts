import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '@/lib/firebase';
import type { FirstRunSnapshot, FirstRunStage, NightlifeTaste, UserIntent } from '@/lib/firstRun';

type FirstRunState = {
  snapshot: FirstRunSnapshot | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  setSnapshot: (snapshot: FirstRunSnapshot | null) => void;
  load: () => Promise<void>;
  saveIdentity: (displayName: string, dateOfBirth: string) => Promise<boolean>;
  saveCity: (cityId: string, cityName: string, source: 'manual' | 'location') => Promise<boolean>;
  savePreferences: (updates: { vibeTags?: NightlifeTaste[]; intents?: UserIntent[] }) => Promise<boolean>;
  skipEmail: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  clear: () => void;
};

function unwrap(value: any): FirstRunSnapshot | null {
  return value?.onboarding ?? value?.data?.onboarding ?? null;
}

function fallbackKey() {
  const uid = getFirebaseAuth().currentUser?.uid;
  return uid ? `c1rcle:first_run:v2:${uid}` : null;
}

async function readFallback() {
  const key = fallbackKey();
  if (!key) return null;
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) as FirstRunSnapshot : null;
}

async function writeFallback(snapshot: FirstRunSnapshot) {
  const key = fallbackKey();
  if (key) await AsyncStorage.setItem(key, JSON.stringify(snapshot));
}

async function legacyProfilePatch(body: Record<string, unknown>) {
  return request('/api/v1/users/me/settings', 'PATCH', body);
}

async function request(path: string, method: 'GET' | 'PATCH' | 'POST', body?: unknown) {
  return apiFetch<any>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const useFirstRunStore = create<FirstRunState>((set, get) => ({
  snapshot: null,
  loading: false,
  hydrated: false,
  error: null,
  setSnapshot: (snapshot) => set({ snapshot, hydrated: Boolean(snapshot), error: null }),
  load: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding', 'GET');
      set({ snapshot: unwrap(response), loading: false, hydrated: true });
    } catch (error: any) {
      // Compatibility: older gateways do not expose the v2 endpoint. Routing can
      // still be derived from Firebase identity + the canonical profile response.
      const fallback = error?.status === 404 ? await readFallback() : null;
      set({ snapshot: fallback, loading: false, hydrated: true, error: error?.status === 404 ? null : error?.message ?? 'Unable to load setup.' });
    }
  },
  saveIdentity: async (displayName, dateOfBirth) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/identity', 'PATCH', { displayName, dateOfBirth });
      set({ snapshot: unwrap(response) ?? { ...get().snapshot, displayName, dateOfBirth, currentStage: 'city' }, loading: false });
      return true;
    } catch (error: any) {
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({ displayName, dateOfBirth, basicSetupComplete: true, profileSetupComplete: true });
          const snapshot = { ...get().snapshot, displayName, dateOfBirth, currentStage: 'city' as const };
          await writeFallback(snapshot); set({ snapshot, loading: false }); return true;
        } catch (fallbackError: any) { failure = fallbackError; }
      }
      set({ loading: false, error: failure?.message ?? 'Could not save your details.' });
      return false;
    }
  },
  saveCity: async (cityId, cityName, source) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/city', 'PATCH', { cityId, cityName, source });
      set({ snapshot: unwrap(response) ?? { ...get().snapshot, cityId, cityName, currentStage: 'tastes' }, loading: false });
      return true;
    } catch (error: any) {
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({ city: cityName });
          const snapshot = { ...get().snapshot, cityId, cityName, currentStage: 'tastes' as const };
          await writeFallback(snapshot); set({ snapshot, loading: false }); return true;
        } catch (fallbackError: any) { failure = fallbackError; }
      }
      set({ loading: false, error: failure?.message ?? 'Could not save your city.' });
      return false;
    }
  },
  savePreferences: async (updates) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/preferences', 'PATCH', updates);
      const currentStage: FirstRunStage = updates.intents ? 'complete' : 'intent';
      set({ snapshot: unwrap(response) ?? { ...get().snapshot, ...updates, currentStage }, loading: false });
      return true;
    } catch (error: any) {
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch(updates);
          const snapshot = { ...get().snapshot, ...updates, currentStage: (updates.intents ? 'complete' : 'intent') as FirstRunStage };
          await writeFallback(snapshot); set({ snapshot, loading: false }); return true;
        } catch (fallbackError: any) { failure = fallbackError; }
      }
      set({ loading: false, error: failure?.message ?? 'Could not save your preferences.' });
      return false;
    }
  },
  skipEmail: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/email-prompt', 'POST', { status: 'skipped' });
      set({ snapshot: unwrap(response) ?? { ...get().snapshot, emailPromptStatus: 'skipped', currentStage: 'identity' }, loading: false });
      return true;
    } catch (error: any) {
      if (error?.status === 404) {
        const snapshot = { ...get().snapshot, emailPromptStatus: 'skipped' as const, currentStage: 'identity' as const };
        await writeFallback(snapshot); set({ snapshot, loading: false }); return true;
      }
      set({ loading: false, error: error?.message ?? 'Could not continue.' });
      return false;
    }
  },
  complete: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/complete', 'POST');
      set({ snapshot: unwrap(response) ?? { ...get().snapshot, completed: true, currentStage: 'complete' }, loading: false });
      return true;
    } catch (error: any) {
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({ onboardingComplete: true });
          const snapshot = { ...get().snapshot, completed: true, currentStage: 'complete' as const };
          await writeFallback(snapshot); set({ snapshot, loading: false }); return true;
        } catch (fallbackError: any) { failure = fallbackError; }
      }
      set({ loading: false, error: failure?.message ?? 'Could not finish setup.' });
      return false;
    }
  },
  clear: () => set({ snapshot: null, loading: false, hydrated: false, error: null }),
}));

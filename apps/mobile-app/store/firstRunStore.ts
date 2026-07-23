import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  unwrapFirstRunSnapshot,
  type FirstRunSnapshot,
  type FirstRunStage,
  type NightlifeTaste,
  type UserIntent,
} from '@/lib/firstRun';
import { finishFirstRunMetric, startFirstRunMetric } from '@/lib/firstRunPerformance';

type FirstRunState = {
  snapshot: FirstRunSnapshot | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  setSnapshot: (snapshot: FirstRunSnapshot | null) => void;
  load: () => Promise<void>;
  saveIdentity: (displayName: string, dateOfBirth: string) => Promise<boolean>;
  saveCity: (cityId: string, cityName: string, source: 'manual' | 'location') => Promise<boolean>;
  savePreferences: (updates: {
    vibeTags?: NightlifeTaste[];
    intents?: UserIntent[];
  }) => Promise<boolean>;
  skipEmail: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  clear: () => void;
};

type FirstRunRequestContext = {
  generation: number;
  userId: string | null;
};

let firstRunRequestGeneration = 0;

function beginFirstRunRequest(): FirstRunRequestContext {
  firstRunRequestGeneration += 1;
  return {
    generation: firstRunRequestGeneration,
    userId: getFirebaseAuth().currentUser?.uid ?? null,
  };
}

function isCurrentFirstRunRequest(context: FirstRunRequestContext): boolean {
  return (
    context.generation === firstRunRequestGeneration &&
    (getFirebaseAuth().currentUser?.uid ?? null) === context.userId
  );
}

function fallbackKey(userId = getFirebaseAuth().currentUser?.uid ?? null) {
  // Some isolated store tests and early native bootstrap states do not expose
  // the Firebase facade yet; persistence is optional in that moment.
  if (typeof getFirebaseAuth !== 'function') return null;
  return userId ? `c1rcle:first_run:v2:${userId}` : null;
}

async function readFallback(userId?: string | null) {
  const key = fallbackKey(userId);
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FirstRunSnapshot) : null;
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
}

async function writeFallback(snapshot: FirstRunSnapshot, userId?: string | null) {
  const key = fallbackKey(userId);
  if (key) await AsyncStorage.setItem(key, JSON.stringify(snapshot));
}

async function legacyProfilePatch(body: Record<string, unknown>) {
  return request('/api/v1/users/me/settings', 'PATCH', body);
}

async function request(path: string, method: 'GET' | 'PATCH' | 'POST', body?: unknown) {
  const isSave = method !== 'GET';
  if (isSave) startFirstRunMetric('onboarding_step_save');
  try {
    const result = await apiFetch<any>(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (isSave) finishFirstRunMetric('onboarding_step_save', 'success');
    return result;
  } catch (error) {
    if (isSave) finishFirstRunMetric('onboarding_step_save', 'failure');
    throw error;
  }
}

export const useFirstRunStore = create<FirstRunState>((set, get) => ({
  snapshot: null,
  loading: false,
  hydrated: false,
  error: null,
  setSnapshot: (snapshot) => {
    firstRunRequestGeneration += 1;
    const userId = getFirebaseAuth().currentUser?.uid ?? null;
    set({ snapshot, hydrated: Boolean(snapshot), error: null });
    if (snapshot) void writeFallback(snapshot, userId);
  },
  load: async () => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    const fallback = await readFallback(requestContext.userId);
    if (!isCurrentFirstRunRequest(requestContext)) return;
    try {
      const response = await request('/api/v1/users/me/onboarding', 'GET');
      if (!isCurrentFirstRunRequest(requestContext)) return;
      // A successful bootstrap is canonical. Local fallback is only for an
      // offline/error path and must not restore fields the server cleared.
      const snapshot = unwrapFirstRunSnapshot(response);
      if (snapshot) await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return;
      set({ snapshot, loading: false, hydrated: true });
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return;
      // A user-scoped snapshot enables deterministic offline resume. It never
      // grants backend access; protected APIs still enforce canonical state.
      set({
        snapshot: fallback,
        loading: false,
        hydrated: true,
        error: fallback ? null : (error?.message ?? 'Unable to load setup.'),
      });
    }
  },
  saveIdentity: async (displayName, dateOfBirth) => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/identity', 'PATCH', {
        displayName,
        dateOfBirth,
      });
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      const snapshot = unwrapFirstRunSnapshot(response, get().snapshot) ?? {
        ...get().snapshot,
        displayName,
        dateOfBirth,
        currentStage: 'city' as const,
      };
      await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ snapshot, loading: false });
      return true;
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      let failure = error;
      if (__DEV__) {
        console.warn('[FirstRun] Identity save rejected.', {
          code: error?.code,
          status: error?.status,
          details: error?.details,
        });
      }
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({
            displayName,
            dateOfBirth,
            basicSetupComplete: true,
            profileSetupComplete: true,
          });
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          const snapshot = {
            ...get().snapshot,
            displayName,
            dateOfBirth,
            currentStage: 'city' as const,
          };
          await writeFallback(snapshot, requestContext.userId);
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          set({ snapshot, loading: false });
          return true;
        } catch (fallbackError: any) {
          failure = fallbackError;
        }
      }
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ loading: false, error: failure?.message ?? 'Could not save your details.' });
      return false;
    }
  },
  saveCity: async (cityId, cityName, source) => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/city', 'PATCH', {
        cityId,
        cityName,
        source,
      });
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      const snapshot = unwrapFirstRunSnapshot(response, get().snapshot) ?? {
        ...get().snapshot,
        cityId,
        cityName,
        currentStage: 'tastes' as const,
      };
      await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ snapshot, loading: false });
      return true;
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({ city: cityName });
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          const snapshot = { ...get().snapshot, cityId, cityName, currentStage: 'tastes' as const };
          await writeFallback(snapshot, requestContext.userId);
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          set({ snapshot, loading: false });
          return true;
        } catch (fallbackError: any) {
          failure = fallbackError;
        }
      }
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ loading: false, error: failure?.message ?? 'Could not save your city.' });
      return false;
    }
  },
  savePreferences: async (updates) => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/preferences', 'PATCH', updates);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      const currentStage: FirstRunStage = updates.intents ? 'complete' : 'intent';
      const snapshot = unwrapFirstRunSnapshot(response, get().snapshot) ?? {
        ...get().snapshot,
        ...updates,
        currentStage,
      };
      await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ snapshot, loading: false });
      return true;
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch(updates);
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          const snapshot = {
            ...get().snapshot,
            ...updates,
            currentStage: (updates.intents ? 'complete' : 'intent') as FirstRunStage,
          };
          await writeFallback(snapshot, requestContext.userId);
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          set({ snapshot, loading: false });
          return true;
        } catch (fallbackError: any) {
          failure = fallbackError;
        }
      }
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ loading: false, error: failure?.message ?? 'Could not save your preferences.' });
      return false;
    }
  },
  skipEmail: async () => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/email-prompt', 'POST', {
        status: 'skipped',
      });
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      const snapshot = unwrapFirstRunSnapshot(response, get().snapshot) ?? {
        ...get().snapshot,
        emailPromptStatus: 'skipped' as const,
        currentStage: 'identity' as const,
      };
      await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ snapshot, loading: false });
      return true;
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      if (error?.status === 404) {
        const snapshot = {
          ...get().snapshot,
          emailPromptStatus: 'skipped' as const,
          currentStage: 'identity' as const,
        };
        await writeFallback(snapshot, requestContext.userId);
        if (!isCurrentFirstRunRequest(requestContext)) return false;
        set({ snapshot, loading: false });
        return true;
      }
      set({ loading: false, error: error?.message ?? 'Could not continue.' });
      return false;
    }
  },
  complete: async () => {
    const requestContext = beginFirstRunRequest();
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/complete', 'POST');
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      const snapshot = unwrapFirstRunSnapshot(response, get().snapshot) ?? {
        ...get().snapshot,
        completed: true,
        currentStage: 'complete' as const,
      };
      await writeFallback(snapshot, requestContext.userId);
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ snapshot, loading: false });
      return true;
    } catch (error: any) {
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      let failure = error;
      if (error?.status === 404) {
        try {
          await legacyProfilePatch({ onboardingComplete: true });
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          const snapshot = {
            ...get().snapshot,
            completed: true,
            currentStage: 'complete' as const,
          };
          await writeFallback(snapshot, requestContext.userId);
          if (!isCurrentFirstRunRequest(requestContext)) return false;
          set({ snapshot, loading: false });
          return true;
        } catch (fallbackError: any) {
          failure = fallbackError;
        }
      }
      if (!isCurrentFirstRunRequest(requestContext)) return false;
      set({ loading: false, error: failure?.message ?? 'Could not finish setup.' });
      return false;
    }
  },
  clear: () => {
    firstRunRequestGeneration += 1;
    set({ snapshot: null, loading: false, hydrated: false, error: null });
  },
}));

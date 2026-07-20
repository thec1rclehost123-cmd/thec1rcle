import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { FirstRunSnapshot, NightlifeTaste, UserIntent } from '@/lib/firstRun';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';

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
  markEmailShown: () => Promise<boolean>;
  skipEmail: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  clear: () => void;
};

function unwrap(value: any): FirstRunSnapshot | null {
  const result = value?.data ?? value;
  if (!result?.onboarding) return null;
  return { ...result.onboarding, ...(result.onboardingProfile || {}) };
}

function requireCanonicalSnapshot(value: any): FirstRunSnapshot {
  const snapshot = unwrap(value);
  if (!snapshot?.currentStage) {
    throw new Error('The server returned an invalid onboarding state. Please try again.');
  }
  return snapshot;
}

async function request(path: string, method: 'GET' | 'PATCH' | 'POST', body?: unknown) {
  return apiFetch<any>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const useFirstRunStore = create<FirstRunState>((set) => ({
  snapshot: null,
  loading: false,
  hydrated: false,
  error: null,
  setSnapshot: (snapshot) => set({ snapshot, hydrated: Boolean(snapshot), error: null }),
  load: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding', 'GET');
      set({ snapshot: requireCanonicalSnapshot(response), loading: false, hydrated: true });
    } catch (error: any) {
      set({
        snapshot: null,
        loading: false,
        hydrated: true,
        error: error?.message ?? 'Unable to load setup.',
      });
      trackFirstRun(FIRST_RUN_EVENTS.BOOTSTRAP_RESULT, {
        outcome: 'failure',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
    }
  },
  saveIdentity: async (displayName, dateOfBirth) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/identity', 'PATCH', {
        displayName,
        dateOfBirth,
      });
      set({ snapshot: requireCanonicalSnapshot(response), loading: false });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_COMPLETED, { stage: 'identity' });
      return true;
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Could not save your details.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: 'identity',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  saveCity: async (cityId, cityName, source) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/city', 'PATCH', {
        cityId,
        cityName,
        source,
      });
      set({ snapshot: requireCanonicalSnapshot(response), loading: false });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_COMPLETED, { stage: 'city', cityId, source });
      return true;
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Could not save your city.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: 'city',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  savePreferences: async (updates) => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/preferences', 'PATCH', updates);
      set({ snapshot: requireCanonicalSnapshot(response), loading: false });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_COMPLETED, {
        stage: updates.vibeTags ? 'tastes' : 'intent',
        tasteCount: updates.vibeTags?.length,
        tasteIds: updates.vibeTags,
        intentIds: updates.intents,
      });
      return true;
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Could not save your preferences.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: updates.vibeTags ? 'tastes' : 'intent',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  markEmailShown: async () => {
    set({ error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/email-prompt', 'POST', {
        status: 'shown',
      });
      set({ snapshot: requireCanonicalSnapshot(response) });
      return true;
    } catch (error: any) {
      set({ error: error?.message ?? 'Could not save the email prompt state.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: 'email_optional',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  skipEmail: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/email-prompt', 'POST', {
        status: 'skipped',
      });
      set({ snapshot: requireCanonicalSnapshot(response), loading: false });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_COMPLETED, {
        stage: 'email_optional',
        outcome: 'skipped',
      });
      return true;
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Could not continue.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: 'email_optional',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  complete: async () => {
    set({ loading: true, error: null });
    try {
      const response = await request('/api/v1/users/me/onboarding/complete', 'POST', {});
      set({ snapshot: requireCanonicalSnapshot(response), loading: false });
      trackFirstRun(FIRST_RUN_EVENTS.ONBOARDING_COMPLETED, { stage: 'complete' });
      return true;
    } catch (error: any) {
      set({ loading: false, error: error?.message ?? 'Could not finish setup.' });
      trackFirstRun(FIRST_RUN_EVENTS.STEP_FAILED, {
        stage: 'complete',
        errorCode: error?.code,
        requestId: error?.requestId,
      });
      return false;
    }
  },
  clear: () => set({ snapshot: null, loading: false, hydrated: false, error: null }),
}));

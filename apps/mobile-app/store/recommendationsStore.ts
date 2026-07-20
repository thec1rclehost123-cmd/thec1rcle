import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Event } from './eventsStore';

const CACHE_KEY = 'c1rcle:explore-recommendations:v2';
const CACHE_TTL_MS = 15 * 60 * 1000;

export type RecommendationReasonCode =
  | 'VIBE_AND_CITY_MATCH'
  | 'VIBE_MATCH'
  | 'CITY_MATCH'
  | 'INTENT_MATCH'
  | 'HISTORY_MATCH'
  | 'TRENDING';

export type RecommendationItem = {
  event: Event;
  score: number;
  reasonCode: RecommendationReasonCode;
  reasonLabel: string;
};

type RecommendationResponse = {
  modelVersion: 'explore-v2';
  profileVersion: number;
  items: RecommendationItem[];
  fallbackUsed: boolean;
};

type CachedRecommendations = RecommendationResponse & {
  userId: string;
  cachedAt: number;
};

type RecommendationSource = 'none' | 'server' | 'cache' | 'fallback';

interface RecommendationsState {
  items: RecommendationItem[];
  recommendations: Event[];
  reasonLabel: string;
  source: RecommendationSource;
  loading: boolean;
  error: string | null;
  fallbackUsed: boolean;
  modelVersion: string | null;
  profileVersion: number | null;
  loadServerRecommendations: (userId: string, force?: boolean) => Promise<boolean>;
  setFallbackEvents: (events: Event[], reasonLabel?: string) => void;
  clear: () => void;
}

let requestGeneration = 0;
let activeUserId: string | null = null;

function normalizeResponse(value: any): RecommendationResponse | null {
  const response = value?.data ?? value;
  if (response?.modelVersion !== 'explore-v2' || !Array.isArray(response?.items)) return null;
  const items = response.items.filter(
    (item: any) => item?.event?.id && item?.reasonCode && item?.reasonLabel,
  );
  return {
    modelVersion: 'explore-v2',
    profileVersion: Number(response.profileVersion || 1),
    items,
    fallbackUsed: Boolean(response.fallbackUsed),
  };
}

function responseState(
  response: RecommendationResponse,
  source: Extract<RecommendationSource, 'server' | 'cache'>,
) {
  return {
    items: response.items,
    recommendations: response.items.map((item) => item.event),
    reasonLabel: response.items[0]?.reasonLabel || 'Popular right now',
    source,
    loading: false,
    error: null,
    fallbackUsed: response.fallbackUsed,
    modelVersion: response.modelVersion,
    profileVersion: response.profileVersion,
  };
}

async function readCache(userId: string): Promise<RecommendationResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedRecommendations;
    if (cached.userId !== userId || Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
    return normalizeResponse(cached);
  } catch {
    return null;
  }
}

async function writeCache(userId: string, response: RecommendationResponse) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...response, userId, cachedAt: Date.now() } satisfies CachedRecommendations),
    );
  } catch {
    // Recommendations remain usable in memory when device storage is unavailable.
  }
}

export const useRecommendationsStore = create<RecommendationsState>((set, get) => ({
  items: [],
  recommendations: [],
  reasonLabel: 'Popular right now',
  source: 'none',
  loading: false,
  error: null,
  fallbackUsed: false,
  modelVersion: null,
  profileVersion: null,

  loadServerRecommendations: async (userId, force = false) => {
    if (!force && activeUserId === userId && get().source === 'server') {
      return get().items.length > 0;
    }
    if (activeUserId && activeUserId !== userId) {
      requestGeneration += 1;
      set({ items: [], recommendations: [], source: 'none', error: null });
    }
    activeUserId = userId;
    const generation = ++requestGeneration;
    set({ loading: true, error: null });

    if (!force && get().source === 'none') {
      const cached = await readCache(userId);
      if (generation !== requestGeneration) return false;
      if (cached?.items.length) set(responseState(cached, 'cache'));
    }

    try {
      const raw = await apiFetch<any>(
        '/api/v1/recommendations?contract=v2&surface=explore&limit=12',
        { requireAuth: true },
      );
      const response = normalizeResponse(raw);
      if (!response) throw new Error('The recommendation service returned an invalid response.');
      if (generation !== requestGeneration) return false;
      if (!response.items.length) {
        set({
          items: [],
          recommendations: [],
          source: 'none',
          loading: false,
          error: null,
          fallbackUsed: true,
          modelVersion: response.modelVersion,
          profileVersion: response.profileVersion,
        });
        return false;
      }
      set(responseState(response, 'server'));
      void writeCache(userId, response);
      return response.items.length > 0;
    } catch (error: any) {
      if (generation !== requestGeneration) return false;
      const cached = await readCache(userId);
      if (generation !== requestGeneration) return false;
      if (cached?.items.length) {
        set({
          ...responseState(cached, 'cache'),
          error: 'Showing saved picks while we reconnect.',
        });
        return true;
      }
      set({ loading: false, error: error?.message || 'Could not personalize Explore.' });
      return false;
    }
  },

  setFallbackEvents: (events, reasonLabel = 'Popular right now') => {
    if (get().source === 'server' || get().source === 'cache') return;
    const recommendations = events.slice(0, 12);
    set({
      items: recommendations.map((event) => ({
        event,
        score: 0,
        reasonCode: 'TRENDING',
        reasonLabel,
      })),
      recommendations,
      reasonLabel,
      source: 'fallback',
      loading: false,
      fallbackUsed: true,
      modelVersion: null,
      profileVersion: null,
    });
  },

  clear: () => {
    requestGeneration += 1;
    activeUserId = null;
    set({
      items: [],
      recommendations: [],
      reasonLabel: 'Popular right now',
      source: 'none',
      loading: false,
      error: null,
      fallbackUsed: false,
      modelVersion: null,
      profileVersion: null,
    });
  },
}));

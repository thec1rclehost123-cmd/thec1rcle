/**
 * Smart Recommendations Store
 * Scores events based on time-of-day + order history + browsed categories + heatScore
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event } from './eventsStore';

const BROWSED_KEY = 'c1rcle:browsed_categories';
const BROWSED_MAX = 10; // keep last 10 browsed category entries

// Categories that boost at certain hours
const TIME_OF_DAY_BOOSTS: Record<string, number[]> = {
  brunch: [9, 10, 11, 12, 13, 14],
  party: [18, 19, 20, 21, 22, 23],
  club: [20, 21, 22, 23, 0, 1],
  concert: [17, 18, 19, 20, 21, 22],
  festival: [10, 11, 12, 13, 14, 15, 16],
  comedy: [18, 19, 20, 21, 22],
};

interface RecommendationsState {
  recommendations: Event[];
  browsedCategories: string[];

  // Call on each event detail open
  trackBrowse: (category: string) => Promise<void>;
  // Call to rescore events against user signals
  score: (events: Event[], pastOrderCategories: string[]) => void;
  // Load persisted browsed categories from AsyncStorage
  loadBrowsed: () => Promise<void>;
}

function scoreEvent(
  event: Event,
  pastOrderCategories: string[],
  browsedCategories: string[],
  hour: number,
): number {
  const cat = (event.category ?? event.type ?? '').toLowerCase();
  const daysUntil = (() => {
    const ms = new Date(event.startDate).getTime() - Date.now();
    return Math.max(0, ms / (1000 * 60 * 60 * 24));
  })();

  const pastBoost = pastOrderCategories.includes(cat) ? 3 : 0;
  const browsedBoost = browsedCategories.includes(cat) ? 2 : 0;
  const todBoost = (TIME_OF_DAY_BOOSTS[cat] ?? []).includes(hour) ? 3 : 0;
  const heatBoost = (event.heatScore ?? 0) * 0.001;
  const recencyPenalty = daysUntil * 0.1;

  return pastBoost + browsedBoost + todBoost + heatBoost - recencyPenalty;
}

export const useRecommendationsStore = create<RecommendationsState>((set, get) => ({
  recommendations: [],
  browsedCategories: [],

  loadBrowsed: async () => {
    try {
      const raw = await AsyncStorage.getItem(BROWSED_KEY);
      if (raw) {
        set({ browsedCategories: JSON.parse(raw) as string[] });
      }
    } catch {
      // non-critical
    }
  },

  trackBrowse: async (category: string) => {
    if (!category) return;
    const cat = category.toLowerCase();
    const current = get().browsedCategories;
    // Deduplicate + cap at BROWSED_MAX
    const updated = [cat, ...current.filter((c) => c !== cat)].slice(0, BROWSED_MAX);
    set({ browsedCategories: updated });
    try {
      await AsyncStorage.setItem(BROWSED_KEY, JSON.stringify(updated));
    } catch {
      // non-critical
    }
  },

  score: (events: Event[], pastOrderCategories: string[]) => {
    const { browsedCategories } = get();
    const hour = new Date().getHours();
    const now = Date.now();

    const scored = events
      .filter((e) => {
        // Only show scheduled/live events (mirrors guest portal PUBLIC_LIFECYCLE_STATES)
        const lifecycle = e.lifecycle;
        if (lifecycle && lifecycle !== 'scheduled' && lifecycle !== 'live') return false;

        // Filter out test/garbage data
        const title = e.title?.toLowerCase() ?? '';
        if (title.length < 4) return false;
        if (/^(test|check|ssjd|dummy|aaa|bbb|xxx|yyy|zzz)/i.test(e.title ?? '')) return false;

        if (!e.startDate) return true;
        const start = new Date(e.startDate).getTime();
        return isNaN(start) ? true : start > now;
      })
      .map((e) => ({
        event: e,
        score: scoreEvent(e, pastOrderCategories, browsedCategories, hour),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ event }) => event);

    set({ recommendations: scored });
  },
}));

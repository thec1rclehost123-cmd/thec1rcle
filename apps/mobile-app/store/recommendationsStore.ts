/**
 * Smart Recommendations Store
 * Scores events based on time-of-day + order history + browsed categories + heatScore
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Event } from "./eventsStore";
import { apiFetch, deduplicateRequest } from "@/lib/api";
import { firstRunFeatureFlags } from "@/lib/featureFlags";
import { getFirebaseAuth } from "@/lib/firebase";
import { finishFirstRunMetric, startFirstRunMetric } from "@/lib/firstRunPerformance";

const BROWSED_KEY = "c1rcle:browsed_categories";
const BROWSED_MAX = 10; // keep last 10 browsed category entries

export function recommendationsRequestPath(useV2: boolean): string {
    return `/api/v1/recommendations?limit=10&contract=${useV2 ? 'v2' : 'legacy'}`;
}

// Categories that boost at certain hours
const TIME_OF_DAY_BOOSTS: Record<string, number[]> = {
    brunch:   [9, 10, 11, 12, 13, 14],
    party:    [18, 19, 20, 21, 22, 23],
    club:     [20, 21, 22, 23, 0, 1],
    concert:  [17, 18, 19, 20, 21, 22],
    festival: [10, 11, 12, 13, 14, 15, 16],
    comedy:   [18, 19, 20, 21, 22],
};

interface RecommendationsState {
    recommendations: Event[];
    scoredEvents: Record<string, { score: number }>;
    browsedCategories: string[];
    reasonLabel: string;
    source: 'server' | 'local';
    recommendationsOwnerUserId: string | null;

    // Call on each event detail open
    trackBrowse: (category: string) => Promise<void>;
    // Call to rescore events against user signals
    score: (events: Event[], pastOrderCategories: string[]) => void;
    // Load persisted browsed categories from AsyncStorage
    loadBrowsed: () => Promise<void>;
    setServerRecommendations: (items: Array<{ event: Event; reasonLabel?: string }>) => void;
    setRecommendationsOwner: (userId: string | null) => void;
    loadServerRecommendations: (userId: string) => Promise<boolean>;
}

const EMPTY_RECOMMENDATIONS_STATE = {
    recommendations: [] as Event[],
    scoredEvents: {} as Record<string, { score: number }>,
    reasonLabel: "Recommended for you",
    source: 'local' as const,
};

function scoreEvent(
    event: Event,
    pastOrderCategories: string[],
    browsedCategories: string[],
    hour: number,
): number {
    const cat = (event.category ?? event.type ?? "").toLowerCase();
    const daysUntil = (() => {
        const ms = new Date(event.startDate).getTime() - Date.now();
        return Math.max(0, ms / (1000 * 60 * 60 * 24));
    })();

    const pastBoost    = pastOrderCategories.includes(cat) ? 3 : 0;
    const browsedBoost = browsedCategories.includes(cat)   ? 2 : 0;
    const todBoost     = (TIME_OF_DAY_BOOSTS[cat] ?? []).includes(hour) ? 3 : 0;
    const heatBoost    = Math.min((event.heatScore ?? 0) * 0.03, 3);
    const recencyPenalty = Math.min(daysUntil * 0.1, 5);

    return pastBoost + browsedBoost + todBoost + heatBoost - recencyPenalty;
}

export const useRecommendationsStore = create<RecommendationsState>((set, get) => ({
    recommendations: [],
    scoredEvents: {},
    browsedCategories: [],
    reasonLabel: "Recommended for you",
    source: 'local',
    recommendationsOwnerUserId: null,

    setServerRecommendations: (items) => set({
        recommendations: items.map((item) => item.event),
        reasonLabel: items.find((item) => item.reasonLabel)?.reasonLabel ?? "Recommended for you",
        source: 'server',
    }),

    setRecommendationsOwner: (userId) => {
        const normalizedUserId = userId?.trim() || null;
        if (get().recommendationsOwnerUserId === normalizedUserId) return;

        set({
            ...EMPTY_RECOMMENDATIONS_STATE,
            recommendationsOwnerUserId: normalizedUserId,
        });
    },

    loadServerRecommendations: (userId) => {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) return Promise.resolve(false);

        get().setRecommendationsOwner(normalizedUserId);

        const path = recommendationsRequestPath(firstRunFeatureFlags.exploreRecommendationsV2);
        const requestKey = `recommendations:${normalizedUserId}:${path}`;

        return deduplicateRequest<boolean>(requestKey, async () => {
            startFirstRunMetric('recommendation_request');
            try {
                const response = await apiFetch<any>(path);
                const currentUserId = getFirebaseAuth().currentUser?.uid ?? null;
                if (
                    currentUserId !== normalizedUserId ||
                    get().recommendationsOwnerUserId !== normalizedUserId
                ) {
                    finishFirstRunMetric('recommendation_request', 'success');
                    return false;
                }

                const rawItems = Array.isArray(response)
                    ? response
                    : response?.items ?? response?.recommendations ?? [];
                const items = rawItems.map((item: any) => item?.event
                    ? ({ event: item.event, reasonLabel: item.reasonLabel })
                    : ({ event: item, reasonLabel: item?.reasonLabel }));
                if (!items.length) {
                    finishFirstRunMetric('recommendation_request', 'success');
                    return false;
                }
                get().setServerRecommendations(items);
                finishFirstRunMetric('recommendation_request', 'success');
                return true;
            } catch {
                finishFirstRunMetric('recommendation_request', 'failure');
                // Local scoring remains the credible offline/legacy fallback.
                return false;
            }
        });
    },

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
        try {
            await apiFetch('/api/v1/users/me/recommendation-signals', {
                method: 'POST',
                requireAuth: true,
                body: JSON.stringify({ type: 'category_browse', category: cat }),
            });
        } catch {
            // Guests, offline sessions, and legacy gateways keep the local fallback.
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
                if (lifecycle && lifecycle !== "scheduled" && lifecycle !== "live") return false;

                // Filter out test/garbage data
                const title = e.title?.toLowerCase() ?? "";
                if (title.length < 4) return false;
                if (/^(test|check|ssjd|dummy|aaa|bbb|xxx|yyy|zzz)/i.test(e.title ?? "")) return false;

                if (!e.startDate) return true;
                const start = new Date(e.startDate).getTime();
                return isNaN(start) ? true : start > now;
            })
            .map((e) => ({
                event: e,
                score: scoreEvent(e, pastOrderCategories, browsedCategories, hour),
            }))
            .sort((a, b) => b.score - a.score);

        set({
            recommendations: scored.slice(0, 10).map(({ event }) => event),
            scoredEvents: Object.fromEntries(scored.map(({ event, score }) => [event.id, { score }])),
            source: 'local',
        });
    },
}));

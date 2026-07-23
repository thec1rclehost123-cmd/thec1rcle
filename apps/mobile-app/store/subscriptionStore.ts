import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export type SubscriptionTier = 'free' | 'premium';
export type PremiumFeature =
  | 'dailyLikes'
  | 'askOuts'
  | 'whoLikedMe'
  | 'rewind'
  | 'advancedFilters'
  | 'premiumOnlyEvent'
  | 'earlyAccessDrop'
  | 'bookingFees'
  | 'ticketTransfers';

export type SubscriptionLimits = {
  likesPerDay: number | null;
  askOutsPerDay: number | null;
  rewindsPerDay: number | null;
  ticketTransfers: number | null;
  bookingFeesWaived: boolean;
  readReceipts: boolean;
  advancedFilters: string[];
  whoLikedMeVisibility: 'blurred' | 'full';
  supportQueue: 'standard' | 'priority';
};

export type DailyUsage = {
  date: string;
  timeZone?: string;
  likesUsed: number;
  askOutsUsed: number;
  resetAt?: string | null;
};

export type SubscriptionStateShape = {
  tier: SubscriptionTier;
  isPremium: boolean;
  expiresAt?: string | null;
  usage: DailyUsage;
  limits: SubscriptionLimits;
  loading: boolean;
  error: string | null;
  paywall: {
    visible: boolean;
    feature: PremiumFeature | null;
    title: string;
    message: string;
  };
  hydrateFromProfile: (profile?: any) => void;
  fetchSubscription: () => Promise<void>;
  applyServerContext: (payload?: any) => void;
  hydrateFromRevenueCat: (customerInfo: any) => Promise<void>;
  fetchRevenueCatSubscription: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  openPaywall: (feature: PremiumFeature, message?: string) => void;
  closePaywall: () => void;
  canUseDailyFeature: (feature: 'dailyLikes' | 'askOuts') => boolean;
  clearSubscription: () => void;
};

const FREE_LIMITS: SubscriptionLimits = {
  likesPerDay: 10,
  askOutsPerDay: 1,
  rewindsPerDay: 0,
  ticketTransfers: 1,
  bookingFeesWaived: false,
  readReceipts: false,
  advancedFilters: ['distance', 'age'],
  whoLikedMeVisibility: 'blurred',
  supportQueue: 'standard',
};

const PREMIUM_LIMITS: SubscriptionLimits = {
  likesPerDay: null,
  askOutsPerDay: 5,
  rewindsPerDay: null,
  ticketTransfers: null,
  bookingFeesWaived: true,
  readReceipts: true,
  advancedFilters: ['distance', 'age', 'vibeTags', 'intent', 'height', 'verifiedOnly'],
  whoLikedMeVisibility: 'full',
  supportQueue: 'priority',
};

const EMPTY_USAGE: DailyUsage = {
  date: '',
  likesUsed: 0,
  askOutsUsed: 0,
  resetAt: null,
};

function normalizeTier(value: any): SubscriptionTier {
  return value === 'premium' ? 'premium' : 'free';
}

function normalizeSubscription(payload?: any) {
  const raw = payload?.subscription || payload || {};
  const tier = normalizeTier(raw.tier || payload?.tier);
  return {
    tier,
    isPremium: raw.isPremium === true || tier === 'premium',
    expiresAt: raw.expiresAt ?? null,
    limits: tier === 'premium' ? PREMIUM_LIMITS : FREE_LIMITS,
  };
}

function normalizeUsage(value?: any): DailyUsage {
  return {
    date: String(value?.date || ''),
    timeZone: value?.timeZone,
    likesUsed: Math.max(0, Number(value?.likesUsed || 0)),
    askOutsUsed: Math.max(0, Number(value?.askOutsUsed || 0)),
    resetAt: value?.resetAt ?? null,
  };
}

function paywallCopy(feature: PremiumFeature, fallback?: string) {
  if (fallback) {
    return { title: 'C1RCLE Premium', message: fallback };
  }

  switch (feature) {
    case 'dailyLikes':
      return {
        title: 'Daily Likes used',
        message: 'Upgrade to C1RCLE Premium for unlimited Likes.',
      };
    case 'askOuts':
      return {
        title: 'Ask Out limit reached',
        message: 'Premium unlocks up to 5 Ask Out requests every day.',
      };
    case 'whoLikedMe':
      return {
        title: 'See who liked you',
        message: 'Premium reveals your full likes list and lets you match instantly.',
      };
    case 'advancedFilters':
      return {
        title: 'Premium filters',
        message: 'Unlock vibe tags, intent, height, and verified-only filters.',
      };
    case 'premiumOnlyEvent':
      return {
        title: 'Premium event',
        message: 'This event is exclusive to C1RCLE Premium members.',
      };
    case 'earlyAccessDrop':
      return {
        title: 'Early access drop',
        message: 'Premium members get the first 24 hours on hot drops.',
      };
    case 'bookingFees':
      return {
        title: 'Zero booking fees',
        message: 'Premium removes booking fees on eligible ticket orders.',
      };
    case 'ticketTransfers':
      return {
        title: 'Unlimited transfers',
        message: 'Free members can transfer a ticket once. Premium unlocks unlimited transfers.',
      };
    default:
      return {
        title: 'C1RCLE Premium',
        message: 'Upgrade to unlock this feature.',
      };
  }
}

export const useSubscriptionStore = create<SubscriptionStateShape>((set, get) => ({
  tier: 'free',
  isPremium: false,
  expiresAt: null,
  usage: EMPTY_USAGE,
  limits: FREE_LIMITS,
  loading: false,
  error: null,
  paywall: {
    visible: false,
    feature: null,
    title: 'C1RCLE Premium',
    message: 'Upgrade to unlock this feature.',
  },

  hydrateFromProfile: (profile?: any) => {
    const normalized = normalizeSubscription(
      profile?.subscription || {
        tier: profile?.isPremium ? 'premium' : 'free',
        isPremium: profile?.isPremium === true,
      },
    );
    set({
      tier: normalized.tier,
      isPremium: normalized.isPremium,
      expiresAt: normalized.expiresAt,
      limits: normalized.limits,
      error: null,
    });
  },

  fetchSubscription: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiFetch<{
        subscription?: any;
        usage?: any;
        limits?: SubscriptionLimits;
        data?: { subscription?: any; usage?: any; limits?: SubscriptionLimits };
      }>('/api/v1/users/me/subscription');
      get().applyServerContext(response.data || response);
      set({ loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message || 'Unable to load subscription.' });
    }
  },

  applyServerContext: (payload?: any) => {
    if (!payload) return;
    const normalized = normalizeSubscription(payload.subscription);
    set({
      tier: normalized.tier,
      isPremium: normalized.isPremium,
      expiresAt: normalized.expiresAt,
      limits: (payload.limits as SubscriptionLimits) || normalized.limits,
      usage: payload.usage ? normalizeUsage(payload.usage) : get().usage,
      error: null,
    });
  },

  hydrateFromRevenueCat: async (customerInfo: any) => {
    if (!customerInfo) return;
    const entitlement = customerInfo.entitlements?.active?.premium;
    const isPremium = !!entitlement;
    set({
      tier: isPremium ? 'premium' : 'free',
      isPremium,
      expiresAt: entitlement?.expirationDate ?? null,
      limits: isPremium ? PREMIUM_LIMITS : FREE_LIMITS,
      error: null,
    });
  },

  fetchRevenueCatSubscription: async () => {
    // Deprecated RevenueCat integration
  },

  restorePurchases: async () => {
    // Deprecated RevenueCat integration
  },

  openPaywall: (feature, message) => {
    const copy = paywallCopy(feature, message);
    set({
      paywall: {
        visible: true,
        feature,
        title: copy.title,
        message: copy.message,
      },
    });
  },

  closePaywall: () => {
    set((state) => ({
      paywall: {
        ...state.paywall,
        visible: false,
      },
    }));
  },

  canUseDailyFeature: (feature) => {
    const { limits, usage } = get();
    if (feature === 'dailyLikes') {
      return limits.likesPerDay === null || usage.likesUsed < limits.likesPerDay;
    }
    return limits.askOutsPerDay === null || usage.askOutsUsed < limits.askOutsPerDay;
  },

  clearSubscription: () => {
    set({
      tier: 'free',
      isPremium: false,
      expiresAt: null,
      usage: EMPTY_USAGE,
      limits: FREE_LIMITS,
      loading: false,
      error: null,
      paywall: {
        visible: false,
        feature: null,
        title: 'C1RCLE Premium',
        message: 'Upgrade to unlock this feature.',
      },
    });
  },
}));

export default useSubscriptionStore;

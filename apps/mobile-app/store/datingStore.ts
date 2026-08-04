import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { type DatingVitals } from '@/store/profileStore';

export type Prompt = {
  id: string;
  title: string;
  answer: string;
};

export type DatingPhoto = {
  id: string;
  source: number | string | { uri: string };
  caption?: string;
};

export interface DatingProfile {
  userId: string;
  id: string;
  displayName: string;
  name: string;
  age: number | null;
  headline: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  vibeTags?: string[];
  vitals?: DatingVitals;
  isVerified?: boolean;
  isPremium?: boolean;
  // Shared event context — why this person is shown
  sharedEventId: string;
  sharedEventTitle: string;
  sharedEventDate: string;
  sharedEventCover?: string;
  venue: string;
  distance: string;
  profileRouteId: string;
  tags: string[];
  photos: DatingPhoto[];
  prompts: Prompt[];
  isDemo?: boolean;
}

export interface Match {
  id: string;
  otherUserId: string;
  displayName: string;
  photoURL?: string;
  sharedEventTitle: string;
  matchedAt: string;
  conversationId?: string;
  isPremium?: boolean;
}

interface DatingState {
  ownerUserId: string | null;
  profilesOwnerUserId: string | null;
  matchesOwnerUserId: string | null;
  profiles: DatingProfile[];
  matches: Match[];
  loading: boolean;
  prefetching: boolean;
  matchesLoading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  profileRequestId: number;
  matchesRequestId: number;

  setOwnerUserId: (userId: string | null) => void;
  clearDatingState: () => void;
  fetchProfiles: (
    userId: string,
    options?: { append?: boolean; filters?: DatingFilters },
  ) => Promise<void>;
  fetchMatches: (userId: string) => Promise<void>;
  likeUser: (
    fromUserId: string,
    profile: DatingProfile,
  ) => Promise<{ isMatch: boolean; match?: Match; paywalled?: boolean }>;
  sendAskOut: (
    fromUserId: string,
    profile: DatingProfile,
    message?: string,
  ) => Promise<{ sent: boolean; isMatch: boolean; match?: Match; paywalled?: boolean }>;
  passUser: (fromUserId: string, targetUserId: string) => Promise<void>;
  removeTopProfile: (ownerUserId: string, targetUserId: string) => void;
}

function getAgeFromDate(value?: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const birthDate = new Date(timestamp);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age > 0 && age < 120 ? age : null;
}

function firstNonEmptyString(...values: any[]): string | undefined {
  const value = values.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
  return value?.trim();
}

function getDatingErrorMessage(error: any, fallback = 'Unable to load dating right now.'): string {
  if (error?.isTimeout) return 'Dating took too long to load. Please try again.';
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
}

function warnDatingStore(scope: string, error: any) {
  if (!__DEV__) return;
  console.warn(`[DatingStore] ${scope}:`, getDatingErrorMessage(error), {
    code: error?.code,
    status: error?.status,
  });
}

function normalizePhotos(profile: any): DatingPhoto[] {
  const rawPhotos = Array.isArray(profile.photos)
    ? profile.photos
    : Array.isArray(profile.datingPhotos)
      ? profile.datingPhotos
      : [];
  const photos = rawPhotos
    .map((photo: any, index: number) => {
      const uri = typeof photo === 'string' ? photo : photo?.url || photo?.uri || photo?.source;
      if (!uri) return null;
      return {
        id: String(photo?.id || `${profile.userId || profile.id || 'profile'}-${index}`),
        source: typeof uri === 'number' ? uri : { uri: String(uri) },
        caption: photo?.caption,
      };
    })
    .filter(Boolean) as DatingPhoto[];

  const primaryPhoto = firstNonEmptyString(profile.photoURL, profile.photo, profile.avatar);
  if (primaryPhoto && photos.length === 0) {
    return [
      { id: `${profile.userId || profile.id || 'profile'}-primary`, source: { uri: primaryPhoto } },
    ];
  }

  return photos;
}

const NIGHTLIFE_PROMPTS = [
  'My favorite concert was',
  'My favorite brand is',
  'My go-to song is',
  'My favorite spot to go out is',
  'Best night out memory',
  'My ultimate pregame ritual',
  'The DJ I would love to see',
  'My spirit animal at a party is',
];

function normalizePrompts(profile: any): Prompt[] {
  const rawPrompts = Array.isArray(profile.prompts) ? profile.prompts : [];
  const prompts = rawPrompts
    .map((prompt: any, index: number) => ({
      id: String(prompt?.id || `${profile.userId || profile.id || 'prompt'}-${index}`),
      title: String(
        prompt?.title || prompt?.question || NIGHTLIFE_PROMPTS[index % NIGHTLIFE_PROMPTS.length],
      ),
      answer: String(prompt?.answer || prompt?.response || ''),
    }))
    .filter((prompt: Prompt) => prompt.answer.trim().length > 0);

  if (prompts.length > 0) return prompts;

  const bio = firstNonEmptyString(profile.bio, profile.headline, profile.about);
  if (bio) {
    return [
      {
        id: `${profile.userId || profile.id || 'profile'}-bio`,
        title: 'My nightlife vibe',
        answer: bio,
      },
    ];
  }

  return [];
}

function normalizeApiDatingProfile(profile: any, _index: number): DatingProfile | null {
  const userId = firstNonEmptyString(profile.userId, profile.uid, profile.id);
  if (!userId) return null;

  const displayName =
    firstNonEmptyString(profile.displayName, profile.name, profile.firstName) || 'C1rcle User';
  const age = Number(profile.age) || getAgeFromDate(profile.dateOfBirth) || null;
  const sharedEventTitle =
    firstNonEmptyString(
      profile.sharedEventTitle,
      profile.eventTitle,
      profile.upcomingEvents?.[0]?.title,
    ) || 'Shared Event';
  const city = firstNonEmptyString(profile.city, profile.location) || '';
  const vibeTags = Array.isArray(profile.nightlifeVibeTags)
    ? profile.nightlifeVibeTags
    : Array.isArray(profile.vibeTags)
      ? profile.vibeTags
      : Array.isArray(profile.tags)
        ? profile.tags
        : [];

  return {
    ...profile,
    userId,
    id: userId,
    displayName,
    name: displayName.split(' ')[0] || displayName,
    age,
    headline:
      firstNonEmptyString(profile.headline, profile.bio, profile.prompts?.[0]?.answer) || '',
    photoURL: firstNonEmptyString(profile.photoURL, profile.photo, profile.avatar),
    bio: profile.bio || profile.headline || '',
    city,
    vibeTags,
    vitals: profile.datingVitals || profile.vitals,
    isVerified: profile.isVerified === true,
    isPremium: profile.isPremium === true || profile.subscription?.tier === 'premium',
    sharedEventId:
      firstNonEmptyString(profile.sharedEventId, profile.upcomingEvents?.[0]?.id) || 'global',
    sharedEventTitle,
    sharedEventDate: firstNonEmptyString(profile.sharedEventDate, profile.eventDate) || '',
    sharedEventCover: firstNonEmptyString(profile.sharedEventCover, profile.eventCover),
    venue: firstNonEmptyString(profile.venue, profile.venueName, city) || sharedEventTitle,
    distance:
      profile.distanceKm !== undefined
        ? `${Number(profile.distanceKm).toFixed(1)} km away`
        : firstNonEmptyString(profile.distance) || '',
    profileRouteId: userId,
    tags: vibeTags,
    photos: normalizePhotos(profile),
    prompts: normalizePrompts(profile),
  };
}

function dedupeProfiles(profiles: DatingProfile[]): DatingProfile[] {
  const seenIds = new Set<string>();
  return profiles.filter((profile) => {
    const id = profile.userId || profile.id;
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function normalizeUserId(userId: string | null | undefined): string {
  return typeof userId === 'string' ? userId.trim() : '';
}

function ownsProfileDeck(state: DatingState, userId: string): boolean {
  return state.ownerUserId === userId && state.profilesOwnerUserId === userId;
}

function ownsTargetProfile(state: DatingState, userId: string, targetUserId: string): boolean {
  return (
    ownsProfileDeck(state, userId) &&
    state.profiles.some((profile) => profile.userId === targetUserId || profile.id === targetUserId)
  );
}

export interface DatingFilters {
  vibeTags?: string[];
  intent?: string;
  heightMin?: number;
  heightMax?: number;
  verifiedOnly?: boolean;
}

export const useDatingStore = create<DatingState>((set, get) => ({
  ownerUserId: null,
  profilesOwnerUserId: null,
  matchesOwnerUserId: null,
  profiles: [],
  matches: [],
  loading: false,
  prefetching: false,
  matchesLoading: false,
  error: null,
  nextCursor: null,
  hasMore: true,
  profileRequestId: 0,
  matchesRequestId: 0,

  setOwnerUserId: (userId) => {
    const nextOwnerUserId = normalizeUserId(userId) || null;
    if (get().ownerUserId === nextOwnerUserId) return;
    set((state) => ({
      ownerUserId: nextOwnerUserId,
      profilesOwnerUserId: null,
      matchesOwnerUserId: null,
      profiles: [],
      matches: [],
      loading: false,
      prefetching: false,
      matchesLoading: false,
      error: null,
      nextCursor: null,
      hasMore: true,
      profileRequestId: state.profileRequestId + 1,
      matchesRequestId: state.matchesRequestId + 1,
    }));
  },

  clearDatingState: () => {
    set((state) => ({
      ownerUserId: null,
      profilesOwnerUserId: null,
      matchesOwnerUserId: null,
      profiles: [],
      matches: [],
      loading: false,
      prefetching: false,
      matchesLoading: false,
      error: null,
      nextCursor: null,
      hasMore: true,
      profileRequestId: state.profileRequestId + 1,
      matchesRequestId: state.matchesRequestId + 1,
    }));
  },

  fetchProfiles: async (
    userId: string,
    options: { append?: boolean; filters?: DatingFilters } = {},
  ) => {
    const requestedUserId = normalizeUserId(userId);
    if (!requestedUserId || get().ownerUserId !== requestedUserId) return;

    const append = options.append === true && get().profilesOwnerUserId === requestedUserId;
    const filters = options.filters;
    const { loading, prefetching, hasMore, nextCursor } = get();
    if (append) {
      if (loading || prefetching || !hasMore || !nextCursor) return;
      set({ prefetching: true, error: null });
    } else {
      if (loading) return;
      set({ loading: true, error: null, nextCursor: null, hasMore: true });
    }
    const requestId = get().profileRequestId + 1;
    set({ profileRequestId: requestId });

    try {
      const params = new URLSearchParams();
      if (append && nextCursor) params.set('cursor', nextCursor);
      if (filters?.vibeTags && filters.vibeTags.length > 0)
        params.set('vibeTags', filters.vibeTags.join(','));
      if (filters?.intent) params.set('intent', filters.intent);
      if (filters?.heightMin != null) params.set('heightMin', String(filters.heightMin));
      if (filters?.heightMax != null) params.set('heightMax', String(filters.heightMax));
      if (filters?.verifiedOnly) params.set('verifiedOnly', 'true');
      const queryString = params.toString();
      const query = queryString ? `?${queryString}` : '';
      const response = await apiFetch<{
        profiles?: any[];
        nextCursor?: string | null;
        hasMore?: boolean;
        data?: { profiles?: any[]; nextCursor?: string | null; hasMore?: boolean };
      }>(`/api/v1/social/discover${query}`);
      const apiProfiles = (response.profiles || response.data?.profiles || [])
        .map(normalizeApiDatingProfile)
        .filter(
          (profile): profile is DatingProfile =>
            profile !== null &&
            profile.userId !== requestedUserId &&
            profile.id !== requestedUserId,
        );
      const responseNextCursor = response.nextCursor ?? response.data?.nextCursor ?? null;
      const responseHasMore = Boolean(
        response.hasMore ?? response.data?.hasMore ?? responseNextCursor,
      );

      const currentState = get();
      if (
        currentState.ownerUserId !== requestedUserId ||
        currentState.profileRequestId !== requestId
      ) {
        return;
      }

      set((state) => {
        const realProfiles = append
          ? dedupeProfiles([
              ...(state.profilesOwnerUserId === requestedUserId ? state.profiles : []),
              ...apiProfiles,
            ])
          : apiProfiles;
        return {
          profilesOwnerUserId: requestedUserId,
          profiles: realProfiles.length > 0 || append ? realProfiles : [],
          nextCursor: responseNextCursor,
          hasMore: responseHasMore,
          loading: false,
          prefetching: false,
        };
      });
    } catch (error: any) {
      const currentState = get();
      if (
        currentState.ownerUserId !== requestedUserId ||
        currentState.profileRequestId !== requestId
      ) {
        return;
      }
      const message = getDatingErrorMessage(error, 'Unable to load people right now.');
      warnDatingStore('fetchProfiles', error);
      set((state) => ({
        profiles: append ? state.profiles : [],
        error: message,
        hasMore: false,
        loading: false,
        prefetching: false,
      }));
    }
  },

  fetchMatches: async (userId: string) => {
    const requestedUserId = normalizeUserId(userId);
    if (!requestedUserId || get().ownerUserId !== requestedUserId) return;
    const requestId = get().matchesRequestId + 1;
    set({ matchesLoading: true, matchesRequestId: requestId });
    try {
      const response = await apiFetch<{ matches?: any[]; data?: { matches?: any[] } }>(
        '/api/v1/social/matches',
      );
      const matches: Match[] = (response.matches || response.data?.matches || [])
        .map((match: any) => ({
          id: match.matchId || match.id,
          otherUserId:
            firstNonEmptyString(
              match.profile?.userId,
              match.profile?.uid,
              match.profile?.id,
              match.otherUserId,
            ) || '',
          displayName: match.displayName || match.profile?.firstName || 'C1rcle User',
          photoURL: match.photoURL || match.profile?.photo || undefined,
          sharedEventTitle: match.sharedEventTitle || match.eventTitle || 'Shared Event',
          matchedAt: match.matchedAt || new Date().toISOString(),
          conversationId: match.conversationId,
          isPremium:
            match.isPremium === true ||
            match.profile?.isPremium === true ||
            match.profile?.subscription?.tier === 'premium',
        }))
        .filter(
          (match: Match) =>
            Boolean(match.id && match.otherUserId) && match.otherUserId !== requestedUserId,
        );

      matches.sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
      const currentState = get();
      if (
        currentState.ownerUserId !== requestedUserId ||
        currentState.matchesRequestId !== requestId
      ) {
        return;
      }
      set({ matchesOwnerUserId: requestedUserId, matches, matchesLoading: false });
    } catch (error: any) {
      const currentState = get();
      if (
        currentState.ownerUserId !== requestedUserId ||
        currentState.matchesRequestId !== requestId
      ) {
        return;
      }
      if (error.status === 401) {
        const { router } = await import('expo-router');
        router.push('/(auth)/login');
      }
      warnDatingStore('fetchMatches', error);
      set({ matchesLoading: false });
    }
  },

  likeUser: async (fromUserId: string, profile: DatingProfile) => {
    const actorUserId = normalizeUserId(fromUserId);
    const targetUserId = normalizeUserId(profile.userId);
    if (
      !actorUserId ||
      !targetUserId ||
      actorUserId === targetUserId ||
      !ownsTargetProfile(get(), actorUserId, targetUserId)
    ) {
      return { isMatch: false };
    }
    get().removeTopProfile(actorUserId, targetUserId);

    const idempotencyKey = `like_${actorUserId}_${targetUserId}_${Date.now()}`;
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await apiFetch<{
          match?: boolean;
          conversationId?: string;
          data?: {
            match?: boolean;
            conversationId?: string;
            subscription?: any;
            usage?: any;
            limits?: any;
          };
        }>('/api/v1/social/swipe', {
          method: 'POST',
          body: JSON.stringify({ targetUserId, action: 'like' }),
          headers: { 'X-Idempotency-Key': idempotencyKey },
        });
        if (!ownsProfileDeck(get(), actorUserId)) return { isMatch: false };
        useSubscriptionStore.getState().applyServerContext(response.data || response);

        const isMatch = response.match === true || response.data?.match === true;
        const conversationId = response.conversationId || response.data?.conversationId;
        if (isMatch) {
          const match: Match = {
            id: `match_${targetUserId}`,
            otherUserId: targetUserId,
            displayName: profile.displayName,
            photoURL: profile.photoURL,
            sharedEventTitle: profile.sharedEventTitle,
            matchedAt: new Date().toISOString(),
            conversationId,
            isPremium: profile.isPremium,
          };

          set((s) => ({
            matchesOwnerUserId: actorUserId,
            matches: [match, ...(s.matchesOwnerUserId === actorUserId ? s.matches : [])],
          }));
          return { isMatch: true, match };
        }

        return { isMatch: false };
      } catch (error: any) {
        if (!ownsProfileDeck(get(), actorUserId)) return { isMatch: false };
        if (error.code === 'PREMIUM_REQUIRED') {
          set((s) =>
            ownsProfileDeck(s, actorUserId) ? { profiles: [profile, ...s.profiles] } : {},
          );
          useSubscriptionStore.getState().openPaywall('dailyLikes', error.message);
          return { isMatch: false, paywalled: true };
        }
        lastError = error;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    set((s) => (ownsProfileDeck(s, actorUserId) ? { profiles: [profile, ...s.profiles] } : {}));
    warnDatingStore('likeUser failed after 3 retries', lastError);
    return { isMatch: false };
  },

  sendAskOut: async (fromUserId: string, profile: DatingProfile, message?: string) => {
    const actorUserId = normalizeUserId(fromUserId);
    const targetUserId = normalizeUserId(profile.userId);
    if (
      !actorUserId ||
      !targetUserId ||
      actorUserId === targetUserId ||
      !ownsTargetProfile(get(), actorUserId, targetUserId)
    ) {
      return { sent: false, isMatch: false };
    }
    get().removeTopProfile(actorUserId, targetUserId);
    try {
      const response = await apiFetch<{
        match?: boolean;
        conversationId?: string;
        data?: {
          match?: boolean;
          conversationId?: string;
          subscription?: any;
          usage?: any;
          limits?: any;
        };
      }>('/api/v1/social/swipe', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId,
          action: 'askOut',
          message,
          eventId: profile.sharedEventId,
        }),
      });
      if (!ownsProfileDeck(get(), actorUserId)) return { sent: false, isMatch: false };
      useSubscriptionStore.getState().applyServerContext(response.data || response);

      const isMatch = response.match === true || response.data?.match === true;
      const conversationId = response.conversationId || response.data?.conversationId;
      if (isMatch) {
        const match: Match = {
          id: `match_${targetUserId}`,
          otherUserId: targetUserId,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          sharedEventTitle: profile.sharedEventTitle,
          matchedAt: new Date().toISOString(),
          conversationId,
          isPremium: profile.isPremium,
        };

        set((s) => ({
          matchesOwnerUserId: actorUserId,
          matches: [match, ...(s.matchesOwnerUserId === actorUserId ? s.matches : [])],
        }));
        return { sent: true, isMatch: true, match };
      }

      return { sent: true, isMatch: false };
    } catch (error: any) {
      if (!ownsProfileDeck(get(), actorUserId)) return { sent: false, isMatch: false };
      if (error.code === 'PREMIUM_REQUIRED') {
        useSubscriptionStore.getState().openPaywall('askOuts', error.message);
        return { sent: false, isMatch: false, paywalled: true };
      }
      warnDatingStore('sendAskOut', error);
      return { sent: false, isMatch: false };
    }
  },

  passUser: async (fromUserId: string, targetUserId: string) => {
    const actorUserId = normalizeUserId(fromUserId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);
    if (
      !actorUserId ||
      !normalizedTargetUserId ||
      actorUserId === normalizedTargetUserId ||
      !ownsTargetProfile(get(), actorUserId, normalizedTargetUserId)
    ) {
      return;
    }
    const removedProfile = get().profiles.find(
      (profile) =>
        profile.userId === normalizedTargetUserId || profile.id === normalizedTargetUserId,
    );
    get().removeTopProfile(actorUserId, normalizedTargetUserId);

    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await apiFetch('/api/v1/social/swipe', {
          method: 'POST',
          body: JSON.stringify({ targetUserId: normalizedTargetUserId, action: 'pass' }),
        });
        if (!ownsProfileDeck(get(), actorUserId)) return;
        useSubscriptionStore.getState().applyServerContext((response as any).data || response);
        return;
      } catch (error: any) {
        if (!ownsProfileDeck(get(), actorUserId)) return;
        lastError = error;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (removedProfile) {
      set((s) =>
        ownsProfileDeck(s, actorUserId) ? { profiles: [removedProfile, ...s.profiles] } : {},
      );
    }
    warnDatingStore('passUser failed after 3 retries', lastError);
  },

  removeTopProfile: (ownerUserId: string, targetUserId: string) => {
    const requestedOwnerUserId = normalizeUserId(ownerUserId);
    const requestedTargetUserId = normalizeUserId(targetUserId);
    set((state) =>
      requestedOwnerUserId &&
      requestedTargetUserId &&
      ownsTargetProfile(state, requestedOwnerUserId, requestedTargetUserId)
        ? {
            profiles: state.profiles.filter(
              (profile) =>
                profile.userId !== requestedTargetUserId && profile.id !== requestedTargetUserId,
            ),
          }
        : {},
    );
  },
}));

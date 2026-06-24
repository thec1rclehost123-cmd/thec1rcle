import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { MOCK_PROFILES, type DatingProfile as MockDatingProfile } from '@/lib/data/mockDating';

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
  age: number;
  headline: string;
  photoURL?: string;
  bio?: string;
  city?: string;
  vibeTags?: string[];
  isVerified?: boolean;
  // Shared event context — why this person is shown
  sharedEventId: string;
  sharedEventTitle: string;
  sharedEventDate: string;
  sharedEventCover?: string;
  sharedEvent: string;
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
}

interface DatingState {
  profiles: DatingProfile[];
  matches: Match[];
  loading: boolean;
  prefetching: boolean;
  matchesLoading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasMore: boolean;

  fetchProfiles: (userId: string, options?: { append?: boolean }) => Promise<void>;
  fetchMatches: (userId: string) => Promise<void>;
  likeUser: (
    fromUserId: string,
    profile: DatingProfile,
  ) => Promise<{ isMatch: boolean; match?: Match }>;
  passUser: (fromUserId: string, targetUserId: string) => Promise<void>;
  removeTopProfile: () => void;
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

function normalizePhotos(profile: any, fallback: MockDatingProfile): DatingPhoto[] {
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

  return photos.length > 0 ? photos : fallback.photos;
}

function normalizePrompts(profile: any, fallback: MockDatingProfile): Prompt[] {
  const rawPrompts = Array.isArray(profile.prompts) ? profile.prompts : [];
  const prompts = rawPrompts
    .map((prompt: any, index: number) => ({
      id: String(prompt?.id || `${profile.userId || profile.id || 'prompt'}-${index}`),
      title: String(prompt?.title || prompt?.question || 'My night out vibe is'),
      answer: String(prompt?.answer || prompt?.response || ''),
    }))
    .filter((prompt: Prompt) => prompt.answer.trim().length > 0);

  if (prompts.length > 0) return prompts;

  const bio = firstNonEmptyString(profile.bio, profile.headline, profile.about);
  if (bio) {
    return [
      {
        id: `${profile.userId || profile.id || 'profile'}-bio`,
        title: 'My night out vibe is',
        answer: bio,
      },
    ];
  }

  return fallback.prompts;
}

function normalizeApiDatingProfile(profile: any, index: number): DatingProfile | null {
  const fallback = MOCK_PROFILES[index % MOCK_PROFILES.length];
  const userId = firstNonEmptyString(profile.userId, profile.uid, profile.id);
  if (!userId) return null;

  const displayName =
    firstNonEmptyString(profile.displayName, profile.name, profile.firstName) || 'C1rcle User';
  const age = Number(profile.age) || getAgeFromDate(profile.dateOfBirth) || fallback.age;
  const sharedEventTitle =
    firstNonEmptyString(
      profile.sharedEventTitle,
      profile.eventTitle,
      profile.upcomingEvents?.[0]?.title,
    ) || 'Shared Event';
  const city = firstNonEmptyString(profile.city, profile.location);
  const vibeTags = Array.isArray(profile.vibeTags)
    ? profile.vibeTags
    : Array.isArray(profile.tags)
      ? profile.tags
      : [];
  const tags = vibeTags.length > 0 ? vibeTags : fallback.tags;

  return {
    ...profile,
    userId,
    id: userId,
    displayName,
    name: displayName.split(' ')[0] || displayName,
    age,
    headline:
      firstNonEmptyString(profile.headline, profile.bio, profile.prompts?.[0]?.answer) ||
      fallback.headline,
    photoURL: firstNonEmptyString(profile.photoURL, profile.photo, profile.avatar),
    bio: profile.bio || profile.headline,
    city,
    vibeTags,
    isVerified: profile.isVerified === true,
    sharedEventId:
      firstNonEmptyString(profile.sharedEventId, profile.upcomingEvents?.[0]?.id) || 'global',
    sharedEventTitle,
    sharedEventDate: firstNonEmptyString(profile.sharedEventDate, profile.eventDate) || '',
    sharedEventCover: firstNonEmptyString(profile.sharedEventCover, profile.eventCover),
    sharedEvent: sharedEventTitle,
    venue: firstNonEmptyString(profile.venue, profile.venueName, city) || sharedEventTitle,
    distance:
      profile.distanceKm !== undefined
        ? `${Number(profile.distanceKm).toFixed(1)} km away`
        : firstNonEmptyString(profile.distance) || fallback.distance,
    profileRouteId: userId,
    tags,
    photos: normalizePhotos(profile, fallback),
    prompts: normalizePrompts(profile, fallback),
  };
}

function normalizeMockDatingProfile(profile: MockDatingProfile): DatingProfile {
  return {
    userId: profile.id,
    id: profile.id,
    displayName: profile.name,
    name: profile.name,
    age: profile.age,
    headline: profile.headline,
    photoURL: undefined,
    bio: profile.headline,
    city: undefined,
    vibeTags: profile.tags,
    isVerified: profile.tags.includes('Verified'),
    sharedEventId: profile.sharedEvent,
    sharedEventTitle: profile.sharedEvent,
    sharedEventDate: '',
    sharedEventCover: undefined,
    sharedEvent: profile.sharedEvent,
    venue: profile.venue,
    distance: profile.distance,
    profileRouteId: profile.profileRouteId,
    tags: profile.tags,
    photos: profile.photos,
    prompts: profile.prompts,
    isDemo: true,
  };
}

function appendMockProfiles(profiles: DatingProfile[]): DatingProfile[] {
  const seenIds = new Set<string>();
  const uniqueProfiles = profiles.filter((profile) => {
    const id = profile.userId || profile.id;
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
  const mockProfiles = MOCK_PROFILES.map(normalizeMockDatingProfile).filter((profile) => {
    const id = profile.userId || profile.id;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  return [...uniqueProfiles, ...mockProfiles];
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

export const useDatingStore = create<DatingState>((set, get) => ({
  profiles: [],
  matches: [],
  loading: false,
  prefetching: false,
  matchesLoading: false,
  error: null,
  nextCursor: null,
  hasMore: true,

  fetchProfiles: async (userId: string, options = {}) => {
    const append = options.append === true;
    const { loading, prefetching, hasMore, nextCursor } = get();
    if (append) {
      if (loading || prefetching || !hasMore || !nextCursor) return;
      set({ prefetching: true, error: null });
    } else {
      if (loading) return;
      set({ loading: true, error: null, nextCursor: null, hasMore: true });
    }

    try {
      const query = append && nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : '';
      const response = await apiFetch<{
        profiles?: any[];
        nextCursor?: string | null;
        hasMore?: boolean;
        data?: { profiles?: any[]; nextCursor?: string | null; hasMore?: boolean };
      }>(`/api/v1/social/discover${query}`);
      const apiProfiles = (response.profiles || response.data?.profiles || [])
        .map(normalizeApiDatingProfile)
        .filter(Boolean) as DatingProfile[];
      const responseNextCursor = response.nextCursor ?? response.data?.nextCursor ?? null;
      const responseHasMore = Boolean(
        response.hasMore ?? response.data?.hasMore ?? responseNextCursor,
      );

      set((state) => {
        const realProfiles = append
          ? dedupeProfiles([...state.profiles, ...apiProfiles])
          : apiProfiles;
        return {
          profiles: realProfiles.length > 0 || append ? realProfiles : appendMockProfiles([]),
          nextCursor: responseNextCursor,
          hasMore: responseHasMore,
          loading: false,
          prefetching: false,
        };
      });
    } catch (error: any) {
      console.error('[DatingStore] fetchProfiles:', error);
      set((state) => ({
        profiles: append ? state.profiles : appendMockProfiles([]),
        error: error.message,
        loading: false,
        prefetching: false,
      }));
    }
  },

  fetchMatches: async (userId: string) => {
    set({ matchesLoading: true });
    try {
      const response = await apiFetch<{ matches?: any[]; data?: { matches?: any[] } }>(
        '/api/v1/social/matches',
      );
      const matches: Match[] = (response.matches || response.data?.matches || []).map(
        (match: any) => ({
          id: match.matchId || match.id,
          otherUserId: match.profile?.id || match.otherUserId,
          displayName: match.displayName || match.profile?.firstName || 'C1rcle User',
          photoURL: match.photoURL || match.profile?.photo || undefined,
          sharedEventTitle: match.sharedEventTitle || match.eventTitle || 'Shared Event',
          matchedAt: match.matchedAt || new Date().toISOString(),
          conversationId: match.conversationId,
        }),
      );

      matches.sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
      set({ matches, matchesLoading: false });
    } catch (error: any) {
      console.error('[DatingStore] fetchMatches:', error);
      set({ matchesLoading: false });
    }
  },

  likeUser: async (fromUserId: string, profile: DatingProfile) => {
    try {
      const response = await apiFetch<{
        match?: boolean;
        conversationId?: string;
        data?: { match?: boolean; conversationId?: string };
      }>('/api/v1/social/swipe', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: profile.userId, action: 'like' }),
      });

      const isMatch = response.match === true || response.data?.match === true;
      const conversationId = response.conversationId || response.data?.conversationId;
      if (isMatch) {
        const match: Match = {
          id: `match_${profile.userId}`,
          otherUserId: profile.userId,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          sharedEventTitle: profile.sharedEventTitle,
          matchedAt: new Date().toISOString(),
          conversationId,
        };

        set((s) => ({ matches: [match, ...s.matches] }));
        return { isMatch: true, match };
      }

      return { isMatch: false };
    } catch (error: any) {
      console.error('[DatingStore] likeUser:', error);
      return { isMatch: false };
    }
  },

  passUser: async (fromUserId: string, targetUserId: string) => {
    try {
      await apiFetch('/api/v1/social/swipe', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, action: 'pass' }),
      });
    } catch (error: any) {
      console.error('[DatingStore] passUser:', error);
    }
  },

  removeTopProfile: () => {
    set((s) => ({ profiles: s.profiles.slice(1) }));
  },
}));

import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface DatingProfile {
  userId: string;
  displayName: string;
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
  matchesLoading: boolean;
  error: string | null;

  fetchProfiles: (userId: string) => Promise<void>;
  fetchMatches: (userId: string) => Promise<void>;
  likeUser: (
    fromUserId: string,
    profile: DatingProfile,
  ) => Promise<{ isMatch: boolean; match?: Match }>;
  passUser: (fromUserId: string, targetUserId: string) => Promise<void>;
  removeTopProfile: () => void;
}

export const useDatingStore = create<DatingState>((set, get) => ({
  profiles: [],
  matches: [],
  loading: false,
  matchesLoading: false,
  error: null,

  fetchProfiles: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiFetch<{ profiles?: any[]; data?: { profiles?: any[] } }>(
        '/api/v1/social/discover',
      );
      const profiles: DatingProfile[] = (response.profiles || response.data?.profiles || []).map(
        (profile: any) => ({
          userId: profile.userId || profile.id,
          displayName: profile.displayName || profile.firstName || 'C1rcle User',
          photoURL: profile.photoURL || profile.photo || profile.photos?.[0],
          bio: profile.bio || profile.prompts?.[0]?.answer,
          city: profile.city,
          vibeTags: profile.vibeTags,
          isVerified: profile.isVerified === true,
          sharedEventId: profile.sharedEventId || profile.upcomingEvents?.[0] || 'global',
          sharedEventTitle: profile.sharedEventTitle || 'Shared Event',
          sharedEventDate: profile.sharedEventDate || '',
          sharedEventCover: profile.sharedEventCover,
        }),
      );
      set({ profiles, loading: false });
    } catch (error: any) {
      console.error('[DatingStore] fetchProfiles:', error);
      set({ error: error.message, loading: false });
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

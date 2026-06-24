/**
 * eventInterestStore.ts
 *
 * Manages:
 *  - Event likes ("interested") — routed through the API Gateway RSVP contract
 *  - Interested users list per event (shown in the public Interested List)
 *  - Event group chat membership on ticket purchase (via API Gateway)
 *
 * Chat membership is handled server-side via POST /api/v1/social/chat/join
 */
import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface InterestedUser {
  userId: string;
  displayName: string;
  photoURL: string | null;
  likedAt: string;
}

export interface GroupChatMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  joinedAt: string;
  source: 'ticket' | 'interest';
}

interface EventInterestState {
  /** Set of event IDs the current user has liked */
  likedEventIds: Set<string>;
  /** Interested users per eventId */
  interestedUsers: Record<string, InterestedUser[]>;
  /** Group chat members per eventId */
  groupChatMembers: Record<string, GroupChatMember[]>;
  /** Loading state per eventId */
  loadingInterested: Record<string, boolean>;

  /** Load all events the current user has liked */
  loadUserInterests: (userId: string) => Promise<void>;
  /** Load current viewer's interested state for a single event */
  fetchEventInterestState: (eventId: string) => Promise<void>;
  /** Toggle like on an event */
  toggleInterest: (
    eventId: string,
    userId: string,
    userInfo: { displayName: string; photoURL: string | null },
  ) => Promise<void>;
  /** Fetch list of users interested in an event */
  fetchInterestedUsers: (eventId: string) => Promise<void>;
  /** Auto-add user to event group chat when ticket is purchased */
  joinEventGroupChat: (
    eventId: string,
    userId: string,
    userInfo: { displayName: string; photoURL: string | null },
  ) => Promise<void>;
  /** Fetch group chat members for an event */
  fetchGroupChatMembers: (eventId: string) => Promise<void>;
}

export const useEventInterestStore = create<EventInterestState>((set, get) => ({
  likedEventIds: new Set(),
  interestedUsers: {},
  groupChatMembers: {},
  loadingInterested: {},

  loadUserInterests: async (userId: string) => {
    try {
      const response = await apiFetch<any>('/api/v1/users/me', { requireAuth: true });
      const profile = response.profile || response.data?.profile || {};
      const ids = new Set<string>(
        [
          ...(Array.isArray(profile.attendedEvents) ? profile.attendedEvents : []),
          ...(Array.isArray(profile.interestedEvents) ? profile.interestedEvents : []),
          ...(Array.isArray(profile.interestedEventIds) ? profile.interestedEventIds : []),
        ].filter(Boolean),
      );
      set({ likedEventIds: ids });
    } catch (e) {
      console.warn('[EventInterestStore] loadUserInterests:', e);
    }
  },

  fetchEventInterestState: async (eventId: string) => {
    try {
      const response = await apiFetch<any>(
        `/api/v1/events/${encodeURIComponent(eventId)}/viewer-state`,
        { requireAuth: true },
      );
      const viewerState = response.data || response;
      const isInterested = Boolean(viewerState.hasRsvped || viewerState.isInterested);
      const next = new Set(get().likedEventIds);
      if (isInterested) next.add(eventId);
      else next.delete(eventId);
      set({ likedEventIds: next });
    } catch (e) {
      console.warn('[EventInterestStore] fetchEventInterestState:', e);
    }
  },

  toggleInterest: async (eventId, userId, userInfo) => {
    const { likedEventIds } = get();
    const isLiked = likedEventIds.has(eventId);

    // Optimistic update
    const next = new Set(likedEventIds);
    if (isLiked) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    set({ likedEventIds: next });

    try {
      await apiFetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ shouldInclude: !isLiked }),
        requireAuth: true,
      });

      if (isLiked) {
        const current = get().interestedUsers[eventId] ?? [];
        set({
          interestedUsers: {
            ...get().interestedUsers,
            [eventId]: current.filter((u) => u.userId !== userId),
          },
        });
      } else {
        const payload = {
          userId,
          displayName: userInfo.displayName || 'C1rcle User',
          photoURL: userInfo.photoURL ?? null,
          likedAt: new Date().toISOString(),
        };
        const current = get().interestedUsers[eventId] ?? [];
        if (!current.find((u) => u.userId === userId)) {
          set({
            interestedUsers: {
              ...get().interestedUsers,
              [eventId]: [payload, ...current],
            },
          });
        }
      }
    } catch (e) {
      console.warn('[EventInterestStore] toggleInterest failed:', e);
      // Rollback
      set({ likedEventIds });
    }
  },

  fetchInterestedUsers: async (eventId: string) => {
    if (get().loadingInterested[eventId]) return;
    set({ loadingInterested: { ...get().loadingInterested, [eventId]: true } });
    try {
      const response = await apiFetch<any>(
        `/api/v1/events/${encodeURIComponent(eventId)}/interested?limit=24`,
        { requireAuth: true },
      );
      const interested = response.users || response.data?.users || [];
      const users: InterestedUser[] = interested.map((user: any) => ({
        userId: user.userId || user.id,
        displayName: user.displayName || user.name || 'C1rcle User',
        photoURL: user.photoURL || user.avatar || null,
        likedAt: user.likedAt || user.createdAt || '',
      }));
      set({ interestedUsers: { ...get().interestedUsers, [eventId]: users } });
    } catch (e) {
      console.warn('[EventInterestStore] fetchInterestedUsers:', e);
    } finally {
      set({ loadingInterested: { ...get().loadingInterested, [eventId]: false } });
    }
  },

  joinEventGroupChat: async (eventId, userId, userInfo) => {
    try {
      await apiFetch('/api/v1/social/chat/join', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          displayName: userInfo.displayName || 'C1rcle User',
          photoURL: userInfo.photoURL ?? null,
        }),
        requireAuth: true,
      });
    } catch (e) {
      console.warn('[EventInterestStore] joinEventGroupChat:', e);
    }
  },

  fetchGroupChatMembers: async (eventId: string) => {
    try {
      const response = await apiFetch<any>(
        `/api/v1/events/${encodeURIComponent(eventId)}/attendees?limit=100`,
        { requireAuth: true },
      );
      const attendees = response.attendees || response.data?.attendees || [];
      const members: GroupChatMember[] = attendees.map((attendee: any) => ({
        userId: attendee.userId || attendee.id,
        displayName: attendee.displayName || attendee.name || 'C1rcle User',
        photoURL: attendee.photoURL || attendee.avatar || null,
        joinedAt: attendee.joinedAt || '',
        source: 'ticket',
      }));
      set({ groupChatMembers: { ...get().groupChatMembers, [eventId]: members } });
    } catch (e) {
      console.warn('[EventInterestStore] fetchGroupChatMembers:', e);
    }
  },
}));

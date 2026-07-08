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

const RECENT_INTEREST_TOGGLE_MS = 15_000;
const recentInterestToggles = new Map<string, { included: boolean; at: number }>();

export function __resetRecentInterestTogglesForTests() {
  recentInterestToggles.clear();
}

type InterestOverrides = Record<string, boolean>;

function isFreshInterestToggle(toggle: { included: boolean; at: number } | undefined) {
  return Boolean(toggle && Date.now() - toggle.at < RECENT_INTEREST_TOGGLE_MS);
}

function applyInterestOverrides(eventIds: Set<string>, overrides: InterestOverrides) {
  const next = new Set(eventIds);
  for (const [eventId, included] of Object.entries(overrides)) {
    if (included) next.add(eventId);
    else next.delete(eventId);
  }
  return next;
}

function applyRecentInterestToggles(eventIds: Set<string>) {
  const recentOverrides: InterestOverrides = {};
  for (const [eventId, toggle] of recentInterestToggles.entries()) {
    if (!isFreshInterestToggle(toggle)) {
      recentInterestToggles.delete(eventId);
      continue;
    }
    recentOverrides[eventId] = toggle.included;
  }
  return applyInterestOverrides(eventIds, recentOverrides);
}

function shouldRollbackInterestToggle(error: unknown) {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0;
  return status === 401 || status === 403 || status === 404;
}

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
  /** Session-local truth for fresh user taps; prevents stale reads from visually clearing hearts */
  interestOverrides: InterestOverrides;
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
  /** Check if an event is liked by the current user */
  isInterested: (eventId: string) => boolean;
}

export const useEventInterestStore = create<EventInterestState>((set, get) => ({
  likedEventIds: new Set(),
  interestOverrides: {},
  interestedUsers: {},
  groupChatMembers: {},
  loadingInterested: {},

  isInterested: (eventId: string) => {
    const overrides = get().interestOverrides;
    if (Object.prototype.hasOwnProperty.call(overrides, eventId)) {
      return overrides[eventId];
    }
    return get().likedEventIds.has(eventId);
  },

  loadUserInterests: async (userId: string) => {
    try {
      const response = await apiFetch<any>('/api/v1/users/me', { requireAuth: true });
      const profile = response.profile || response.data?.profile || {};
      const extractIds = (arr: any[]): string[] =>
        arr
          .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.eventId || ''))
          .filter(Boolean);
      const ids = new Set<string>([
        ...(Array.isArray(profile.interestedEventIds)
          ? extractIds(profile.interestedEventIds)
          : []),
        ...(Array.isArray(profile.interestedEvents) ? extractIds(profile.interestedEvents) : []),
        ...(Array.isArray(profile.attendedEvents) ? extractIds(profile.attendedEvents) : []),
      ]);
      set((state) => ({
        likedEventIds: applyInterestOverrides(
          applyRecentInterestToggles(ids),
          state.interestOverrides,
        ),
      }));
    } catch (e) {
      console.warn('[EventInterestStore] loadUserInterests:', e);
    }
  },

  fetchEventInterestState: async (eventId: string) => {
    const likedBeforeRequest = get().isInterested(eventId);
    try {
      const response = await apiFetch<any>(
        `/api/v1/events/${encodeURIComponent(eventId)}/viewer-state`,
        { requireAuth: true },
      );
      if (get().isInterested(eventId) !== likedBeforeRequest) return;
      const viewerState = response.data || response;
      const isInterested = Boolean(viewerState.hasRsvped || viewerState.isInterested);
      const overrides = get().interestOverrides;
      if (
        Object.prototype.hasOwnProperty.call(overrides, eventId) &&
        overrides[eventId] !== isInterested
      ) {
        return;
      }
      const recentToggle = recentInterestToggles.get(eventId);
      if (isFreshInterestToggle(recentToggle) && recentToggle?.included !== isInterested) return;

      const next = new Set(get().likedEventIds);
      if (isInterested) next.add(eventId);
      else next.delete(eventId);
      set({ likedEventIds: next });
    } catch (e) {
      console.warn('[EventInterestStore] fetchEventInterestState:', e);
    }
  },

  toggleInterest: async (eventId, userId, userInfo) => {
    const previous = get().likedEventIds;
    const previousInterestOverrides = get().interestOverrides;
    const isLiked = get().isInterested(eventId);
    const previousInterestedUsers = get().interestedUsers;
    const nextIncluded = !isLiked;
    recentInterestToggles.set(eventId, { included: nextIncluded, at: Date.now() });

    // Optimistic update — use functional updater to avoid stale closure
    set((state) => {
      const next = new Set(state.likedEventIds);
      if (!nextIncluded) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return {
        likedEventIds: next,
        interestOverrides: { ...state.interestOverrides, [eventId]: nextIncluded },
      };
    });

    // Optimistically update interestedUsers
    if (isLiked) {
      set((state) => ({
        interestedUsers: {
          ...state.interestedUsers,
          [eventId]: (state.interestedUsers[eventId] ?? []).filter(
            (u) => u.userId !== userId,
          ),
        },
      }));
    } else {
      const payload = {
        userId,
        displayName: userInfo.displayName || 'C1rcle User',
        photoURL: userInfo.photoURL ?? null,
        likedAt: new Date().toISOString(),
      };
      set((state) => {
        const current = state.interestedUsers[eventId] ?? [];
        if (current.find((u) => u.userId === userId)) return state;
        return {
          interestedUsers: {
            ...state.interestedUsers,
            [eventId]: [payload, ...current],
          },
        };
      });
    }

    try {
      await apiFetch(`/api/v1/events/${encodeURIComponent(eventId)}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ shouldInclude: !isLiked }),
        requireAuth: true,
      });
    } catch (e) {
      console.warn('[EventInterestStore] toggleInterest failed:', e);
      if (shouldRollbackInterestToggle(e)) {
        recentInterestToggles.delete(eventId);
        // Full rollback — revert both likedEventIds AND interestedUsers
        set({
          likedEventIds: previous,
          interestOverrides: previousInterestOverrides,
          interestedUsers: previousInterestedUsers,
        });
      }
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
      const previousUsers = get().interestedUsers[eventId] ?? [];
      const shouldPreserveOptimisticViewer = get().likedEventIds.has(eventId);
      const mergedUsers = shouldPreserveOptimisticViewer
        ? [
            ...previousUsers.filter(
              (previousUser) => !users.some((user) => user.userId === previousUser.userId),
            ),
            ...users,
          ]
        : users;

      set({ interestedUsers: { ...get().interestedUsers, [eventId]: mergedUsers } });
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

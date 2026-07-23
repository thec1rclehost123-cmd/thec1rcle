/**
 * followStore.ts
 * Tracks which venues and hosts the signed-in user follows.
 */
import { create } from 'zustand';
import { apiFetch, deduplicateRequest } from '@/lib/api';
import { createLatestRequestGuard } from '@/lib/requestGuard';

interface FollowState {
  followedVenueIds: Set<string>;
  followedHostIds: Set<string>;
  /** true once fetchFollows() has completed at least once for the current user */
  loaded: boolean;
  loadedUserId: string | null;
  loadingUserId: string | null;

  fetchFollows: (userId: string) => Promise<void>;
  toggleVenueFollow: (venueId: string, venueName: string, userId: string) => Promise<void>;
  toggleHostFollow: (hostId: string, hostName: string, userId: string) => Promise<void>;
  isFollowingVenue: (venueId: string, userId?: string | null) => boolean;
  isFollowingHost: (hostId: string, userId?: string | null) => boolean;
  clearFollows: () => void;
}

const followRequestGuard = createLatestRequestGuard();

export const useFollowStore = create<FollowState>((set, get) => ({
  followedVenueIds: new Set(),
  followedHostIds: new Set(),
  loaded: false,
  loadedUserId: null,
  loadingUserId: null,

  fetchFollows: async (userId) => {
    const requestedUserId = userId.trim();
    if (!requestedUserId) return;

    const current = get();
    if (current.loaded && current.loadedUserId === requestedUserId) return;

    const requestToken = followRequestGuard.begin(requestedUserId);
    if (current.loadedUserId !== requestedUserId) {
      set({
        followedVenueIds: new Set(),
        followedHostIds: new Set(),
        loaded: false,
        loadedUserId: null,
        loadingUserId: requestedUserId,
      });
    } else {
      set({ loadingUserId: requestedUserId });
    }

    try {
      const response = await deduplicateRequest<{
        data?: { follows?: { venueIds?: string[]; hostIds?: string[] } };
        follows?: { venueIds?: string[]; hostIds?: string[] };
      }>(`followStore:follows:${requestedUserId}`, () => apiFetch('/api/v1/users/me/follows'));
      if (!followRequestGuard.isCurrent(requestToken)) return;
      const follows = response.data?.follows ?? response.follows ?? {};
      set({
        followedVenueIds: new Set(follows.venueIds ?? []),
        followedHostIds: new Set(follows.hostIds ?? []),
        loaded: true,
        loadedUserId: requestedUserId,
        loadingUserId: null,
      });
    } catch (e) {
      if (!followRequestGuard.isCurrent(requestToken)) return;
      set({ loadingUserId: null });
      console.error('[FollowStore] fetchFollows error', e);
    }
  },

  toggleVenueFollow: async (venueId, venueName, userId) => {
    if (!userId) return;
    if (get().loadedUserId !== userId) await get().fetchFollows(userId);
    if (get().loadedUserId !== userId) return;
    const { followedVenueIds } = get();
    const isFollowing = followedVenueIds.has(venueId);

    // Optimistic update
    const next = new Set(followedVenueIds);
    if (isFollowing) next.delete(venueId);
    else next.add(venueId);
    set({ followedVenueIds: next });

    try {
      await apiFetch(`/api/v1/venues/${encodeURIComponent(venueId)}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        body: isFollowing ? undefined : JSON.stringify({ venueName }),
      });
    } catch (e) {
      // Rollback
      if (get().loadedUserId === userId) set({ followedVenueIds });
      console.error('[FollowStore] toggleVenueFollow error', e);
    }
  },

  toggleHostFollow: async (hostId, hostName, userId) => {
    if (!userId) return;
    if (get().loadedUserId !== userId) await get().fetchFollows(userId);
    if (get().loadedUserId !== userId) return;
    const { followedHostIds } = get();
    const isFollowing = followedHostIds.has(hostId);

    const next = new Set(followedHostIds);
    if (isFollowing) next.delete(hostId);
    else next.add(hostId);
    set({ followedHostIds: next });

    try {
      await apiFetch(`/api/v1/hosts/${encodeURIComponent(hostId)}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        body: isFollowing ? undefined : JSON.stringify({ hostName }),
      });
    } catch (e) {
      if (get().loadedUserId === userId) set({ followedHostIds });
      console.error('[FollowStore] toggleHostFollow error', e);
    }
  },

  isFollowingVenue: (venueId, userId) =>
    Boolean(userId && get().loadedUserId === userId && get().followedVenueIds.has(venueId)),
  isFollowingHost: (hostId, userId) =>
    Boolean(userId && get().loadedUserId === userId && get().followedHostIds.has(hostId)),
  clearFollows: () => {
    followRequestGuard.invalidate();
    set({
      followedVenueIds: new Set(),
      followedHostIds: new Set(),
      loaded: false,
      loadedUserId: null,
      loadingUserId: null,
    });
  },
}));

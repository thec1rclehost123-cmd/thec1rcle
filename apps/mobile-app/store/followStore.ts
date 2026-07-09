/**
 * followStore.ts
 * Tracks which venues and hosts the signed-in user follows.
 */
import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

interface FollowState {
  followedVenueIds: Set<string>;
  followedHostIds: Set<string>;
  /** true once fetchFollows() has completed at least once for the current user */
  loaded: boolean;

  fetchFollows: (userId: string) => Promise<void>;
  toggleVenueFollow: (venueId: string, venueName: string, userId: string) => Promise<void>;
  toggleHostFollow: (hostId: string, hostName: string, userId: string) => Promise<void>;
  isFollowingVenue: (venueId: string) => boolean;
  isFollowingHost: (hostId: string) => boolean;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followedVenueIds: new Set(),
  followedHostIds: new Set(),
  loaded: false,

  fetchFollows: async (userId) => {
    if (!userId) return;
    try {
      const response = await apiFetch<{
        data?: { follows?: { venueIds?: string[]; hostIds?: string[] } };
        follows?: { venueIds?: string[]; hostIds?: string[] };
      }>('/api/v1/users/me/follows');
      const follows = response.data?.follows ?? response.follows ?? {};
      set({
        followedVenueIds: new Set(follows.venueIds ?? []),
        followedHostIds: new Set(follows.hostIds ?? []),
        loaded: true,
      });
    } catch (e) {
      console.error('[FollowStore] fetchFollows error', e);
    }
  },

  toggleVenueFollow: async (venueId, venueName, userId) => {
    if (!userId) return;
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
      set({ followedVenueIds });
      console.error('[FollowStore] toggleVenueFollow error', e);
    }
  },

  toggleHostFollow: async (hostId, hostName, userId) => {
    if (!userId) return;
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
      set({ followedHostIds });
      console.error('[FollowStore] toggleHostFollow error', e);
    }
  },

  isFollowingVenue: (venueId) => get().followedVenueIds.has(venueId),
  isFollowingHost: (hostId) => get().followedHostIds.has(hostId),
}));

/**
 * followStore.ts
 * Tracks which venues and hosts the signed-in user follows.
 *
 * Firestore layout:
 *   userFollows/{userId}/venues/{venueId}  — user-centric lookup (Set source)
 *   userFollows/{userId}/hosts/{hostId}    — user-centric lookup
 *   venueFollowers/{venueId}/followers/{userId}  — venue-centric mirror
 *   hostFollowers/{hostId}/followers/{userId}    — host-centric mirror
 */
import { create } from 'zustand';
import { getFirebaseApp } from '@/lib/firebase/client';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

function getDb() {
  return getFirestore(getFirebaseApp());
}

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
      const db = getDb();
      const [venueSnap, hostSnap] = await Promise.all([
        getDocs(collection(db, 'userFollows', userId, 'venues')),
        getDocs(collection(db, 'userFollows', userId, 'hosts')),
      ]);
      set({
        followedVenueIds: new Set(venueSnap.docs.map((d) => d.id)),
        followedHostIds: new Set(hostSnap.docs.map((d) => d.id)),
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
      const db = getDb();
      const userRef = doc(db, 'userFollows', userId, 'venues', venueId);
      const venueRef = doc(db, 'venueFollowers', venueId, 'followers', userId);
      if (isFollowing) {
        await Promise.all([deleteDoc(userRef), deleteDoc(venueRef)]);
      } else {
        const ts = { followedAt: serverTimestamp() };
        await Promise.all([
          setDoc(userRef, { ...ts, venueId, venueName }),
          setDoc(venueRef, { ...ts, userId }),
        ]);
      }
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
      const db = getDb();
      const userRef = doc(db, 'userFollows', userId, 'hosts', hostId);
      const hostRef = doc(db, 'hostFollowers', hostId, 'followers', userId);
      if (isFollowing) {
        await Promise.all([deleteDoc(userRef), deleteDoc(hostRef)]);
      } else {
        const ts = { followedAt: serverTimestamp() };
        await Promise.all([
          setDoc(userRef, { ...ts, hostId, hostName }),
          setDoc(hostRef, { ...ts, userId }),
        ]);
      }
    } catch (e) {
      set({ followedHostIds });
      console.error('[FollowStore] toggleHostFollow error', e);
    }
  },

  isFollowingVenue: (venueId) => get().followedVenueIds.has(venueId),
  isFollowingHost: (hostId) => get().followedHostIds.has(hostId),
}));

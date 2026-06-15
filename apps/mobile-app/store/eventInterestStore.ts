/**
 * eventInterestStore.ts
 *
 * Manages:
 *  - Event likes ("interested") — per user, written to Firestore
 *  - Interested users list per event (shown in "Who's Going")
 *  - Event group chat membership on ticket purchase
 *
 * Firestore structure:
 *   eventInterest/{eventId}/interestedUsers/{userId}
 *     → { userId, displayName, photoURL, likedAt }
 *
 *   eventGroupChatMembers/{eventId}/members/{userId}
 *     → { userId, displayName, photoURL, joinedAt, source }
 */
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { create } from 'zustand';

import { getFirebaseApp } from '@/lib/firebase/client';

function getDb() {
  return getFirestore(getFirebaseApp());
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
  /** Interested users per eventId */
  interestedUsers: Record<string, InterestedUser[]>;
  /** Group chat members per eventId */
  groupChatMembers: Record<string, GroupChatMember[]>;
  /** Loading state per eventId */
  loadingInterested: Record<string, boolean>;

  /** Load all events the current user has liked */
  loadUserInterests: (userId: string) => Promise<void>;
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
      const db = getDb();
      // Query all eventInterest subcollections where this userId has a doc
      // We store a top-level mirror collection for efficient user-centric queries
      const snap = await getDocs(collection(db, 'userEventInterests', userId, 'events'));
      const ids = new Set<string>();
      snap.forEach((d) => ids.add(d.id));
      set({ likedEventIds: ids });
    } catch (e) {
      console.warn('[EventInterestStore] loadUserInterests:', e);
    }
  },

  toggleInterest: async (eventId, userId, userInfo) => {
    const { likedEventIds } = get();
    const isLiked = likedEventIds.has(eventId);
    const db = getDb();

    // Optimistic update
    const next = new Set(likedEventIds);
    if (isLiked) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    set({ likedEventIds: next });

    try {
      // Write to eventInterest/{eventId}/interestedUsers/{userId}
      const interestRef = doc(db, 'eventInterest', eventId, 'interestedUsers', userId);
      // Mirror for user-centric queries
      const mirrorRef = doc(db, 'userEventInterests', userId, 'events', eventId);

      if (isLiked) {
        await Promise.all([deleteDoc(interestRef), deleteDoc(mirrorRef)]);
        // Remove from local interestedUsers list
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
        await Promise.all([
          setDoc(interestRef, { ...payload, _ts: serverTimestamp() }),
          setDoc(mirrorRef, { eventId, _ts: serverTimestamp() }),
        ]);
        // Add to local interestedUsers list
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
      const db = getDb();
      const snap = await getDocs(collection(db, 'eventInterest', eventId, 'interestedUsers'));
      const users: InterestedUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        users.push({
          userId: data.userId ?? d.id,
          displayName: data.displayName ?? 'C1rcle User',
          photoURL: data.photoURL ?? null,
          likedAt: data.likedAt ?? '',
        });
      });
      set({ interestedUsers: { ...get().interestedUsers, [eventId]: users } });
    } catch (e) {
      console.warn('[EventInterestStore] fetchInterestedUsers:', e);
    } finally {
      set({ loadingInterested: { ...get().loadingInterested, [eventId]: false } });
    }
  },

  joinEventGroupChat: async (eventId, userId, userInfo) => {
    try {
      const db = getDb();
      const memberRef = doc(db, 'eventGroupChatMembers', eventId, 'members', userId);
      await setDoc(memberRef, {
        userId,
        displayName: userInfo.displayName || 'C1rcle User',
        photoURL: userInfo.photoURL ?? null,
        joinedAt: new Date().toISOString(),
        source: 'ticket',
        _ts: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[EventInterestStore] joinEventGroupChat:', e);
    }
  },

  fetchGroupChatMembers: async (eventId: string) => {
    try {
      const db = getDb();
      const snap = await getDocs(collection(db, 'eventGroupChatMembers', eventId, 'members'));
      const members: GroupChatMember[] = [];
      snap.forEach((d) => {
        const data = d.data();
        members.push({
          userId: data.userId ?? d.id,
          displayName: data.displayName ?? 'C1rcle User',
          photoURL: data.photoURL ?? null,
          joinedAt: data.joinedAt ?? '',
          source: data.source ?? 'ticket',
        });
      });
      set({ groupChatMembers: { ...get().groupChatMembers, [eventId]: members } });
    } catch (e) {
      console.warn('[EventInterestStore] fetchGroupChatMembers:', e);
    }
  },
}));

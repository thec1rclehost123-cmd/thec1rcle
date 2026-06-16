import { create } from 'zustand';
import { getFirebaseApp } from '@/lib/firebase/client';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';

function getDb() {
  return getFirestore(getFirebaseApp());
}

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
      const db = getDb();

      // 1. Get this user's confirmed upcoming orders → event IDs
      const myOrdersSnap = await getDocs(
        query(
          collection(db, 'orders'),
          where('userId', '==', userId),
          where('status', 'in', ['confirmed', 'checked_in']),
        ),
      );

      if (myOrdersSnap.empty) {
        set({ profiles: [], loading: false });
        return;
      }

      const now = new Date();
      const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // next 60 days
      const eventIds: string[] = [];
      const eventMeta: Record<string, { title: string; date: string; cover?: string }> = {};

      for (const d of myOrdersSnap.docs) {
        const o = d.data();
        if (!o.eventId) continue;
        const rawDate = o.eventStartDate || o.eventDate;
        if (rawDate) {
          const evDate = new Date(rawDate);
          if (evDate >= now && evDate <= cutoff) {
            if (!eventMeta[o.eventId]) {
              eventIds.push(o.eventId);
              eventMeta[o.eventId] = {
                title: o.eventTitle || 'Upcoming Event',
                date: rawDate,
                cover: o.eventCoverImage,
              };
            }
          }
        }
      }

      if (eventIds.length === 0) {
        set({ profiles: [], loading: false });
        return;
      }

      // 2. Get IDs of users we've already liked or passed
      const [likedSnap, passedSnap] = await Promise.all([
        getDocs(query(collection(db, 'userLikes'), where('fromUserId', '==', userId))),
        getDocs(query(collection(db, 'userPasses'), where('fromUserId', '==', userId))),
      ]);

      const excluded = new Set<string>([userId]);
      likedSnap.forEach((d) => excluded.add(d.data().toUserId));
      passedSnap.forEach((d) => excluded.add(d.data().toUserId));

      // 3. For each event (max 5), collect other attendees
      const candidates: { userId: string; eventId: string }[] = [];

      for (const eventId of eventIds.slice(0, 5)) {
        const snap = await getDocs(
          query(
            collection(db, 'orders'),
            where('eventId', '==', eventId),
            where('status', 'in', ['confirmed', 'checked_in']),
          ),
        );
        for (const d of snap.docs) {
          const uid = d.data().userId;
          if (!excluded.has(uid)) {
            candidates.push({ userId: uid, eventId });
            excluded.add(uid);
          }
          if (candidates.length >= 40) break;
        }
        if (candidates.length >= 40) break;
      }

      if (candidates.length === 0) {
        set({ profiles: [], loading: false });
        return;
      }

      // 4. Fetch Firestore profiles for each candidate
      const profiles: DatingProfile[] = [];
      for (const { userId: uid, eventId } of candidates.slice(0, 25)) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (!snap.exists()) continue;
          const data = snap.data();
          if (data.isVisible === false) continue; // respect opt-out
          // Only show users who have completed (or verified) their Social Profile
          const spState = data?.socialProfile?.state;
          if (spState !== 'complete' && spState !== 'verified') continue;
          const meta = eventMeta[eventId];
          profiles.push({
            userId: uid,
            displayName: data.displayName || data.name || 'C1rcle User',
            photoURL: data.photoURL || data.avatar || undefined,
            bio: data.bio || undefined,
            city: data.city || undefined,
            vibeTags: data.vibeTags || undefined,
            isVerified: data.isVerified || false,
            sharedEventId: eventId,
            sharedEventTitle: meta?.title || 'Shared Event',
            sharedEventDate: meta?.date || '',
            sharedEventCover: meta?.cover,
          });
        } catch {
          // skip profiles that fail
        }
      }

      set({ profiles, loading: false });
    } catch (error: any) {
      console.error('[DatingStore] fetchProfiles:', error);
      set({ error: error.message, loading: false });
    }
  },

  fetchMatches: async (userId: string) => {
    set({ matchesLoading: true });
    try {
      const db = getDb();
      const [as1, as2] = await Promise.all([
        getDocs(query(collection(db, 'userMatches'), where('user1Id', '==', userId))),
        getDocs(query(collection(db, 'userMatches'), where('user2Id', '==', userId))),
      ]);

      const matches: Match[] = [];
      for (const matchDoc of [...as1.docs, ...as2.docs]) {
        const data = matchDoc.data();
        const otherId = data.user1Id === userId ? data.user2Id : data.user1Id;
        try {
          const profileSnap = await getDoc(doc(db, 'users', otherId));
          if (!profileSnap.exists()) continue;
          const p = profileSnap.data();
          matches.push({
            id: matchDoc.id,
            otherUserId: otherId,
            displayName: p.displayName || 'C1rcle User',
            photoURL: p.photoURL || undefined,
            sharedEventTitle: data.eventTitle || 'Shared Event',
            matchedAt: data.matchedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            conversationId: data.conversationId,
          });
        } catch {
          // skip
        }
      }

      matches.sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
      set({ matches, matchesLoading: false });
    } catch (error: any) {
      console.error('[DatingStore] fetchMatches:', error);
      set({ matchesLoading: false });
    }
  },

  likeUser: async (fromUserId: string, profile: DatingProfile) => {
    const db = getDb();
    try {
      // Write the like
      await addDoc(collection(db, 'userLikes'), {
        fromUserId,
        toUserId: profile.userId,
        eventId: profile.sharedEventId,
        createdAt: serverTimestamp(),
      });

      // Check for mutual like
      const mutualSnap = await getDocs(
        query(
          collection(db, 'userLikes'),
          where('fromUserId', '==', profile.userId),
          where('toUserId', '==', fromUserId),
        ),
      );

      if (!mutualSnap.empty) {
        const matchRef = await addDoc(collection(db, 'userMatches'), {
          user1Id: fromUserId,
          user2Id: profile.userId,
          eventId: profile.sharedEventId,
          eventTitle: profile.sharedEventTitle,
          matchedAt: serverTimestamp(),
        });

        const match: Match = {
          id: matchRef.id,
          otherUserId: profile.userId,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          sharedEventTitle: profile.sharedEventTitle,
          matchedAt: new Date().toISOString(),
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
      await addDoc(collection(getDb(), 'userPasses'), {
        fromUserId,
        toUserId: targetUserId,
        createdAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error('[DatingStore] passUser:', error);
    }
  },

  removeTopProfile: () => {
    set((s) => ({ profiles: s.profiles.slice(1) }));
  },
}));

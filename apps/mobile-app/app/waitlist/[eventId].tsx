import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { colors, radii, gradients } from '@/lib/design/theme';
import { getFirebaseApp } from '@/lib/firebase/client';
import { useAuthStore } from '@/store/authStore';
import { Event, useEventsStore } from '@/store/eventsStore';

function getDb() {
  return getFirestore(getFirebaseApp());
}

export default function WaitlistScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuthStore();
  const { getEventById } = useEventsStore();
  const insets = useSafeAreaInsets();

  const [joining, setJoining] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [checking, setChecking] = useState(true);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!eventId) return;
    getEventById(eventId).then(setEvent);
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !user?.email) {
      setChecking(false);
      return;
    }
    checkWaitlistStatus();
  }, [eventId, user?.email]);

  const checkWaitlistStatus = async () => {
    if (!eventId || !user?.email) return;
    try {
      // Priority 1: API Gateway (Centralized logic)
      const data = await apiFetch(
        `/api/v1/waitlist/status?eventId=${eventId}&email=${user.email}`,
        {
          requireAuth: true,
        },
      );

      if (data.joined) {
        setAlreadyJoined(true);
        setPosition(data.position);
      } else {
        setAlreadyJoined(false);
        setPosition(null);
      }
      setTotalWaiting(data.totalWaiting || 0);
    } catch (e: any) {
      // Priority 2: Fallback to direct Firestore if API is unreachable (Network request failed)
      if (e.message?.includes('Network request failed')) {
        console.warn('[Waitlist] API Gateway unreachable, falling back to direct Firestore.');
        try {
          const db = getDb();
          const col = collection(db, 'waitlist');

          // Fetch all docs for this eventId (simple query, no composite index needed)
          const snap = await getDocs(query(col, where('eventId', '==', eventId)));
          const allEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);

          // Filter for "waiting" status in JS
          const waitingEntries = allEntries
            .filter((entry: any) => entry.status === 'waiting')
            .sort((a: any, b: any) => {
              const timeA = a.createdAt?.toMillis?.() || 0;
              const timeB = b.createdAt?.toMillis?.() || 0;
              return timeA - timeB;
            });

          setTotalWaiting(waitingEntries.length);

          const userEntry = waitingEntries.find((entry: any) => entry.email === user.email);

          if (userEntry) {
            setAlreadyJoined(true);
            // Position is the index in the sorted array + 1
            const userIndex = waitingEntries.findIndex((entry: any) => entry.id === userEntry.id);
            setPosition(userIndex + 1);
          } else {
            setAlreadyJoined(false);
            setPosition(null);
          }
        } catch (fsErr: any) {
          console.error('[Waitlist] Firestore fallback failed:', fsErr);
        }
      } else {
        console.error('Error checking waitlist status:', e);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.email || !user?.uid || !eventId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    try {
      // Try API first
      await apiFetch(`/api/v1/waitlist/join`, {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          userId: user.uid,
          email: user.email,
          phone: (user as any).phoneNumber ?? null,
        }),
      });
      await checkWaitlistStatus();
    } catch (err: any) {
      if (err.message?.includes('Network request failed')) {
        // Fallback to direct Firestore join
        try {
          await addDoc(collection(getDb(), 'waitlist'), {
            eventId,
            userId: user.uid,
            email: user.email,
            phone: (user as any).phoneNumber ?? null,
            status: 'waiting',
            createdAt: serverTimestamp(),
          });
          await checkWaitlistStatus();
        } catch (fsErr) {
          console.error('Error joining waitlist via Firestore:', fsErr);
        }
      } else {
        console.error('Error joining waitlist:', err);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(244,74,34,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Waitlist</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {checking ? (
          <ActivityIndicator color={colors.iris} size="large" />
        ) : alreadyJoined ? (
          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.card}>
              <View style={styles.positionCircle}>
                <Text style={styles.positionNumber}>#{position ?? '—'}</Text>
              </View>
              <Text style={styles.cardTitle}>You're on the list</Text>
              <Text style={styles.cardSubtitle}>
                You're #{position} of {totalWaiting} people waiting.
              </Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Notification will be sent to {user?.email}</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.card}>
              <Text style={styles.soldOutBadge}>SOLD OUT</Text>
              <Text style={styles.cardTitle}>{event?.title ?? 'Event'}</Text>
              <Text style={styles.cardSubtitle}>
                {totalWaiting > 0
                  ? `${totalWaiting} people are already waiting.`
                  : 'Tickets are sold out.'}
              </Text>
              <View style={styles.howItWorks}>
                <Text style={styles.howTitle}>How it works</Text>
                <Text style={styles.howText}>
                  1. Join the list. 2. We'll notify you when a spot opens. 3. Buy within 15 mins.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {!checking && !alreadyJoined && (
        <View style={styles.footer}>
          <Pressable
            onPress={handleJoin}
            disabled={joining}
            style={[styles.joinBtn, joining && { opacity: 0.6 }]}
          >
            <LinearGradient
              colors={gradients.primary as [string, string]}
              style={styles.joinGradient}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinText}>Join Waitlist</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base.DEFAULT },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.base[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.gold, fontSize: 20 },
  headerTitle: { color: colors.gold, fontSize: 17, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },
  card: {
    width: '100%',
    backgroundColor: colors.base[50],
    borderRadius: radii['2xl'],
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.15)',
    overflow: 'hidden',
  },
  soldOutBadge: {
    backgroundColor: 'rgba(255,61,113,0.15)',
    color: colors.error,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,61,113,0.25)',
    marginBottom: 16,
  },
  positionCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(244,74,34,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(244,74,34,0.3)',
    marginBottom: 20,
  },
  positionNumber: { color: colors.iris, fontSize: 28, fontWeight: '900' },
  cardTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardSubtitle: {
    color: colors.goldMetallic,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  infoRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.xl,
  },
  infoText: { color: colors.goldMetallic, fontSize: 13 },
  howItWorks: { width: '100%', gap: 12, marginTop: 4 },
  howTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  howText: { color: colors.goldMetallic, fontSize: 14 },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    alignItems: 'center',
    gap: 12,
  },
  joinBtn: { width: '100%', borderRadius: radii.pill, overflow: 'hidden' },
  joinGradient: { paddingVertical: 18, alignItems: 'center' },
  joinText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

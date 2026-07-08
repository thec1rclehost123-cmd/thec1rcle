import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Event, useEventsStore } from '@/store/eventsStore';
import { colors, radii, gradients } from '@/lib/design/theme';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    getEventById(eventId).then(setEvent);
  }, [eventId]);

  const checkWaitlistStatus = useCallback(async () => {
    if (!eventId || !user?.email) return;
    try {
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
      setError(e.message || 'Unable to check waitlist status');
    } finally {
      setChecking(false);
    }
  }, [eventId, user?.email]);

  useEffect(() => {
    if (!eventId || !user?.email) {
      setChecking(false);
      return;
    }
    setChecking(true);
    checkWaitlistStatus();
  }, [checkWaitlistStatus, eventId, user?.email]);

  const handleJoin = async () => {
    if (!user?.email || !user?.uid || !eventId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    setError(null);
    try {
      const phone = (user as any).phoneNumber;
      const payload: { eventId: string; email: string; phone?: string } = {
        eventId,
        email: user.email,
      };
      if (typeof phone === 'string' && phone.trim()) {
        payload.phone = phone.trim();
      }

      await apiFetch(`/api/v1/waitlist/join`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await checkWaitlistStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to join waitlist');
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
        ) : error ? (
          <Animated.View entering={FadeInDown.springify()}>
            <View style={styles.card}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.cardTitle}>Something went wrong</Text>
              <Text style={styles.cardSubtitle}>{error}</Text>
              <Pressable
                onPress={() => {
                  setError(null);
                  setChecking(true);
                  checkWaitlistStatus();
                }}
                style={styles.retryBtn}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          </Animated.View>
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

      {!checking && !alreadyJoined && !error && (
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
  errorEmoji: { fontSize: 40, marginBottom: 16 },
  retryBtn: {
    backgroundColor: colors.iris,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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

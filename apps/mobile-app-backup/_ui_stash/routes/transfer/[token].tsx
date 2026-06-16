/**
 * THE C1RCLE — Universal Claim & Transfer Screen
 * Handles deep links for:
 * - Share bundle claim tokens (tickets/claim)
 * - Formal transfer tokens (tickets/transfer)
 *
 * Note: This is a parity port from `c1rcle-mobile-standalone` with minor
 * adjustments to use the mobile app's API client.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { colors, gradients } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useTicketsStore } from '@/store/ticketsStore';
import {
  getTransferDetails,
  acceptFormalTransfer,
  getShareBundle,
  claimShareTicket,
} from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Mode = 'transfer' | 'share';

export default function ClaimOrTransferScreen() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>();
  const insets = useSafeAreaInsets();
  const { user, initialized } = useAuthStore();
  const { fetchUserOrders } = useTicketsStore();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('share');

  // Token can be either:
  // - path param (transfer/[token] or claim/[token]) → params.token
  // - query param ?code= or ?token= passed into this route
  const pathToken = params.token;
  const queryCode = params.code;

  useEffect(() => {
    if (!initialized) return;
    void loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, pathToken, queryCode]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);

    const candidate = queryCode || pathToken;
    if (!candidate) {
      setError('No valid claim code provided.');
      setLoading(false);
      return;
    }

    try {
      // If explicit query `code` is present, treat it as transfer.
      if (queryCode) {
        setMode('transfer');
        const res = await getTransferDetails(queryCode);
        if (res?.success) setData(res.transfer ?? res);
        else setError(res?.error || 'Transfer request not found or expired.');
        return;
      }

      // Otherwise, attempt share token first, then fallback to transfer code.
      const shareRes = await getShareBundle(candidate);
      if (shareRes?.success) {
        setMode('share');
        setData(shareRes.bundle ?? shareRes);
        return;
      }

      const transferRes = await getTransferDetails(candidate);
      if (transferRes?.success) {
        setMode('transfer');
        setData(transferRes.transfer ?? transferRes);
        return;
      }

      setError(shareRes?.error || transferRes?.error || 'This link is no longer valid.');
    } catch (e: any) {
      setError(e?.message || 'Failed to load ticket details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }

    const candidate = queryCode || pathToken;
    if (!candidate) return;

    setActionLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (mode === 'transfer') {
        const res = await acceptFormalTransfer({ transferCode: candidate });
        if (res?.success) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await fetchUserOrders(user.uid);
          router.replace('/(tabs)/tickets');
        } else {
          setError(res?.error || 'Failed to accept transfer.');
        }
      } else {
        const res = await claimShareTicket(candidate);
        if (res?.success) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await fetchUserOrders(user.uid);
          router.replace('/(tabs)/tickets');
        } else {
          setError(res?.error || 'Failed to claim ticket.');
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.iris} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.replace('/(tabs)/explore')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Explore Events</Text>
        </Pressable>
      </View>
    );
  }

  const transferEvent = data?.event || {};
  const shareEvent = {
    title: data?.eventTitle,
    image: data?.eventImage,
    date: data?.eventDate,
    location: data?.eventLocation,
  };

  const event = mode === 'transfer' ? transferEvent : shareEvent;
  const sender = mode === 'transfer' ? data?.senderName : data?.ownerName || data?.userName;

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Hero Poster */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: event.posterUrl || event.image }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
            style={styles.heroOverlay}
          />

          <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
            <Animated.View entering={FadeInDown.delay(200)}>
              <Text style={styles.inviteLabel}>
                {mode === 'transfer' ? 'TRANSFER REQUEST' : 'TICKET INVITATION'}
              </Text>
              <Text style={styles.senderText}>
                <Text style={{ color: colors.iris }}>{sender || 'A friend'}</Text> is sending you a
                ticket
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* Event Details Card */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.content}>
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.title || 'The C1RCLE Event'}</Text>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.gold} />
              <Text style={styles.infoText}>{event.date || 'TBA'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.gold} />
              <Text style={styles.infoText}>{event.venue || event.location || 'Location TBA'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.ticketPill}>
              <Ionicons name="ticket-outline" size={16} color="#fff" />
              <Text style={styles.ticketPillText}>
                {data?.ticketName || data?.tierName || 'General Entry'}
              </Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            Once accepted, this ticket will be added to your digital wallet.
          </Text>

          <View style={{ flex: 1 }} />

          {/* Action Button */}
          <Pressable
            onPress={handleAction}
            disabled={actionLoading}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.8 },
              actionLoading && { opacity: 0.6 },
            ]}
          >
            <LinearGradient
              colors={gradients.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {user ? 'Accept & Add to Wallet' : 'Login to Accept Ticket'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  heroContainer: {
    height: SCREEN_WIDTH * 1.2,
    width: '100%',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    paddingHorizontal: 24,
    position: 'absolute',
    bottom: 40,
    width: '100%',
  },
  inviteLabel: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    opacity: 0.9,
    marginBottom: 12,
  },
  senderText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  ticketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244, 74, 34, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(244, 74, 34, 0.25)',
  },
  ticketPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 24,
  },
  actionButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
  },
  errorText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
  },
});

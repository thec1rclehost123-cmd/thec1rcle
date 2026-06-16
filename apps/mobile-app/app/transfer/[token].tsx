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

  const accent = event?.accentColor || event?.dominantColor || '#D915A8';
  const shortId = data?.id ? data.id.substring(0, 6).toUpperCase() : 'A8D8VH';
  const quantity = data?.quantity || 1;

  return (
    <View style={[styles.container, { backgroundColor: accent }]}>
      <ScrollView
        overScrollMode="never"
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header text */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[styles.headerWrap, { paddingTop: insets.top + 40 }]}
        >
          <Text style={styles.senderText}>{sender || 'Someone'} sent you tickets</Text>
        </Animated.View>

        {/* Ticket Card */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.ticketCardWrap}>
          <View style={styles.ticketCard}>
            <Image
              source={{ uri: event.posterUrl || event.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.ticketHeader}>
              <Text style={styles.ticketHost}>THE C1RCLE</Text>
              <View style={styles.ticketEventInfo}>
                <Text style={styles.ticketEventTitle} numberOfLines={1}>
                  {event.title || 'Event'}
                </Text>
                <Text style={styles.ticketEventDate}>{event.date || 'TBA'}</Text>
              </View>
            </View>

            <View style={styles.ticketCenter}>
              <View style={[styles.qrPlaceholder, { backgroundColor: accent }]}>
                <Ionicons name="qr-code" size={64} color="#161616" />
              </View>
            </View>

            <View style={styles.ticketFooter}>
              <Text style={styles.ticketId}>{shortId}</Text>
              <View style={styles.ticketQuantityBadge}>
                <Text style={styles.ticketQuantityText}>{quantity}x</Text>
                <Ionicons name="ticket" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Footer text & Actions */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.footerWrap}>
          <Text style={styles.disclaimerText}>
            Download the app to easily transfer tickets{'\n'}and manage events on the go
          </Text>

          <Pressable
            onPress={handleAction}
            disabled={actionLoading}
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && { opacity: 0.8 },
              actionLoading && { opacity: 0.6 },
            ]}
          >
            {actionLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Tickets</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.declineButton}>
            <Text style={styles.declineButtonText}>Decline</Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: 30,
  },
  senderText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0,
  },
  ticketCardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCard: {
    width: '100%',
    aspectRatio: 0.8,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#161616',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  ticketHost: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  ticketEventInfo: {
    alignItems: 'flex-end',
  },
  ticketEventTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 150,
  },
  ticketEventDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  ticketCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 20,
  },
  ticketId: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  ticketQuantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketQuantityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 40,
  },
  disclaimerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  acceptButton: {
    backgroundColor: '#fff',
    width: '100%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  acceptButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  declineButton: {
    paddingVertical: 10,
  },
  declineButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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

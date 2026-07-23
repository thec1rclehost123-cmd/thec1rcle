/**
 * THE C1RCLE - Universal Claim & Transfer Screen
 * Handles:
 * - /claim/[token] share bundle links
 * - /transfer/[token] formal transfer links
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { colors } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useTicketsStore } from '@/store/ticketsStore';
import {
  acceptFormalTransfer,
  claimShareTicket,
  getShareBundle,
  getTransferDetails,
} from '@/lib/api';

type Mode = 'transfer' | 'share';

function formatDate(value?: string | null): string {
  if (!value) return 'Date TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getReturnPath(pathname: string, token?: string): string {
  if (!token) return pathname || '/';
  if (pathname.startsWith('/claim')) return `/claim/${encodeURIComponent(token)}`;
  if (pathname.startsWith('/transfer')) return `/transfer/${encodeURIComponent(token)}`;
  return pathname || '/';
}

function normalizePreview(data: any, mode: Mode) {
  const event = mode === 'transfer' ? data?.event || {} : {};
  const title = mode === 'transfer' ? event.title : data?.eventTitle;
  const image =
    mode === 'transfer'
      ? event.posterUrl || event.image || event.coverImage
      : data?.eventImage || data?.posterUrl || data?.image;
  const date = mode === 'transfer' ? event.date || event.startDate : data?.eventDate;
  const location = mode === 'transfer' ? event.location || event.venue : data?.eventLocation;
  const sender = mode === 'transfer' ? data?.senderName : data?.ownerName || data?.userName;
  const availableSlots = Number(
    data?.availableSlots ?? data?.remainingSlots ?? data?.quantity ?? 1,
  );
  const totalSlots = Number(data?.totalSlots ?? data?.quantity ?? availableSlots);
  const genderRequirement = String(data?.genderRequirement || 'any').toLowerCase();
  const ticketName =
    data?.tierName ||
    data?.ticketName ||
    (data?.isCouple ? 'Couple Entry' : mode === 'transfer' ? 'Transferred Ticket' : 'Event Ticket');

  return {
    title: title || 'THE C1RCLE Event',
    image,
    date: formatDate(date),
    location: location || 'Venue TBA',
    sender: sender || 'Your host',
    availableSlots,
    totalSlots,
    genderRequirement,
    ticketName,
    isCouple: Boolean(data?.isCouple),
    expiresAt: data?.expiresAt ? formatDate(data.expiresAt) : null,
    status: data?.status || 'active',
  };
}

export default function ClaimOrTransferScreen() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, initialized } = useAuthStore();
  const { fetchUserOrders } = useTicketsStore();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('share');
  const [claimed, setClaimed] = useState(false);

  const loadCountRef = useRef(0);
  const pathToken = params.token;
  const queryCode = params.code;
  const candidate = queryCode || pathToken;

  useEffect(() => {
    if (!initialized) return;
    void loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, pathToken, queryCode]);

  const preview = useMemo(() => normalizePreview(data, mode), [data, mode]);
  const hasFatalPreviewError = Boolean(error && !data);
  const isUnavailable =
    preview.status !== 'active' || preview.availableSlots <= 0 || hasFatalPreviewError;

  const loadDetails = async () => {
    const loadId = ++loadCountRef.current;
    setLoading(true);
    setError(null);
    setData(null);
    setClaimed(false);

    if (!candidate) {
      setError('This claim link is missing its code.');
      setLoading(false);
      return;
    }

    try {
      if (queryCode) {
        setMode('transfer');
        const res = await getTransferDetails(queryCode);
        if (loadId !== loadCountRef.current) return;
        if (res?.success) setData(res.transfer ?? res);
        else setError(res?.error || 'This transfer link is no longer valid.');
        return;
      }

      if (pathname.startsWith('/claim')) {
        setMode('share');
        const shareRes = await getShareBundle(candidate);
        if (loadId !== loadCountRef.current) return;
        if (shareRes?.success) {
          setData(shareRes.bundle ?? shareRes);
          return;
        }
        setError(shareRes?.error || 'This claim link is no longer valid.');
        return;
      }

      setMode('transfer');
      const transferRes = await getTransferDetails(candidate);
      if (loadId !== loadCountRef.current) return;
      if (transferRes?.success) setData(transferRes.transfer ?? transferRes);
      else setError(transferRes?.error || 'This transfer link is no longer valid.');
    } catch (e: any) {
      if (loadId === loadCountRef.current) {
        setError(e?.message || 'Failed to load ticket details.');
      }
    } finally {
      if (loadId === loadCountRef.current) {
        setLoading(false);
      }
    }
  };

  const handleAction = async () => {
    if (!candidate) return;

    if (!user) {
      router.push({
        pathname: '/(auth)/login',
        params: { returnTo: getReturnPath(pathname, candidate) },
      });
      return;
    }

    setActionLoading(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res =
        mode === 'transfer'
          ? await acceptFormalTransfer({ transferCode: candidate })
          : await claimShareTicket(candidate);

      if (res?.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchUserOrders();
        setClaimed(true);
        return;
      }

      const errMsg =
        res?.error ||
        (mode === 'transfer' ? 'Failed to accept transfer.' : 'Failed to claim ticket.');
      if (errMsg.includes('already been claimed') || errMsg.includes('already been accepted')) {
        await fetchUserOrders();
        setClaimed(true);
        return;
      }
      setError(errMsg);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.iris} />
        <Text style={styles.loadingText}>Opening claim link...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#050506' }]}>
      <ScrollView
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/(tabs)/explore')} style={styles.iconButton}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(80)} style={styles.posterShell}>
          {preview.image ? (
            <Image
              source={{ uri: preview.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <LinearGradient colors={['#341610', '#111']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.62)', '#050506']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.posterCopy}>
            <Text style={styles.inviteText}>{preview.sender} invited you</Text>
            <Text style={styles.eventTitle}>{preview.title}</Text>
            <Text style={styles.eventMeta}>{preview.date}</Text>
            <Text style={styles.eventMeta}>{preview.location}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(160)} style={styles.claimPanel}>
          {claimed ? (
            <View style={styles.successBlock}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={38} color="#050506" />
              </View>
              <Text style={styles.panelTitle}>You're in</Text>
              <Text style={styles.panelText}>Your ticket has been added to your Tickets tab.</Text>
            </View>
          ) : (
            <>
              <View style={styles.ticketSummaryRow}>
                <View>
                  <Text style={styles.panelEyebrow}>
                    {mode === 'transfer' ? 'Ticket transfer' : 'Group claim link'}
                  </Text>
                  <Text style={styles.panelTitle}>{preview.ticketName}</Text>
                </View>
                <View style={styles.remainingBadge}>
                  <Text style={styles.remainingNumber}>{Math.max(preview.availableSlots, 0)}</Text>
                  <Text style={styles.remainingLabel}>left</Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                {preview.isCouple ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="people" size={15} color="#fff" />
                    <Text style={styles.infoBadgeText}>Couple</Text>
                  </View>
                ) : null}
                {preview.genderRequirement && preview.genderRequirement !== 'any' ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="person" size={15} color="#fff" />
                    <Text style={styles.infoBadgeText}>
                      {preview.genderRequirement.toUpperCase()} only
                    </Text>
                  </View>
                ) : null}
                {preview.expiresAt ? (
                  <View style={styles.infoBadge}>
                    <Ionicons name="time" size={15} color="#fff" />
                    <Text style={styles.infoBadgeText}>Until {preview.expiresAt}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.panelText}>
                Tap claim and we will assign you one eligible ticket from this link. Your ticket
                will appear in your own wallet only.
              </Text>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}

          {claimed ? (
            <Pressable
              onPress={() => router.replace('/(tabs)/tickets')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>View My Ticket</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleAction}
              disabled={actionLoading || isUnavailable}
              style={[
                styles.primaryButton,
                (actionLoading || isUnavailable) && styles.primaryButtonDisabled,
              ]}
            >
              {actionLoading ? (
                <ActivityIndicator color="#050506" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {!user
                    ? 'Log in to claim'
                    : isUnavailable
                      ? 'No tickets left'
                      : 'Claim my ticket'}
                </Text>
              )}
            </Pressable>
          )}

          {!claimed ? (
            <Pressable
              onPress={() => router.replace('/(tabs)/explore')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.58)',
    marginTop: 14,
    fontSize: 14,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  posterShell: {
    minHeight: 410,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#111',
  },
  posterCopy: {
    padding: 22,
  },
  inviteText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  eventMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  claimPanel: {
    marginTop: 16,
    borderRadius: 26,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ticketSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  panelEyebrow: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  panelText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
  },
  remainingBadge: {
    minWidth: 66,
    minHeight: 66,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,74,34,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.38)',
  },
  remainingNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  remainingLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    backgroundColor: 'rgba(255,61,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,113,0.25)',
  },
  errorText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  successIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D68F',
    marginBottom: 18,
  },
  primaryButton: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: '#fff',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#050506',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 15,
    fontWeight: '700',
  },
});

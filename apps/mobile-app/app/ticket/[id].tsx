import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ActionSheet,
  ShareSheetContent,
  TransferSheetContent,
} from '@/components/tickets/TicketActionSheets';
import { colors, gradients, radii } from '@/lib/design/theme';
import {
  API_BASE,
  cancelFormalTransfer,
  cancelShareBundle,
  createShareBundle,
  getPendingFormalTransfers,
  getTicketShares,
  initiateFormalTransfer,
  reclaimSharedTicket,
} from '@/lib/api';
import { track, trackScreen, AnalyticsEvents } from '@/lib/analytics';
import { shareEventLink } from '@/lib/deeplinks';
import { addToWallet, isWalletAvailable, type PassData } from '@/lib/wallet';
import { safeDate, formatEventTime } from '@/lib/utils/date';
import { type Order, type OrderTicket, useTicketsStore } from '@/store/ticketsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { buildCalendarEventUrl } from '@/lib/calendar';

type ActiveSheet = 'share' | 'transfer' | null;

function formatDateLabel(order: Order): string {
  const date = safeDate(order.eventStartDate || order.eventDate);
  if (!date) return order.eventDate || 'Date TBA';

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${month} ${day} at ${time}`;
}

function flattenTickets(tickets: OrderTicket[]) {
  return tickets.flatMap((ticket, index) =>
    Array.from({ length: Math.max(ticket.quantity || 1, 1) }, (_, slotIndex) => ({
      ...ticket,
      rowId: `${ticket.ticketId || ticket.tierId || index}-${slotIndex}`,
      slotIndex,
    })),
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { getOrderById, fetchUserOrders } = useTicketsStore();
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [activeQrIndex, setActiveQrIndex] = useState(0);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [ticketShares, setTicketShares] = useState<any[]>([]);

  useEffect(() => {
    trackScreen('Ticket Detail');
    void isWalletAvailable().then(setWalletAvailable);
  }, []);

  useEffect(() => {
    if (!id) return;
    void loadAll(id);
  }, [id]);

  useEffect(() => {
    if (!showQr || !order?.userId || !id) return;
    const refreshTimer = setInterval(() => {
      void refreshWallet();
    }, 45_000);
    return () => clearInterval(refreshTimer);
  }, [id, order?.userId, showQr]);

  const loadAll = async (orderId: string) => {
    setLoading(true);
    try {
      const loadedOrder = await getOrderById(orderId);
      setOrder(loadedOrder);

      const [transfersRes, sharesRes] = await Promise.all([
        getPendingFormalTransfers().catch(() => null),
        getTicketShares(orderId).catch(() => null),
      ]);

      const relevantTransfers = (transfersRes?.transfers || []).filter((transfer: any) => {
        if (!loadedOrder) return false;
        return transfer.ticketId?.startsWith?.(orderId) || transfer.eventId === loadedOrder.eventId;
      });

      setPendingTransfers(relevantTransfers);
      setTicketShares(sharesRes?.bundles || []);

      if (loadedOrder) {
        track(AnalyticsEvents.TICKET_VIEW, {
          orderId: loadedOrder.id,
          eventId: loadedOrder.eventId,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshWallet = async () => {
    if (!order?.userId) return;
    await fetchUserOrders(order.userId);
    if (id) await loadAll(id);
  };

  const qrCodes = order?.qrCodes?.length
    ? order.qrCodes
    : [
        {
          ticketId: order?.id || 'ticket',
          ticketIndex: 0,
          qrCode: order?.qrData || order?.id || 'ticket',
          isUsed: false,
        },
      ];
  const activeQr = qrCodes[Math.min(activeQrIndex, Math.max(qrCodes.length - 1, 0))];
  const flattenedTickets = useMemo(() => (order ? flattenTickets(order.tickets) : []), [order]);
  const dateLabel = order ? formatDateLabel(order) : '';
  const calendarUrl = buildCalendarEventUrl({
    title: order?.eventTitle || 'THE C1RCLE Event',
    startDate: order?.eventStartDate || order?.eventDate,
    location: order?.venueLocation,
    description: order?.tickets
      ?.map((ticket) => `${ticket.tierName} x${ticket.quantity}`)
      .join(', '),
  });

  const accentColor =
    (order as any)?.posterAccentColor ||
    (order as any)?.dominantColor ||
    (order as any)?.eventAccentColor ||
    (order?.accentColor && order.accentColor.toUpperCase() !== colors.iris.toUpperCase()
      ? order.accentColor
      : undefined) ||
    '#D915A8';

  const handleAddToWallet = async () => {
    if (!order) return;
    const ticketType = order.tickets[0]?.tierName || 'General Entry';
    const totalTickets = order.tickets.reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);

    const passData: PassData = {
      orderId: order.id,
      eventTitle: order.eventTitle || 'Event',
      eventDate: order.eventStartDate || order.eventDate || '',
      eventTime: formatEventTime(order.eventStartDate || order.eventDate),
      venue: order.venueLocation || 'TBA',
      ticketType,
      ticketCount: totalTickets,
      qrCodeData: activeQr?.qrCode || order.id,
    };

    await addToWallet(passData);
    track(AnalyticsEvents.TICKET_ADD_TO_WALLET, { orderId: order.id });
  };

  const handleShareChannel = async (channel: string, tierId?: string, expiresAt?: string) => {
    if (!order || !tierId) return;

    try {
      const response = await createShareBundle({
        orderId: order.id,
        eventId: order.eventId,
        quantity: 1,
        tierId,
        expiresAt,
      });

      if (!response?.success || !response.bundle?.token) {
        Alert.alert('Share failed', response?.error || 'Unable to create a share link.');
        return;
      }

      const claimUrl = `${API_BASE}/tickets/claim/${response.bundle.token}`;
      const message = `Ticket for ${order.eventTitle || 'The C1RCLE'}\n\nClaim it here: ${claimUrl}`;

      if (channel === 'copy') {
        await Clipboard.setStringAsync(claimUrl);
        Alert.alert('Copied', 'Claim link copied to your clipboard.');
      } else if (channel === 'whatsapp') {
        const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
        else Alert.alert('WhatsApp unavailable', 'WhatsApp is not installed on this device.');
      } else if (channel === 'instagram') {
        await Clipboard.setStringAsync(message);
        Alert.alert('Copied', 'The message was copied. Paste it into Instagram DM.');
      } else if (channel === 'sms') {
        const separator = Platform.OS === 'ios' ? '&' : '?';
        await Linking.openURL(`sms:${separator}body=${encodeURIComponent(message)}`);
      } else if (channel === 'email') {
        await Linking.openURL(
          `mailto:?subject=${encodeURIComponent(`Ticket for ${order.eventTitle || 'The C1RCLE'}`)}&body=${encodeURIComponent(message)}`,
        );
      } else {
        await Share.share({ message });
      }

      track('ticket_share_bundle_created', { orderId: order.id, tierId, channel });
      setActiveSheet(null);
      await refreshWallet();
    } catch (error: any) {
      Alert.alert('Share failed', error?.message || 'Unable to share this ticket.');
    }
  };

  const handleTransferEmail = async (email: string) => {
    if (!order) return;
    const claimedTicket = order.tickets.find((ticket) => ticket.isClaimed && ticket.ticketId);
    if (!claimedTicket?.ticketId) {
      Alert.alert('No transferable ticket', 'Only claimed tickets can be transferred.');
      return;
    }

    let response: any;
    try {
      response = await initiateFormalTransfer({
        ticketId: claimedTicket.ticketId,
        recipientEmail: email,
      });
    } catch (error: any) {
      if (error.code === 'PREMIUM_REQUIRED') {
        openPaywall('ticketTransfers', error.message);
        return;
      }
      Alert.alert('Transfer failed', error.message || 'Unable to start the transfer.');
      return;
    }
    if (!response?.success) {
      Alert.alert('Transfer failed', response?.error || 'Unable to start the transfer.');
      return;
    }

    track(AnalyticsEvents.TICKET_TRANSFER_INITIATED, { orderId: order.id, recipientEmail: email });
    Alert.alert('Transfer sent', `An invitation has been sent to ${email}.`);
    setActiveSheet(null);
    await refreshWallet();
  };

  const handleGenerateTransferLink = async () => {
    if (!order) return;
    const claimedTicket = order.tickets.find((ticket) => ticket.isClaimed && ticket.ticketId);
    if (!claimedTicket?.ticketId) {
      Alert.alert('No transferable ticket', 'Only claimed tickets can be transferred.');
      return;
    }

    let response: any;
    try {
      response = await initiateFormalTransfer({ ticketId: claimedTicket.ticketId });
    } catch (error: any) {
      if (error.code === 'PREMIUM_REQUIRED') {
        openPaywall('ticketTransfers', error.message);
        return;
      }
      Alert.alert('Transfer failed', error.message || 'Unable to generate a transfer link.');
      return;
    }
    const token = response?.transfer?.token || response?.transferCode || response?.code;
    if (!response?.success || !token) {
      Alert.alert('Transfer failed', response?.error || 'Unable to generate a transfer link.');
      return;
    }

    const transferUrl = `${API_BASE}/transfer/${token}`;
    await Clipboard.setStringAsync(transferUrl);
    Alert.alert('Copied', 'Transfer link copied to your clipboard.');
    setActiveSheet(null);
    await refreshWallet();
  };

  const confirmCancelTransfer = (transferId: string) => {
    Alert.alert(
      'Cancel transfer',
      'This restores your ticket access and invalidates the transfer.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel transfer',
          style: 'destructive',
          onPress: async () => {
            const response = await cancelFormalTransfer({ transferId });
            if (!response?.success) {
              Alert.alert('Unable to cancel', response?.error || 'Transfer cancellation failed.');
              return;
            }
            await refreshWallet();
          },
        },
      ],
    );
  };

  const confirmCancelBundle = (bundleId: string) => {
    Alert.alert(
      'Cancel share link',
      'This invalidates the active share link and reclaims any unclaimed tickets.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel share',
          style: 'destructive',
          onPress: async () => {
            const response = await cancelShareBundle({ bundleId });
            if (!response?.success) {
              Alert.alert('Unable to cancel', response?.error || 'Share cancellation failed.');
              return;
            }
            await refreshWallet();
          },
        },
      ],
    );
  };

  const reclaimSlot = (bundleId: string, slotIndex: number) => {
    Alert.alert('Reclaim shared ticket', 'This removes one ticket from the active share link.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Reclaim',
        style: 'destructive',
        onPress: async () => {
          const response = await reclaimSharedTicket({ bundleId, slotIndex });
          if (!response?.success) {
            Alert.alert('Unable to reclaim', response?.error || 'Reclaim failed.');
            return;
          }
          await refreshWallet();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.iris} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Ticket not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <View style={styles.hero}>
          {order.eventCoverImage ? (
            <Image
              source={{ uri: order.eventCoverImage }}
              style={styles.heroImage}
              contentFit="cover"
            />
          ) : (
            <LinearGradient colors={['#2A1A0E', '#161616']} style={styles.heroImage} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)', '#161616']}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.topBarButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() =>
                order.eventId && shareEventLink(order.eventId, order.eventTitle || 'Event')
              }
              style={styles.topBarButton}
            >
              <Ionicons name="share-social-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>{order.hostName || 'THE C1RCLE'}</Text>
            <Text style={styles.heroTitle}>{order.eventTitle || 'Event'}</Text>
            <Text style={styles.heroMeta}>{dateLabel}</Text>
            {order.venueLocation ? (
              <Text style={styles.heroMeta}>{order.venueLocation}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(60)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Entry QR</Text>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowQr((current) => !current);
                }}
                style={styles.secondaryPill}
              >
                <Text style={styles.secondaryPillText}>{showQr ? 'Hide QR' : 'Show QR'}</Text>
              </Pressable>
            </View>

            {showQr ? (
              <View style={styles.qrBlock}>
                <View style={[styles.qrSurface, { backgroundColor: accentColor }]}>
                  <QRCode
                    value={activeQr.qrCode}
                    size={180}
                    color="#161616"
                    backgroundColor="transparent"
                  />
                </View>
                <Text style={styles.qrLabel}>
                  {activeQr.isUsed ? 'Scanned' : 'Ready to scan'} · {activeQr.ticketId}
                </Text>
                {qrCodes.length > 1 ? (
                  <View style={styles.qrPager}>
                    <Pressable
                      onPress={() =>
                        setActiveQrIndex(
                          (current) => (current - 1 + qrCodes.length) % qrCodes.length,
                        )
                      }
                      style={styles.qrPagerButton}
                    >
                      <Ionicons name="chevron-back" size={18} color="#fff" />
                    </Pressable>
                    <Text style={styles.qrPagerText}>
                      {activeQrIndex + 1} / {qrCodes.length}
                    </Text>
                    <Pressable
                      onPress={() => setActiveQrIndex((current) => (current + 1) % qrCodes.length)}
                      style={styles.qrPagerButton}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.cardBodyText}>
                Reveal the QR when you are at the door. Each active ticket can be scanned once.
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90)} style={styles.actionGrid}>
            <Pressable
              onPress={() =>
                order.eventId &&
                router.push({ pathname: '/event/[id]', params: { id: order.eventId } })
              }
              style={styles.actionCard}
            >
              <Ionicons name="sparkles-outline" size={18} color={colors.iris} />
              <Text style={styles.actionCardText}>View Event</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `maps://search?q=${encodeURIComponent(order.venueLocation || order.eventTitle || 'Event')}`,
                )
              }
              style={styles.actionCard}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.iris} />
              <Text style={styles.actionCardText}>Directions</Text>
            </Pressable>
            {calendarUrl ? (
              <Pressable onPress={() => Linking.openURL(calendarUrl)} style={styles.actionCard}>
                <Ionicons name="calendar-outline" size={18} color={colors.iris} />
                <Text style={styles.actionCardText}>Calendar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                router.push({ pathname: '/checkout/success', params: { orderId: order.id } } as any)
              }
              style={styles.actionCard}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.iris} />
              <Text style={styles.actionCardText}>Confirmation</Text>
            </Pressable>
            {walletAvailable ? (
              <Pressable onPress={() => void handleAddToWallet()} style={styles.actionCard}>
                <Ionicons name="wallet-outline" size={18} color={colors.iris} />
                <Text style={styles.actionCardText}>Wallet</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Share and Transfer</Text>
            </View>
            <View style={styles.primaryActions}>
              <Pressable onPress={() => setActiveSheet('share')} style={styles.primaryAction}>
                <LinearGradient
                  colors={gradients.primary as [string, string]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.primaryActionText}>Share Unclaimed Ticket</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveSheet('transfer')}
                style={[styles.primaryAction, styles.primaryActionAlt]}
              >
                <Text style={styles.primaryActionAltText}>Transfer Claimed Ticket</Text>
              </Pressable>
            </View>
          </Animated.View>

          {pendingTransfers.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(150)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Pending Transfers</Text>
              </View>
              {pendingTransfers.map((transfer) => (
                <View key={transfer.id} style={styles.statusRow}>
                  <View style={styles.statusCopy}>
                    <Text style={styles.statusTitle}>
                      {transfer.ticketName || transfer.ticketId || 'Ticket transfer'}
                    </Text>
                    <Text style={styles.statusMeta}>
                      Waiting on {transfer.recipientEmail || 'recipient'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => confirmCancelTransfer(transfer.id)}
                    style={styles.statusButton}
                  >
                    <Text style={styles.statusButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {ticketShares.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(180)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Active Share Links</Text>
              </View>
              {ticketShares.map((bundle: any) => (
                <View key={bundle.id} style={styles.bundleCard}>
                  <View style={styles.bundleHeader}>
                    <View>
                      <Text style={styles.statusTitle}>
                        {bundle.ticketName || bundle.tierName || 'Shared ticket'}
                      </Text>
                      <Text style={styles.statusMeta}>
                        {bundle.slots?.filter((slot: any) => slot.claimStatus === 'unclaimed')
                          .length || 0}{' '}
                        unclaimed left
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => confirmCancelBundle(bundle.id)}
                      style={styles.statusButton}
                    >
                      <Text style={styles.statusButtonText}>Cancel Link</Text>
                    </Pressable>
                  </View>
                  {(bundle.slots || [])
                    .filter((slot: any) => slot.claimStatus === 'unclaimed')
                    .map((slot: any) => (
                      <View key={`${bundle.id}-${slot.slotIndex}`} style={styles.slotRow}>
                        <Text style={styles.slotLabel}>Slot {slot.slotIndex}</Text>
                        <Pressable
                          onPress={() => reclaimSlot(bundle.id, slot.slotIndex)}
                          style={styles.slotButton}
                        >
                          <Text style={styles.slotButtonText}>Reclaim</Text>
                        </Pressable>
                      </View>
                    ))}
                </View>
              ))}
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(210)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Ticket Roster</Text>
            </View>
            {flattenedTickets.map((ticket) => {
              const pendingTransfer = pendingTransfers.find(
                (transfer) => transfer.ticketId === ticket.ticketId,
              );
              const activeBundle = ticketShares.find(
                (bundle: any) =>
                  bundle.tierId === ticket.ticketId || bundle.tierId === ticket.tierId,
              );
              const claimName =
                ticket.claimedBy?.name ||
                ticket.claimedBy?.email ||
                (ticket.isClaimed ? 'Claimed' : activeBundle ? 'Shared via link' : 'Unclaimed');

              return (
                <View key={ticket.rowId} style={styles.rosterRow}>
                  <View style={styles.rosterAvatar}>
                    <Text style={styles.rosterAvatarText}>
                      {(claimName || 'U').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rosterCopy}>
                    <Text style={styles.rosterName}>{claimName}</Text>
                    <Text style={styles.rosterMeta}>
                      {ticket.tierName}
                      {ticket.requiredGender ? ` · ${ticket.requiredGender.toUpperCase()}` : ''}
                      {ticket.receivedFrom ? ` · From ${ticket.receivedFrom}` : ''}
                    </Text>
                    {pendingTransfer ? (
                      <Text style={styles.pendingText}>Transfer pending</Text>
                    ) : null}
                    {!pendingTransfer && activeBundle ? (
                      <Text style={styles.pendingText}>Active share link</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Breakdown</Text>
            </View>
            {order.tickets.map((ticket, index) => (
              <View
                key={`${ticket.ticketId || ticket.tierId || index}`}
                style={styles.breakdownRow}
              >
                <Text style={styles.breakdownLabel}>
                  {ticket.tierName || 'Ticket'} x{ticket.quantity}
                </Text>
                <Text style={styles.breakdownValue}>
                  {ticket.price > 0
                    ? `INR ${(ticket.price * ticket.quantity).toLocaleString('en-IN')}`
                    : 'Free'}
                </Text>
              </View>
            ))}
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotal}>Total</Text>
              <Text style={styles.breakdownTotal}>
                {order.totalAmount > 0
                  ? `INR ${order.totalAmount.toLocaleString('en-IN')}`
                  : 'Free'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      <ActionSheet
        isVisible={activeSheet === 'share'}
        onClose={() => setActiveSheet(null)}
        title="Share Ticket"
        description="Create a claim link for an unclaimed ticket from this order."
      >
        <ShareSheetContent tickets={order.tickets} onShare={handleShareChannel} />
      </ActionSheet>

      <ActionSheet
        isVisible={activeSheet === 'transfer'}
        onClose={() => setActiveSheet(null)}
        title="Transfer Ticket"
        description="Transfer ownership of a claimed ticket by email or shareable link."
      >
        <TransferSheetContent
          genderRestriction={order.tickets.find((ticket) => ticket.isClaimed)?.requiredGender}
          onTransferEmail={handleTransferEmail}
          onGenerateLink={handleGenerateTransferLink}
        />
      </ActionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    height: 380,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroCopy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
  },
  heroKicker: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    marginTop: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryPillText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
  },
  cardBodyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  qrBlock: {
    alignItems: 'center',
  },
  qrSurface: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  qrLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 14,
  },
  qrPager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  qrPagerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  qrPagerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48%',
    minHeight: 82,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionCardText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActions: {
    gap: 10,
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryActionAlt: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryActionAltText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  statusCopy: {
    flex: 1,
    marginRight: 16,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  statusButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  bundleCard: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  slotLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
  },
  slotButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(244,74,34,0.18)',
  },
  slotButtonText: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '700',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  rosterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  rosterAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  rosterCopy: {
    flex: 1,
  },
  rosterName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  rosterMeta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    marginTop: 4,
  },
  pendingText: {
    color: colors.iris,
    fontSize: 12,
    marginTop: 5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
  },
  breakdownValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 8,
  },
  breakdownTotal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  backButton: {
    marginTop: 16,
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

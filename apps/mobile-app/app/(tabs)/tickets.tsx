import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/lib/api';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  StyleSheet,
  Linking,
  useWindowDimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTicketsStore, Order } from '@/store/ticketsStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useCartStore } from '@/store/cartStore';
import { cacheUserOrders, getCachedUserOrders } from '@/lib/cache';
import { shareEventLink } from '@/lib/deeplinks';
import { addToWallet, PassData } from '@/lib/wallet';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { colors, radii, gradients, typography } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ErrorState, NetworkError } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { safeDate, formatEventDate, formatEventTime } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';
import { buildCalendarEventUrl } from '@/lib/calendar';
import {
  Wallet,
  ChevronLeft,
  Menu,
  Ticket as TicketIcon,
  Info,
  ArrowRightCircle,
  CalendarDays,
  CreditCard,
  MapPin,
  ScanLine,
} from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const TICKET_FILTER_WIDTH = 204;
const TICKET_FILTER_HEIGHT = 43;
const TICKET_FILTER_PADDING = 4;
const TICKET_FILTER_THUMB_WIDTH = (TICKET_FILTER_WIDTH - TICKET_FILTER_PADDING * 2) / 2;
const ticketFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

// iOS-style action row for ticket detail sheet — now with inline styles to avoid fast-refresh initialization issues
function ActionRow({
  icon: IconComp,
  label,
  onPress,
  danger,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={ms.actionRow}
    >
      <Text style={[ms.actionRowText, danger && { color: colors.error }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={ms.actionRowIcon}>
        <IconComp size={30} color={danger ? colors.error : '#fff'} strokeWidth={1.9} />
      </View>
    </Pressable>
  );
}

function hexWithAlpha(color: string | undefined, alpha: string, fallback: string) {
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return fallback;
  return `${color}${alpha}`;
}

// Ticket Detail Sheet — Posh-style with poster flip + QR
function QRModal({
  visible,
  order,
  onClose,
}: {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}) {
  const [showQR, setShowQR] = useState(false);
  const flipProgress = useSharedValue(0);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      setShowQR(false);
      flipProgress.value = 0;
    }
  }, [visible]);

  // Front side (poster) — hides when rotated past 90°
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flipProgress.value * 180}deg` }],
    backfaceVisibility: 'hidden' as const,
    opacity: flipProgress.value > 0.5 ? 0 : 1,
  }));

  // Back side (full QR) — starts at -180° and rotates to 0°
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flipProgress.value * 180 - 180}deg` }],
    backfaceVisibility: 'hidden' as const,
    opacity: flipProgress.value > 0.5 ? 1 : 0,
  }));

  if (!order) return null;

  const qrData = (order as any).qrData || order.id;
  const totalGuests = (order as any).totalGuests ?? 0;
  const totalRevenue = (order as any).totalRevenue ?? 0;
  const ticketType = order.tickets?.[0]?.tierName || 'General Entry';
  const rawHostName = String((order as any).promoterName || (order as any).hostName || 'C1RCLE');
  const posterHostName = rawHostName.length > 14 ? 'C1RCLE' : rawHostName;
  const dateStr = (() => {
    const d = safeDate(order.eventDate);
    if (!d) return '';
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const suffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1:
          return 'st';
        case 2:
          return 'nd';
        case 3:
          return 'rd';
        default:
          return 'th';
      }
    };
    const hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const minutes = d.getMinutes();
    const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
    return `${month} ${day}${suffix(day)} at ${displayHours}${displayMinutes}${ampm}`;
  })();
  const shortId = order.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  const calendarUrl = buildCalendarEventUrl({
    title: order.eventTitle || 'THE C1RCLE Event',
    startDate: order.eventStartDate || order.eventDate,
    location: order.venueLocation,
    description: `${ticketType} · ${totalGuests} ticket${totalGuests > 1 ? 's' : ''}`,
  });

  // Prefer poster-specific colors; brand orange is a weak fallback for this shelf.
  const accentColor =
    (order as any).posterAccentColor ||
    (order as any).dominantColor ||
    (order as any).eventAccentColor ||
    (order.accentColor && order.accentColor.toUpperCase() !== colors.iris.toUpperCase()
      ? order.accentColor
      : undefined) ||
    '#D915A8';
  const posterSize = Math.min(width - 48, 300, Math.max(260, height * 0.32));
  const miniQrSize = Math.max(126, Math.min(162, posterSize * 0.38));
  const miniQrPadding = 12;
  const fullQrSize = Math.max(220, Math.min(280, posterSize * 0.64));

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !showQR;
    setShowQR(next);
    flipProgress.value = withTiming(next ? 1 : 0, { duration: 500 });
  };

  const handleTransfer = () => {
    onClose();
    router.push({ pathname: '/transfer', params: { orderId: order.id, ticketName: ticketType } });
  };

  const handleAddToWallet = async () => {
    const passData: PassData = {
      orderId: order.id,
      eventTitle: order.eventTitle || 'Event',
      eventDate: order.eventDate || '',
      eventTime: formatEventTime(order.eventDate),
      venue: order.venueLocation || 'TBA',
      ticketType,
      ticketCount: totalGuests,
      qrCodeData: order.id,
    };
    await addToWallet(passData);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            ms.container,
            {
              flex: 0,
              height: '87%',
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              overflow: 'hidden',
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(8,8,10,0.98)',
              hexWithAlpha(accentColor, '24', 'rgba(217, 21, 168, 0.14)'),
              'rgba(5,5,6,1)',
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={ms.safeArea} edges={['left', 'right', 'bottom']}>
            {/* Header */}
            <View style={ms.header}>
              <Pressable onPress={onClose} style={ms.headerBtn}>
                <Text style={ms.headerCancelText}>Cancel</Text>
              </Pressable>
              <Text style={ms.headerTitle}>Your Order</Text>

              <Pressable onPress={onClose} style={[ms.headerBtn, { alignItems: 'flex-end' }]}>
                <Text style={ms.headerDoneText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={ms.scrollContent}
              bounces={false}
              overScrollMode="never"
            >
              {/* ─── Flip Card ─── */}
              <View style={[ms.flipContainer, { width: posterSize, height: posterSize }]}>
                {/* FRONT: Poster with small QR */}
                <Animated.View style={[ms.cardFace, frontStyle]}>
                  {order.eventCoverImage ? (
                    <>
                      <Image
                        source={{ uri: order.eventCoverImage }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: 'rgba(0, 0, 0, 0.25)' },
                        ]}
                      />
                    </>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: accentColor }]} />
                  )}

                  {/* Clean Event Name & Ticket Quantity overlay */}

                  <View style={{ position: 'absolute', bottom: 24, right: 24 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ticketFont.bold,
                          fontSize: 13,
                          fontWeight: '700',
                          color: '#fff',
                        }}
                      >
                        {totalGuests}x
                      </Text>
                      <TicketIcon size={14} color="#fff" />
                    </View>
                  </View>

                  {/* Centered mini QR in accent color */}
                  <View style={ms.miniQrWrap}>
                    <View
                      style={[
                        ms.miniQrContainer,
                        {
                          backgroundColor: accentColor,
                          padding: miniQrPadding,
                          borderRadius: miniQrPadding + 12,
                          elevation: 0,
                          shadowOpacity: 0,
                        },
                      ]}
                    >
                      <QRCode
                        value={qrData}
                        size={miniQrSize}
                        color="#161616"
                        backgroundColor="transparent"
                      />
                    </View>
                  </View>

                  {/* Side notches */}
                  <View style={ms.notchLeft} />
                  <View style={ms.notchRight} />
                </Animated.View>

                {/* BACK: Full QR code */}
                <Animated.View
                  style={[ms.cardFace, ms.cardBack, backStyle, { backgroundColor: accentColor }]}
                >
                  <View
                    style={[
                      ms.fullQrWrap,
                      { backgroundColor: accentColor, elevation: 0, shadowOpacity: 0 },
                    ]}
                  >
                    <QRCode
                      value={qrData}
                      size={fullQrSize}
                      color="#161616"
                      backgroundColor="transparent"
                    />
                  </View>

                  {/* Side notches */}
                  <View style={ms.notchLeft} />
                  <View style={ms.notchRight} />
                </Animated.View>
              </View>

              {/* Show QR Code toggle */}
              <Pressable onPress={handleFlip} style={ms.showQrBtn}>
                <ScanLine size={25} color="#fff" strokeWidth={2.1} />
                <Text style={ms.showQrText}>{showQR ? 'Show Poster' : 'Show QR Code'}</Text>
              </Pressable>

              {/* ─── Action Rows ─── */}
              <View style={ms.actionGroup}>
                <ActionRow
                  icon={Info}
                  label="View Event"
                  onPress={() => {
                    onClose();
                    if (order.eventId) {
                      router.push({
                        pathname: '/event/[id]',
                        params: {
                          id: order.eventId,
                        },
                      });
                    }
                  }}
                />
                <View style={ms.actionRowDivider} />
                <ActionRow
                  icon={ArrowRightCircle}
                  label="Transfer Tickets"
                  onPress={handleTransfer}
                />
                <View style={ms.actionRowDivider} />
                <ActionRow
                  icon={TicketIcon}
                  label="View Order Confirmation"
                  onPress={() => {
                    onClose();
                    if (order.eventId) {
                      router.push({
                        pathname: '/event/[id]',
                        params: {
                          id: order.eventId,
                          source: 'ticketShelf',
                          orderId: order.id,
                          eventTitle: order.eventTitle || '',
                          eventDate: order.eventDate || '',
                          eventCoverImage: order.eventCoverImage || '',
                          venueLocation: order.venueLocation || '',
                          hostName: (order as any).hostName || (order as any).promoterName || '',
                          accentColor,
                        },
                      });
                    }
                  }}
                />
                <View style={ms.actionRowDivider} />
                <ActionRow
                  icon={CalendarDays}
                  label="Add to Calendar"
                  onPress={() => {
                    if (calendarUrl) Linking.openURL(calendarUrl);
                  }}
                />
                <View style={ms.actionRowDivider} />
                <ActionRow
                  icon={CreditCard}
                  label="Add to Apple Wallet"
                  onPress={handleAddToWallet}
                />
                <View style={ms.actionRowDivider} />
                <ActionRow
                  icon={MapPin}
                  label="Get Directions"
                  onPress={() => {
                    const venue = order.venueLocation;
                    if (venue) Linking.openURL(`maps://search?q=${encodeURIComponent(venue)}`);
                  }}
                />
              </View>

              {/* ─── Ticket Breakdown ─── */}
              <View style={ms.breakdownCard}>
                <Text style={ms.breakdownTitle}>Ticket Breakdown</Text>
                {order.tickets?.map((t, i) => {
                  const price = t.price ?? 0;
                  const qty = t.quantity ?? 1;
                  return (
                    <View key={i} style={ms.breakdownRow}>
                      <Text style={ms.breakdownLabel}>
                        {t.tierName || 'Ticket'} × {qty}
                      </Text>
                      <Text style={ms.breakdownValue}>
                        {price > 0 ? `₹${(price * qty).toLocaleString('en-IN')}` : 'Free'}
                      </Text>
                    </View>
                  );
                })}
                {(!order.tickets || order.tickets.length === 0) && (
                  <View style={ms.breakdownRow}>
                    <Text style={ms.breakdownLabel}>
                      {ticketType} × {totalGuests || 1}
                    </Text>
                    <Text style={ms.breakdownValue}>
                      {totalRevenue > 0 ? `₹${totalRevenue.toLocaleString('en-IN')}` : 'Free'}
                    </Text>
                  </View>
                )}
                <View style={ms.breakdownDivider} />
                <View style={ms.breakdownRow}>
                  <Text style={ms.breakdownTotalLabel}>Total</Text>
                  <Text style={ms.breakdownTotalValue}>
                    {totalRevenue > 0 ? `₹${totalRevenue.toLocaleString('en-IN')}` : 'Free'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal-specific styles ────────────────────────────────────────────────
const ms = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050506',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 0,
  },
  headerBtn: {
    minWidth: 64,
  },
  headerCancelText: {
    color: 'rgba(239, 238, 249, 0.62)',
    fontFamily: ticketFont.regular,
    fontSize: 18,
    fontWeight: '400',
  },
  headerTitle: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 20,
    fontWeight: '700',
  },
  headerDoneText: {
    color: 'rgba(239, 238, 249, 0.62)',
    fontFamily: ticketFont.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 80,
  },

  // ── Flip Card ──
  flipContainer: {
    aspectRatio: 1.0,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardBack: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Host Text Overlay
  posterHostText: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: '64%',
    color: '#FFFFFF',
    fontFamily: ticketFont.bold,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Top-right event info
  posterTopRight: {
    position: 'absolute',
    top: 20,
    right: 24,
    alignItems: 'flex-end',
    maxWidth: '52%',
  },
  posterTopRightTitle: {
    color: '#FFFFFF',
    fontFamily: ticketFont.black,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  posterTopRightDate: {
    color: 'rgba(255,255,255,0.74)',
    fontFamily: ticketFont.regular,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Mini QR centered on poster
  miniQrWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniQrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  qrCenterLogo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.96)',
  },
  qrCenterLogoText: {
    color: '#FFFFFF',
    fontFamily: ticketFont.black,
    fontSize: 18,
    fontWeight: '900',
  },

  // Card bottom row
  cardBottom: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardOrderId: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: ticketFont.bold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardQtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardQtyText: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: ticketFont.bold,
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Side notches
  notchLeft: {
    position: 'absolute',
    left: -10,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#050506',
  },
  notchRight: {
    position: 'absolute',
    right: -10,
    top: '50%',
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#050506',
  },

  // Full QR back
  fullQrWrap: {
    padding: 22,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  fullQrCenterLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  fullQrLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: ticketFont.bold,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 18,
    letterSpacing: 0,
  },
  fullQrId: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: ticketFont.bold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },

  // Show QR button
  showQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 10,
    marginBottom: 20,
  },
  showQrText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  actionGroup: {
    backgroundColor: '#101114',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  actionRow: {
    minHeight: 54,
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  actionRowText: {
    color: '#FFFFFF',
    flex: 1,
    fontFamily: ticketFont.bold,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  actionRowIcon: {
    width: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 16,
  },
  actionRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  breakdownTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
  },
  breakdownValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  breakdownTotalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownTotalValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

// Full-bleed Boarding-Pass Ticket Card
function TicketCard({
  order,
  onShowQR,
  index,
  onLayout,
}: {
  order: Order;
  onShowQR: () => void;
  index: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const totalGuests = (order as any).totalGuests ?? 0;
  const hostName = (order as any).hostName || (order as any).promoterName || '';

  const [cardWidth, setCardWidth] = useState(350);
  const shimmerProgress = useSharedValue(0);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = shimmerProgress.value * (cardWidth + 200) - 100;
    return {
      transform: [{ translateX }, { skewX: '-25deg' }],
      opacity: shimmerProgress.value > 0 && shimmerProgress.value < 1 ? 1 : 0,
    };
  });

  useEffect(() => {
    const delay = 350 + index * 180;
    const timer = setTimeout(() => {
      shimmerProgress.value = 0;
      shimmerProgress.value = withTiming(1, { duration: 800 });
    }, delay);
    return () => clearTimeout(timer);
  }, [index]);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width);
    if (onLayout) onLayout(event);
  };

  // Format date like "Mar 12th • 5 PM"
  const dateStr = (() => {
    const d = safeDate(order.eventDate);
    if (!d) return '';

    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const time = d
      .toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
      .replace(':00', '');

    // Add ordinal suffix (st, nd, rd, th)
    const suffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1:
          return 'st';
        case 2:
          return 'nd';
        case 3:
          return 'rd';
        default:
          return 'th';
      }
    };

    return `${month} ${day}${suffix(day)} • ${time}`;
  })();

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 70).duration(220)}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 150 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        shimmerProgress.value = 0;
        shimmerProgress.value = withTiming(1, { duration: 650 });
        onShowQR();
      }}
      onLayout={handleCardLayout}
      style={[animatedStyle, styles.ticketCardWrap]}
    >
      <View style={styles.ticketCardInner}>
        {/* Full-bleed event poster */}
        {order.eventCoverImage ? (
          <Image
            source={{ uri: order.eventCoverImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={['#2a1a0e', '#1a0a0a', '#161616']}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Text visibility overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ticket Border Outline (placed behind notches so notches can mask it) */}
        <View style={styles.ticketBorder} collapsable={false}>
          <View style={{ width: 0, height: 0 }} />
        </View>

        {/* Holographic Specular Shimmer Overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 100,
            },
            shimmerStyle,
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0)',
              'rgba(255, 255, 255, 0.04)',
              'rgba(255, 255, 255, 0.28)',
              'rgba(255, 255, 255, 0.04)',
              'rgba(255, 255, 255, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Side notches */}
        <View style={styles.notchLeft} />
        <View style={styles.notchRight} />

        {/* content container */}
        <View style={styles.ticketContent}>
          {/* Top Row: Pill Host */}
          <View style={styles.ticketTopRow}>
            <View style={styles.hostPill}>
              <Text style={styles.hostPillText} numberOfLines={1}>
                {(hostName || 'THE C1RCLE').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Middle: Title & Date */}
          <View style={styles.ticketMiddleInfo}>
            <Text style={styles.ticketLeftTitle} numberOfLines={2}>
              {order.eventTitle}
            </Text>
            <Text style={styles.ticketLeftDate}>{dateStr}</Text>
          </View>

          {/* Bottom Row */}
          <View style={styles.ticketCardBottom}>
            <View />
            <View style={styles.qtyPill}>
              <Text style={styles.qtyPillText}>{totalGuests}x</Text>
              <TicketIcon size={12} color="#fff" />
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

// Countdown Hero — shown when a ticket event is ≤7 days away
function CountdownHero({ order, onViewTicket }: { order: Order; onViewTicket: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  function getLowestPrice(event: any): number {
    return event.minPrice ?? 0;
  }

  useEffect(() => {
    const eventDate = safeDate(order.eventDate);
    if (!eventDate) return;

    const update = () => {
      const diff = eventDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft({ hours, minutes, seconds });
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [order.eventDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.countdownHero}>
      {order.eventCoverImage && (
        <Image
          source={{ uri: order.eventCoverImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
      <LinearGradient
        colors={['rgba(22,22,22,0.3)', 'rgba(22,22,22,0.85)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.countdownContent}>
        <Text style={styles.countdownLabel}>Up next</Text>
        <Text style={styles.countdownTitle} numberOfLines={1}>
          {order.eventTitle}
        </Text>
        <Text style={styles.countdownDate}>{formatEventDate(order.eventDate)}</Text>
        <View style={styles.countdownTimer}>
          {[
            { value: pad(timeLeft.hours), unit: 'HRS' },
            { value: pad(timeLeft.minutes), unit: 'MIN' },
            { value: pad(timeLeft.seconds), unit: 'SEC' },
          ].map((item, i) => (
            <View key={i} style={styles.countdownUnit}>
              <Text style={styles.countdownDigits}>{item.value}</Text>
              <Text style={styles.countdownUnitLabel}>{item.unit}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onViewTicket} style={styles.countdownButton}>
          <LinearGradient
            colors={gradients.primary as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.countdownButtonGradient}
          >
            <Text style={styles.countdownButtonText}>View Ticket</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Animated Segmented Control Header
function SegmentedHeader({
  activeTab,
  setActiveTab,
  upcomingCount,
  pastCount,
}: {
  activeTab: 'upcoming' | 'past';
  setActiveTab: (tab: 'upcoming' | 'past') => void;
  upcomingCount: number;
  pastCount: number;
}) {
  const slideAnim = useSharedValue(activeTab === 'upcoming' ? 0 : 1);
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const avatarPhoto = profile?.photoURL || user?.photoURL || '';
  const avatarInitial = (profile?.displayName || user?.displayName || 'A').charAt(0).toUpperCase();

  const handleTabPress = (tab: 'upcoming' | 'past') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    slideAnim.value = withTiming(tab === 'upcoming' ? 0 : 1, { duration: 250 });
  };

  const animatedBgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value * TICKET_FILTER_THUMB_WIDTH }],
  }));

  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => router.push('/(tabs)/explore')}
        style={[
          styles.headerIconBtn,
          { borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
        ]}
      >
        <Wallet size={24} color="#fff" strokeWidth={2} />
      </Pressable>

      <View style={styles.segmentedContainer}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.segmentedActiveBg, animatedBgStyle]} />
        <Pressable onPress={() => handleTabPress('upcoming')} style={styles.segmentedTab}>
          <Text
            style={[
              styles.segmentedTabText,
              activeTab === 'upcoming' && styles.segmentedTabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable onPress={() => handleTabPress('past')} style={styles.segmentedTab}>
          <Text
            style={[styles.segmentedTabText, activeTab === 'past' && styles.segmentedTabTextActive]}
          >
            Past
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/profile')}
        style={[styles.avatarCircle, { width: 36, height: 36, borderRadius: 18 }]}
      >
        {avatarPhoto ? (
          <Image source={{ uri: avatarPhoto }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <Text style={[styles.avatarInitial, { fontSize: 14 }]}>{avatarInitial}</Text>
        )}
      </Pressable>
    </View>
  );
}

function getOrderGroupLabel(order: Order): string {
  const date = safeDate(order.eventDate || order.eventStartDate || order.createdAt);
  if (!date) {
    return 'Flexible Plans';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default function TicketsScreen() {
  const { orders: storeOrders, loading: storeLoading, error, fetchUserOrders } = useTicketsStore();
  const { user } = useAuthStore();
  const stats = (user as any)?.stats ?? {};
  const kpiActiveLinks = stats.activeLinks ?? 0;
  const kpiClicks = stats.totalClicks ?? 0;
  const kpiSales = stats.totalSales ?? 0;
  const kpiEarnings = stats.totalEarnings ?? 0;

  // React Query: primary data source for orders (gateway-backed, cached 5min)
  const ordersQuery = useQuery({
    queryKey: ['my-orders', user?.uid],
    queryFn: getOrders,
    enabled: Boolean(user?.uid),
    staleTime: 5 * 60 * 1000,
  });
  const pendingReservation = useCartStore((state) => state.pendingReservation);
  const pendingPaymentOrderId = useCartStore((state) => state.pendingPaymentOrderId);
  const clearPendingReservation = useCartStore((state) => state.clearPendingReservation);
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    trackScreen('Tickets');
    loadData();
  }, [user?.uid]);

  const loadData = async () => {
    if (!user?.uid) return;

    const cached = await getCachedUserOrders();
    if (cached.data && cached.data.length > 0) {
      setCachedOrders(cached.data);
    }

    try {
      // Prefer React Query (HTTP gateway) — falls back to Firestore store on error
      const result = await ordersQuery.refetch();
      if (result.data?.orders && result.data.orders.length > 0) {
        await cacheUserOrders(result.data.orders as any);
        setIsOffline(false);
      } else {
        await fetchUserOrders(user.uid);
        const store = useTicketsStore.getState();
        if (store.orders.length > 0) {
          await cacheUserOrders(store.orders);
          setIsOffline(false);
        }
      }
    } catch (err) {
      setIsOffline(true);
    }
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  // React Query data is preferred; fall back to Zustand store (Firestore) then AsyncStorage cache
  const gatewayOrders = (ordersQuery.data?.orders ?? []) as Order[];
  const orders = gatewayOrders.length > 0 ? gatewayOrders : storeOrders;
  const loading = ordersQuery.isFetching || storeLoading;
  const displayOrders = orders.length > 0 ? orders : cachedOrders;
  const nowMs = Date.now();

  // Find the soonest upcoming event within 7 days for CountdownHero
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const nextEvent =
    displayOrders
      .filter((o) => {
        const t = safeDate(o.eventDate)?.getTime() ?? 0;
        return t > nowMs && t <= nowMs + sevenDaysMs;
      })
      .sort(
        (a, b) => (safeDate(a.eventDate)?.getTime() ?? 0) - (safeDate(b.eventDate)?.getTime() ?? 0),
      )[0] ?? null;
  const upcomingOrders = displayOrders.filter((o) => {
    if (!o.eventDate) return true;
    return (safeDate(o.eventDate)?.getTime() ?? 0) >= nowMs;
  });
  const pastOrders = displayOrders.filter((o) => {
    if (!o.eventDate) return false;
    return (safeDate(o.eventDate)?.getTime() ?? 0) < nowMs;
  });
  const displayedOrders = activeTab === 'upcoming' ? upcomingOrders : pastOrders;
  const showPendingReservationBanner =
    Boolean(pendingReservation) &&
    Boolean(pendingPaymentOrderId) &&
    new Date(pendingReservation!.expiresAt).getTime() > Date.now();
  const groupedDisplayedOrders = useMemo(() => {
    const groups = new Map<string, Order[]>();

    displayedOrders.forEach((order) => {
      const label = getOrderGroupLabel(order);
      const current = groups.get(label) || [];
      current.push(order);
      groups.set(label, current);
    });

    return [...groups.entries()].map(([label, groupedOrders]) => ({
      label,
      orders: groupedOrders.sort((left, right) => {
        const leftTime =
          safeDate(left.eventDate || left.eventStartDate || left.createdAt)?.getTime() ?? 0;
        const rightTime =
          safeDate(right.eventDate || right.eventStartDate || right.createdAt)?.getTime() ?? 0;
        return activeTab === 'upcoming' ? leftTime - rightTime : rightTime - leftTime;
      }),
    }));
  }, [activeTab, displayedOrders]);

  // If opened via deep link, auto-open the order sheet.
  useEffect(() => {
    if (!orderId) return;
    const linkedOrder = displayedOrders.find((o) => o.id === orderId);
    if (linkedOrder) {
      setSelectedOrder(linkedOrder);
      setShowQRModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders, cachedOrders]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Constant Orange Atmosphere Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[hexWithAlpha(colors.iris, '55', 'rgba(244, 74, 34, 0.33)'), 'rgba(5,5,6,0)']}
          locations={[0, 0.85]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* QR Modal */}
      <QRModal visible={showQRModal} order={selectedOrder} onClose={() => setShowQRModal(false)} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <SegmentedHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            upcomingCount={upcomingOrders.length}
            pastCount={pastOrders.length}
          />

          {showPendingReservationBanner && pendingReservation ? (
            <View style={styles.pendingReservationCard}>
              <View style={styles.pendingReservationCopy}>
                <Text style={styles.pendingReservationEyebrow}>Incomplete Payment</Text>
                <Text style={styles.pendingReservationTitle}>
                  {pendingReservation.eventTitle || 'Your reserved tickets are waiting'}
                </Text>
              </View>
              <View style={styles.pendingReservationActions}>
                <Pressable onPress={clearPendingReservation}>
                  <Text style={styles.pendingReservationDismiss}>Dismiss</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/checkout')}
                  style={styles.pendingReservationButton}
                >
                  <Text style={styles.pendingReservationButtonText}>Resume</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Countdown Hero — next event ≤ 7 days away */}
        {nextEvent && (
          <CountdownHero
            order={nextEvent}
            onViewTicket={() => {
              setSelectedOrder(nextEvent);
              setShowQRModal(true);
            }}
          />
        )}

        {/* Loading with skeleton */}
        {loading && displayOrders.length === 0 && <SkeletonList type="ticket" count={3} />}

        {/* Error - No cached data */}
        {error && !loading && displayOrders.length === 0 && !isOffline && (
          <ErrorState
            message="Failed to load your tickets. Please try again."
            onRetry={onRefresh}
          />
        )}

        {/* Offline with no cache */}
        {isOffline && displayOrders.length === 0 && !loading && (
          <NetworkError onRetry={onRefresh} />
        )}

        {/* Tickets */}
        <Animated.View
          key={activeTab}
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
          style={[styles.ticketsList, { paddingBottom: 100 }]} // Extra padding so the bottom card isn't flush
        >
          {(() => {
            let globalIndex = 0;
            return groupedDisplayedOrders.map((group) => (
              <Fragment key={group.label}>
                {group.orders.map((order) => {
                  const currentIndex = globalIndex++;
                  return (
                    <TicketCard
                      key={order.id}
                      order={order}
                      onShowQR={() => {
                        setSelectedOrder(order);
                        setShowQRModal(true);
                      }}
                      index={currentIndex}
                    />
                  );
                })}
              </Fragment>
            ));
          })()}
        </Animated.View>

        {/* Empty State */}
        {!loading && displayedOrders.length === 0 && !error && (
          <Animated.View entering={FadeIn.delay(200)} style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎟️</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No Upcoming Tickets' : 'No Past Tickets'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming'
                ? 'Your purchased tickets will appear here'
                : 'Your attended events will appear here'}
            </Text>
            {activeTab === 'upcoming' && (
              <Pressable onPress={() => router.push('/(tabs)/explore')} style={styles.emptyButton}>
                <LinearGradient
                  colors={gradients.primary as [string, string]}
                  style={styles.emptyButtonGradient}
                >
                  <Text style={styles.emptyButtonText}>Explore Events</Text>
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 17,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 7,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.pill,
    padding: TICKET_FILTER_PADDING,
    width: TICKET_FILTER_WIDTH,
    height: TICKET_FILTER_HEIGHT,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  segmentedActiveBg: {
    position: 'absolute',
    top: TICKET_FILTER_PADDING,
    left: TICKET_FILTER_PADDING,
    width: TICKET_FILTER_THUMB_WIDTH,
    bottom: TICKET_FILTER_PADDING,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentedTabText: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentedTabTextActive: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  offlineBadge: {
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.3)',
  },
  offlineText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },

  // Countdown hero
  countdownHero: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    height: 220,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  countdownContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  countdownLabel: {
    color: colors.iris,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  countdownTitle: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  countdownDate: {
    color: colors.goldMetallic,
    fontSize: 13,
    marginBottom: 12,
  },
  countdownTimer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countdownUnit: {
    alignItems: 'center',
  },
  countdownDigits: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownUnitLabel: {
    color: colors.goldMetallic,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  countdownButton: {
    alignSelf: 'flex-start',
  },
  countdownButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
  },
  countdownButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Hidden Receive Card (relying on design mockup)
  receiveCard: {
    display: 'none',
  },

  // Ticket list
  ticketsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  ticketGroup: {
    gap: 14,
  },
  ticketGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketGroupTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ticketGroupMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // Ticket Card
  ticketCardWrap: {
    marginBottom: 0,
  },
  ticketCardInner: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.base[50],
  },
  ticketBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 24,
    zIndex: 1,
  },
  ticketContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hostPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hostPillText: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: ticketFont.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  ticketMiddleInfo: {
    marginTop: 12,
  },
  ticketLeftTitle: {
    color: '#fff',
    fontFamily: ticketFont.black,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ticketLeftDate: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: ticketFont.medium,
    fontSize: 14,
    fontWeight: '500',
  },
  ticketCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  ticketOrderId: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: ticketFont.medium,
    fontSize: 12,
    letterSpacing: 2,
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  qtyPillText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 13,
    fontWeight: '700',
  },
  notchLeft: {
    position: 'absolute',
    left: -12,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 5,
  },
  notchRight: {
    position: 'absolute',
    right: -12,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 5,
  },
  ticketCardQtyText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Detail sheet
  sheetContainer: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  sheetSafeArea: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetHeaderBtn: {
    minWidth: 64,
  },
  sheetHeaderBtnText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '500',
  },
  sheetHeaderTitle: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '600',
  },
  sheetContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 60,
  },

  // Hero ticket card inside sheet
  heroTicketCard: {
    height: 200,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroTopRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  heroTitleBlock: {},
  heroHostText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  heroEventText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  heroDateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  heroQrOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroQrWrapper: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: radii.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBottomRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  heroOrderId: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  heroQtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroQtyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroQtyIcon: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Show QR button
  showQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    marginBottom: 20,
  },
  showQrIcon: {
    color: colors.goldMetallic,
    fontSize: 18,
  },
  showQrText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '500',
  },

  // Action list
  actionGroup: {
    backgroundColor: '#161616',
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  actionRowLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 0,
  },

  // Breakdown card
  breakdownCard: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  breakdownTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    color: colors.goldMetallic,
    fontSize: 15,
  },
  breakdownValue: {
    color: colors.gold,
    fontSize: 15,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
  },
  breakdownTotalLabel: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '700',
  },
  breakdownTotalValue: {
    color: colors.gold,
    fontSize: 17,
    fontWeight: '700',
  },

  // Pending reservation banner
  pendingReservationCard: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingReservationCopy: {
    flex: 1,
  },
  pendingReservationEyebrow: {
    color: 'rgba(255, 165, 0, 0.9)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pendingReservationTitle: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  pendingReservationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingReservationDismiss: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  pendingReservationButton: {
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.4)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pendingReservationButtonText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },

  // States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: colors.goldMetallic,
    marginTop: 16,
  },
  errorContainer: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 61, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 113, 0.3)',
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.goldMetallic,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {},
  emptyButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radii.pill,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTicketsStore, Order } from '@/store/ticketsStore';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { cacheUserOrders, getCachedUserOrders } from '@/lib/cache';
import { shareEventLink } from '@/lib/deeplinks';
import { addToWallet, isWalletAvailable, PassData } from '@/lib/wallet';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  SlideInUp,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { colors, radii, gradients } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ErrorState, NetworkError } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { safeDate, formatEventDate, formatEventTime } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';
import { buildCalendarEventUrl } from '@/lib/calendar';
import { Wallet, CircleUser, Ticket as TicketIcon } from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// iOS-style action row for ticket detail sheet
function ActionRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
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
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.actionRowLabel}>{label}</Text>
      <Text style={[styles.actionRowIcon, danger && { color: colors.error }]}>{icon}</Text>
    </Pressable>
  );
}

// Ticket Detail Sheet — iOS action-list style (replaces QRModal)
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
  const [walletAvailable, setWalletAvailable] = useState(false);

  useEffect(() => {
    isWalletAvailable().then(setWalletAvailable);
    if (!visible) setShowQR(false); // reset on close
  }, [visible]);

  if (!order) return null;

  const qrData = (order as any).qrData || order.id;
  const totalGuests = (order as any).totalGuests ?? 0;
  const totalRevenue = (order as any).totalRevenue ?? 0;
  const ticketType = order.tickets?.[0]?.tierName || 'General Entry';
  const dateStr = (() => {
    const d = safeDate(order.eventDate);
    if (!d) return '';
    return (
      d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    );
  })();
  const shortId = order.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  const calendarUrl = buildCalendarEventUrl({
    title: order.eventTitle || 'THE C1RCLE Event',
    startDate: order.eventStartDate || order.eventDate,
    location: order.venueLocation,
    description: `${ticketType} · ${totalGuests} ticket${totalGuests > 1 ? 's' : ''}`,
  });

  const handleTransfer = () => {
    onClose();
    router.push({ pathname: '/transfer', params: { orderId: order.id, ticketName: ticketType } });
  };

  const handleWhatsApp = async () => {
    const text = encodeURIComponent(
      `My ticket for ${order.eventTitle || 'Event'} on ${dateStr} (${ticketType}) — Ticket ID: ${shortId}`,
    );
    const waUrl = `whatsapp://send?text=${text}`;
    if (await Linking.canOpenURL(waUrl)) {
      await Linking.openURL(waUrl);
    } else if (order.eventId && order.eventTitle) {
      await shareEventLink(order.eventId, order.eventTitle);
    }
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheetContainer}>
        <SafeAreaView style={styles.sheetSafeArea}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} style={styles.sheetHeaderBtn}>
              <Text style={styles.sheetHeaderBtnText}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetHeaderTitle}>Your Order</Text>
            <Pressable onPress={onClose} style={styles.sheetHeaderBtn}>
              <Text style={[styles.sheetHeaderBtnText, { fontWeight: '700' }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {/* Hero ticket card */}
            <Animated.View entering={SlideInUp.delay(80).springify()} style={styles.heroTicketCard}>
              {order.eventCoverImage ? (
                <Image
                  source={{ uri: order.eventCoverImage }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient colors={['#2a1a0e', '#161616']} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.65)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Top info */}
              <View style={styles.heroTopRow}>
                <View style={styles.heroTitleBlock}>
                  <Text style={styles.heroHostText} numberOfLines={1}>
                    {(order as any).hostName || 'C1RCLE'}
                  </Text>
                  <Text style={styles.heroEventText} numberOfLines={1}>
                    {order.eventTitle || 'Event'}
                  </Text>
                  {dateStr ? <Text style={styles.heroDateText}>{dateStr}</Text> : null}
                </View>
              </View>

              {/* QR overlay */}
              {showQR && (
                <View style={styles.heroQrOverlay}>
                  <View style={styles.heroQrWrapper}>
                    <QRCode value={qrData} size={160} color="#161616" backgroundColor="#ffffff" />
                  </View>
                </View>
              )}

              {/* Bottom: order ID + quantity */}
              <View style={styles.heroBottomRow}>
                <Text style={styles.heroOrderId}>{shortId}</Text>
                <View style={styles.heroQtyBadge}>
                  <Text style={styles.heroQtyText}>{totalGuests}x</Text>
                  <Text style={styles.heroQtyIcon}>⬡</Text>
                </View>
              </View>
            </Animated.View>

            {/* Show/Hide QR toggle */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowQR((v) => !v);
              }}
              style={styles.showQrBtn}
            >
              <Text style={styles.showQrIcon}>⊡</Text>
              <Text style={styles.showQrText}>{showQR ? 'Hide QR Code' : 'Show QR Code'}</Text>
            </Pressable>

            {/* Action list group 1 */}
            <Animated.View entering={FadeInDown.delay(150)} style={styles.actionGroup}>
              <ActionRow
                icon="ⓘ"
                label="View Event"
                onPress={() => {
                  onClose();
                  if (order.eventId)
                    router.push({ pathname: '/event/[id]', params: { id: order.eventId } });
                }}
              />
              <View style={styles.actionRowDivider} />
              <ActionRow
                icon="📅"
                label="Add to Calendar"
                onPress={() => {
                  if (calendarUrl) {
                    Linking.openURL(calendarUrl);
                  }
                }}
              />
              {walletAvailable && (
                <>
                  <View style={styles.actionRowDivider} />
                  <ActionRow icon="⊞" label="Add to Apple Wallet" onPress={handleAddToWallet} />
                </>
              )}
              <View style={styles.actionRowDivider} />
              <ActionRow
                icon="📍"
                label="Get Directions"
                onPress={() => {
                  const venue = order.venueLocation;
                  if (venue) Linking.openURL(`maps://search?q=${encodeURIComponent(venue)}`);
                }}
              />
              <View style={styles.actionRowDivider} />
              <ActionRow
                icon="✓"
                label="View Order Confirmation"
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/checkout/success',
                    params: { orderId: order.id },
                  } as any);
                }}
              />
            </Animated.View>

            {/* Action list group 2 */}
            <Animated.View entering={FadeInDown.delay(200)} style={styles.actionGroup}>
              <ActionRow icon="↗" label="Transfer Ticket" onPress={handleTransfer} />
              <View style={styles.actionRowDivider} />
              <ActionRow icon="💬" label="Share via WhatsApp" onPress={handleWhatsApp} />
              <View style={styles.actionRowDivider} />
              <ActionRow
                icon="🔗"
                label="Share Event Link"
                onPress={async () => {
                  if (order.eventId && order.eventTitle)
                    await shareEventLink(order.eventId, order.eventTitle);
                }}
              />
            </Animated.View>

            {/* Breakdown */}
            <Animated.View entering={FadeInDown.delay(250)} style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Breakdown</Text>
              {order.tickets?.map((t, i) => (
                <View key={i} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {t.tierName || 'Ticket'} x{t.quantity}
                  </Text>
                  <Text style={styles.breakdownValue}>
                    {t.price > 0 ? `₹${(t.price * t.quantity).toLocaleString('en-IN')}` : 'Free'}
                  </Text>
                </View>
              ))}
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownTotalLabel}>Total</Text>
                <Text style={styles.breakdownTotalValue}>
                  {totalRevenue > 0 ? `₹${totalRevenue.toLocaleString('en-IN')}` : 'Free'}
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// Full-bleed Boarding-Pass Ticket Card
function TicketCard({
  order,
  onShowQR,
  index,
}: {
  order: Order;
  onShowQR: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const totalGuests = (order as any).totalGuests ?? 0;
  const shortId = order.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  const hostName = (order as any).hostName || (order as any).promoterName || '';

  // Format date like "Mar 12th • 5 PM"
  const dateStr = (() => {
    const d = safeDate(order.eventDate);
    if (!d) return '';

    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
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
      entering={FadeInDown.delay(index * 70)
        .springify()
        .damping(15)}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onShowQR();
      }}
      style={[animatedStyle, styles.ticketCard]}
    >
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

      {/* Premium Gradient Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* content container */}
      <View style={styles.ticketContent}>
        {/* Host Name Badge */}
        <View style={styles.hostBadge}>
          <Text style={styles.hostText} numberOfLines={1}>
            {(hostName || 'THE C1RCLE').toUpperCase()}
          </Text>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {order.eventTitle}
          </Text>
          <Text style={styles.eventDateText}>{dateStr}</Text>
        </View>

        {/* Bottom Row */}
        <View style={styles.ticketCardBottom}>
          <Text style={styles.ticketCardOrderId}>{shortId}</Text>

          <View style={styles.ticketCardQty}>
            <Text style={styles.ticketCardQtyText}>{totalGuests}x</Text>
            <TicketIcon size={14} color="#fff" />
          </View>
        </View>
      </View>

      {/* Side Notches (Punch holes) */}
      <View style={styles.notchContainer}>
        <View style={styles.notchLeft} />
        <View style={styles.notchRight} />
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
    <Animated.View entering={FadeInDown.springify()} style={styles.countdownHero}>
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

  const handleTabPress = (tab: 'upcoming' | 'past') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    slideAnim.value = withSpring(tab === 'upcoming' ? 0 : 1, {
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    });
  };

  const animatedBgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value * 80 }], // Adjust based on tab width
  }));

  return (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.push('/profile')} style={styles.headerIconBtn}>
        <Wallet size={24} color={colors.gold} />
      </Pressable>

      <View style={styles.segmentedContainer}>
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

      <Pressable onPress={() => router.push('/profile')} style={styles.avatarBtn}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>A</Text>
        </View>
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
  const stats = (user as any).stats ?? {};
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
    router.replace({ pathname: '/ticket/[id]', params: { id: orderId } } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders, cachedOrders]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* QR Modal */}
      <QRModal visible={showQRModal} order={selectedOrder} onClose={() => setShowQRModal(false)} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
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
              router.push({ pathname: '/ticket/[id]', params: { id: nextEvent.id } } as any);
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
          style={styles.ticketsList}
        >
          {groupedDisplayedOrders.map((group, groupIndex) => (
            <View key={group.label} style={styles.ticketGroup}>
              <View style={styles.ticketGroupHeader}>
                <Text style={styles.ticketGroupTitle}>{group.label}</Text>
                <Text style={styles.ticketGroupMeta}>
                  {group.orders.length} order{group.orders.length === 1 ? '' : 's'}
                </Text>
              </View>

              {group.orders.map((order, index) => (
                <TicketCard
                  key={order.id}
                  order={order}
                  onShowQR={() => {
                    router.push({ pathname: '/ticket/[id]', params: { id: order.id } } as any);
                  }}
                  index={index} // Use index instead of cumulative to refresh animation on tab switch
                />
              ))}
            </View>
          ))}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radii.pill,
    padding: 4,
    width: 164, // Slightly wider for better spacing
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  segmentedActiveBg: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 78,
    bottom: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentedTabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentedTabTextActive: {
    color: '#fff',
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    gap: 18,
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
  ticketCard: {
    height: 200,
    borderRadius: 32, // Matches radii["2xl"] or slightly larger
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.base[50],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ticketContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  hostBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backdropFilter: 'blur(10px)',
  },
  hostText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  eventInfo: {
    marginTop: 'auto',
    marginBottom: 10,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  eventDateText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600',
  },
  ticketCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  ticketCardOrderId: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  ticketCardQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  ticketCardQtyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  notchContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.base.DEFAULT,
    position: 'absolute',
    left: -10,
  },
  notchRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.base.DEFAULT,
    position: 'absolute',
    right: -10,
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
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionRowLabel: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '400',
  },
  actionRowIcon: {
    color: colors.goldMetallic,
    fontSize: 18,
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 16,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { type Order, useTicketsStore } from '@/store/ticketsStore';
import { colors, typography } from '@/lib/design/theme';
import { resolveEventAccentColor } from '@/hooks/useEventAccent';
import { formatEventDate, formatEventTime } from '@/lib/utils/date';

type SearchParamValue = string | string[] | undefined;

interface OrderDetails {
  id: string;
  eventId?: string;
  eventTitle: string;
  eventDate?: string;
  eventTimezone?: string;
  eventCoverImage?: string;
  venueLocation?: string;
  hostName?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  items: Array<{
    tierName: string;
    quantity: number;
  }>;
}

const successFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

function getParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHexColor(color?: string, fallback = '#D915A8') {
  if (!color) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return fallback;
}

function hexToRgba(color: string, alpha: number) {
  const hex = normalizeHexColor(color).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getReadableTextColor(color: string) {
  const hex = normalizeHexColor(color).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.48 ? '#161616' : '#FFFFFF';
}

function formatConfirmationDate(value?: string, timeZone?: string) {
  if (!value) return 'Date TBA';
  return `${formatEventDate(value, timeZone)} at ${formatEventTime(value, timeZone)}`;
}

function buildRouteOrder(params: Record<string, SearchParamValue>): OrderDetails | null {
  const orderId = getParam(params.orderId);
  const eventTitle = getParam(params.eventTitle);
  if (!orderId || !eventTitle) return null;

  const parsedTicketCount = Math.max(Number(getParam(params.ticketCount) || 1), 1);
  return {
    id: orderId,
    eventId: getParam(params.eventId),
    eventTitle,
    eventDate: getParam(params.eventDate),
    eventTimezone: getParam(params.eventTimezone),
    eventCoverImage: getParam(params.eventCoverImage),
    venueLocation: getParam(params.venueLocation),
    hostName: getParam(params.hostName),
    accentColor: getParam(params.accentColor),
    backgroundColor: getParam(params.backgroundColor),
    textColor: getParam(params.textColor),
    totalAmount: Number(getParam(params.totalAmount) || 0),
    status: 'confirmed',
    paymentMethod: getParam(params.paymentMethod),
    items: [
      {
        tierName: 'Selected tickets',
        quantity: parsedTicketCount,
      },
    ],
  };
}

function mapStoreOrder(storeOrder: Order): OrderDetails {
  return {
    id: storeOrder.id,
    eventId: storeOrder.eventId,
    eventTitle: storeOrder.eventTitle || 'Event',
    eventDate: storeOrder.eventStartDate || storeOrder.eventDate,
    eventTimezone: storeOrder.eventTimezone,
    eventCoverImage: storeOrder.eventCoverImage,
    venueLocation: storeOrder.venueLocation,
    hostName: storeOrder.hostName,
    accentColor: resolveEventAccentColor(storeOrder as any),
    backgroundColor: (storeOrder as any).backgroundColor,
    textColor: (storeOrder as any).textColor,
    totalAmount: storeOrder.totalAmount || 0,
    status: storeOrder.status,
    paymentMethod: (storeOrder as any).paymentMethod,
    items: storeOrder.tickets.map((ticket) => ({
      tierName: ticket.tierName || 'Ticket',
      quantity: ticket.quantity || 1,
    })),
  };
}

export default function CheckoutSuccessScreen() {
  const params = useLocalSearchParams();
  const searchParams = params as Record<string, SearchParamValue>;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const fetchUserOrders = useTicketsStore((state) => state.fetchUserOrders);
  const getOrderById = useTicketsStore((state) => state.getOrderById);

  const routeOrder = useMemo(() => buildRouteOrder(searchParams), [searchParams]);
  const [order, setOrder] = useState<OrderDetails | null>(routeOrder);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const syncStartedRef = useRef(false);

  const checkScale = useSharedValue(0.2);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    setOrder((current) => current || routeOrder);
  }, [routeOrder]);

  const orderId = order?.id || routeOrder?.id || getParam(searchParams.orderId) || '';

  const syncOrderInBackground = useCallback(async () => {
    if (syncing || !orderId) return;
    setSyncing(true);
    setSyncFailed(false);
    try {
      if (user?.uid) {
        await fetchUserOrders().catch(() => {});
      }

      const storeOrder = await getOrderById(orderId).catch(() => null);
      if (storeOrder) {
        const mappedOrder = mapStoreOrder(storeOrder);
        setOrder((current) => ({
          ...mappedOrder,
          eventCoverImage: mappedOrder.eventCoverImage || current?.eventCoverImage,
          accentColor: mappedOrder.accentColor || current?.accentColor,
          backgroundColor: mappedOrder.backgroundColor || current?.backgroundColor,
          textColor: mappedOrder.textColor || current?.textColor,
          paymentMethod: mappedOrder.paymentMethod || current?.paymentMethod,
        }));
      }
    } catch (error) {
      console.error('Error syncing order in background:', error);
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  }, [fetchUserOrders, getOrderById, orderId, syncing, user?.uid]);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    checkOpacity.value = withTiming(1, { duration: 120 });
    checkScale.value = withSequence(
      withSpring(1.16, { damping: 9, stiffness: 280 }),
      withSpring(1, { damping: 10, stiffness: 260 }),
    );

    const revealTimer = setTimeout(() => {
      setRevealComplete(true);
    }, 900);

    return () => clearTimeout(revealTimer);
  }, [checkOpacity, checkScale]);

  useEffect(() => {
    if (orderId && !syncStartedRef.current) {
      syncStartedRef.current = true;
      void syncOrderInBackground();
    }

    const onBackPress = () => {
      router.replace('/(tabs)/tickets');
      return true;
    };
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSubscription.remove();
  }, [orderId, syncOrderInBackground]);

  const pageBg = normalizeHexColor(order?.backgroundColor || order?.accentColor, colors.iris);
  const foreground =
    order?.textColor && /^#[0-9A-Fa-f]{6}$/.test(order.textColor)
      ? order.textColor
      : getReadableTextColor(pageBg);
  const mutedForeground = hexToRgba(foreground, 0.76);
  const buttonBackground = hexToRgba(foreground, 0.12);
  const buttonBorder = hexToRgba(foreground, 0.18);
  const posterWidth = Math.min(width - 40, 380);
  const posterHeight = Math.min(height * 0.56, posterWidth * 1.28);
  const dateLabel = formatConfirmationDate(order?.eventDate, order?.eventTimezone);
  const venueLabel = order?.venueLocation || 'Venue TBA';
  const poster = order?.eventCoverImage;

  const checkRevealStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const handleShare = async () => {
    if (!order) return;
    void Haptics.selectionAsync();
    const eventLink = order.eventId
      ? `https://thec1rcle.com/event/${encodeURIComponent(order.eventId)}`
      : '';
    const message = eventLink
      ? `I'm going to ${order.eventTitle} on THE C1RCLE.\n\nJoin me there:\n${eventLink}`
      : `I'm going to ${order.eventTitle} on THE C1RCLE.`;
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleViewTicket = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)/tickets');
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.iris} />
        <Text style={styles.loadingText}>Opening your confirmation...</Text>
      </SafeAreaView>
    );
  }

  if (!revealComplete) {
    return (
      <View style={[styles.checkRevealScreen, { backgroundColor: pageBg }]}>
        <Animated.View style={[styles.greenCheckOuter, checkRevealStyle]}>
          <View style={styles.greenCheckCircle}>
            <Ionicons name="checkmark" size={58} color="#FFFFFF" />
          </View>
        </Animated.View>
        <Text style={[styles.checkRevealTitle, { color: foreground }]}>Payment confirmed</Text>
        <Text style={[styles.checkRevealCopy, { color: mutedForeground }]}>
          Your ticket is ready.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.goingScreen, { backgroundColor: pageBg }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          hexToRgba(order.accentColor || '#D915A8', 0.6), // Dominant color bleed
          hexToRgba(pageBg, 0.9),
          pageBg,
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.goingSafeArea}>
        <View style={[styles.goingContent, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
          <Animated.View entering={FadeIn.duration(260)} style={styles.goingHeader}>
            <View
              style={[
                styles.confirmedPill,
                { backgroundColor: buttonBackground, borderColor: buttonBorder },
              ]}
            >
              <Ionicons name="checkmark-circle" size={17} color="#19C37D" />
              <Text style={[styles.confirmedPillText, { color: foreground }]}>YOU'RE IN</Text>
            </View>
            <Text style={[styles.goingMark, { color: foreground }]}>YOU'RE GOING</Text>
            <Text style={[styles.goingTitle, { color: foreground }]} numberOfLines={3}>
              {order.eventTitle.toUpperCase()}
            </Text>
            <Text style={[styles.goingAddress, { color: mutedForeground }]} numberOfLines={2}>
              {venueLabel}
            </Text>
            <Text style={[styles.goingDate, { color: hexToRgba(foreground, 0.7) }]}>
              {dateLabel}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).duration(360)}
            style={[
              styles.goingPosterWrap,
              {
                width: posterWidth,
                height: posterHeight,
                shadowColor: pageBg,
              },
            ]}
          >
            {poster ? (
              <Image
                source={{ uri: poster }}
                style={styles.goingPoster}
                contentFit="cover"
                transition={220}
              />
            ) : (
              <LinearGradient
                colors={[hexToRgba(foreground, 0.28), hexToRgba('#000000', 0.18)]}
                style={styles.goingPosterFallback}
              >
                <Text style={styles.goingPosterFallbackText}>
                  {order.eventTitle.slice(0, 1).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0)', hexToRgba(pageBg, 0.24), hexToRgba(pageBg, 0.96)]}
              locations={[0.46, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {syncFailed ? (
            <Pressable
              onPress={syncOrderInBackground}
              disabled={syncing}
              style={[styles.retrySyncButton, { borderColor: buttonBorder }]}
            >
              {syncing ? (
                <ActivityIndicator color={foreground} size="small" />
              ) : (
                <Text style={[styles.retrySyncText, { color: foreground }]}>Retry ticket sync</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.goingBottomActions, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable
            onPress={handleShare}
            style={[
              styles.goingCircleButton,
              { backgroundColor: buttonBackground, borderColor: buttonBorder },
            ]}
          >
            <Ionicons name="share-outline" size={20} color={foreground} />
          </Pressable>
          <Pressable
            onPress={handleViewTicket}
            style={[styles.goingTicketButton, { backgroundColor: buttonBackground }]}
          >
            <Text style={[styles.goingTicketButtonText, { color: foreground }]}>View Ticket</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace('/(tabs)/explore');
            }}
            style={[
              styles.goingCircleButton,
              { backgroundColor: buttonBackground, borderColor: buttonBorder },
            ]}
          >
            <Ionicons name="close" size={24} color={foreground} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: colors.goldStone,
    fontFamily: successFont.medium,
    marginTop: 16,
  },
  checkRevealScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  greenCheckOuter: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,195,125,0.16)',
    marginBottom: 26,
  },
  greenCheckCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#19C37D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#19C37D',
    shadowOpacity: 0.48,
    shadowRadius: 28,
    elevation: 16,
  },
  checkRevealTitle: {
    fontFamily: successFont.black,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  checkRevealCopy: {
    fontFamily: successFont.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  goingScreen: {
    flex: 1,
  },
  goingSafeArea: {
    flex: 1,
  },
  goingContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 96,
    alignItems: 'center',
  },
  goingHeader: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  confirmedPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 14,
  },
  confirmedPillText: {
    fontFamily: successFont.black,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  goingMark: {
    fontFamily: successFont.black,
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0,
    marginBottom: 10,
  },
  goingTitle: {
    fontFamily: successFont.black,
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: 0,
    textAlign: 'center',
    marginBottom: 13,
  },
  goingAddress: {
    fontFamily: successFont.bold,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
    marginHorizontal: 10,
    marginBottom: 4,
  },
  goingDate: {
    fontFamily: successFont.medium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  goingPosterWrap: {
    alignSelf: 'center',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.08)',
    shadowOpacity: 0.4,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  goingPoster: {
    width: '100%',
    height: '100%',
  },
  goingPosterFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goingPosterFallbackText: {
    color: '#FFFFFF',
    fontFamily: successFont.black,
    fontSize: 72,
    fontWeight: '900',
  },
  retrySyncButton: {
    marginTop: 18,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retrySyncText: {
    fontFamily: successFont.bold,
    fontSize: 12,
    fontWeight: '800',
  },
  goingBottomActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  goingCircleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goingTicketButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goingTicketButtonText: {
    fontFamily: successFont.bold,
    fontSize: 15,
    fontWeight: '900',
  },
});

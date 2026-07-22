import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  Alert,
  StyleSheet,
  Linking,
  Platform,
  Share,
  useWindowDimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useTicketsStore, Order, OrderTicket } from '@/store/ticketsStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useCartStore } from '@/store/cartStore';
import { apiFetch, createShareBundle, deduplicateRequest } from '@/lib/api';
import { cacheUserOrders, getCachedUserOrders } from '@/lib/cache';
import { resolveEventAccentColor, TICKET_ACCENT } from '@/hooks/useEventAccent';
import { shareEventLink } from '@/lib/deeplinks';
import { addToWallet, PassData } from '@/lib/wallet';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { colors, radii, gradients, typography } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ErrorState, NetworkError } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ActionSheet, ShareSheetContent } from '@/components/tickets/TicketActionSheets';
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
  Clock,
  ArrowDownUp,
  Share2,
  User,
} from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const TICKET_FILTER_WIDTH = 204;
const TICKET_FILTER_HEIGHT = 43;
const TICKET_FILTER_PADDING = 4;
const TICKET_FILTER_THUMB_WIDTH = (TICKET_FILTER_WIDTH - TICKET_FILTER_PADDING * 2) / 2;
const TICKET_TAB_SWIPE_DISTANCE = 52;
const TICKET_TAB_SWIPE_VELOCITY = 650;
const TICKET_PERFORATION_DASHES = Array.from({ length: 22 });
type TicketTab = 'upcoming' | 'past';

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

const PROFILE_PHOTO_FIELDS = [
  'photoURL',
  'photos[0]',
  'datingPhotos[0]',
  'avatar',
  'photo',
  'imageUrl',
  'profilePicture',
  'profilePictureUrl',
] as const;

function resolveField(obj: Record<string, any>, path: string): string | null {
  if (path.endsWith('[0]')) {
    const arr = obj[path.slice(0, -3)];
    return arr?.[0] ?? null;
  }
  return obj[path] ?? null;
}

function resolveCurrentUserPhoto(
  profile: ReturnType<typeof useProfileStore.getState>['profile'],
  user: ReturnType<typeof useAuthStore.getState>['user'],
): string {
  const rawProfile = (profile ?? {}) as Record<string, any>;
  for (const field of PROFILE_PHOTO_FIELDS) {
    const val = resolveField(rawProfile, field);
    if (val) return val;
  }
  return user?.photoURL || '';
}

function formatRupees(paise: number): string {
  if (paise === 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatTxnTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatTxnDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

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
  disabled,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[ms.actionRow, disabled && { opacity: 0.42 }]}
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

const DEFAULT_EVENT_DURATION_MS = 12 * 60 * 60 * 1000;

function getOrderEventStartMs(order: Order): number | null {
  const start = safeDate(order.eventStartDate || order.eventDate);
  const value = start?.getTime();
  return value != null && Number.isFinite(value) ? value : null;
}

function isOrderEventEnded(order: Order, nowMs = Date.now()): boolean {
  const rawEnd =
    (order as any).eventEndDate ||
    (order as any).eventEndAt ||
    (order as any).endDate ||
    (order as any).endAt;
  const end = safeDate(rawEnd);
  const endMs = end?.getTime();
  if (endMs != null && Number.isFinite(endMs)) return endMs < nowMs;

  const startMs = getOrderEventStartMs(order);
  return startMs != null ? startMs + DEFAULT_EVENT_DURATION_MS < nowMs : false;
}

function hexWithAlpha(color: string | undefined, alpha: string, fallback: string) {
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return fallback;
  return `${color}${alpha}`;
}

function looksLikeLegacyJwt(value: unknown): boolean {
  return typeof value === 'string' && value.split('.').length === 3;
}

function looksLikeTicketDocumentId(value: unknown): boolean {
  return typeof value === 'string' && /^TKT[-_]/i.test(value.trim());
}

function resolveWalletQrData(order: Order): string {
  const activeQr = order.qrCodes?.find((qr) => !qr.isUsed) || order.qrCodes?.[0];
  if (activeQr) {
    if (activeQr.qrMode === 'raw_id' && activeQr.qrCode) return String(activeQr.qrCode);
    if (looksLikeTicketDocumentId(activeQr.ticketId)) return String(activeQr.ticketId);
    if (activeQr.qrCode && !looksLikeLegacyJwt(activeQr.qrCode)) return String(activeQr.qrCode);
    if (activeQr.qrCode) return String(activeQr.qrCode);
  }

  const orderQrData = (order as any).qrData;
  if (typeof orderQrData === 'string' && orderQrData.trim()) return orderQrData.trim();
  return order.id;
}

function normalizeBookingCodeLabel(value: unknown): string | null {
  const code = String(value || '')
    .replace(/^#/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim()
    .toUpperCase();
  return code.length >= 6 ? code.slice(0, 6) : null;
}

function resolveBookingCode(order: Order): string {
  const activeQr = order.qrCodes?.find((qr) => !qr.isUsed) || order.qrCodes?.[0];
  const realCode =
    normalizeBookingCodeLabel(order.bookingCode) ||
    normalizeBookingCodeLabel(activeQr?.bookingCode) ||
    normalizeBookingCodeLabel(order.bookingCodes?.[0]?.bookingCode) ||
    normalizeBookingCodeLabel(order.tickets?.find((ticket) => ticket.bookingCode)?.bookingCode);

  if (realCode) return realCode;

  return (
    normalizeBookingCodeLabel(activeQr?.ticketId) ||
    normalizeBookingCodeLabel(activeQr?.qrCode) ||
    normalizeBookingCodeLabel(order.id) ||
    'TICKET'
  );
}

function formatBookingCode(order: Order): string {
  return `#${resolveBookingCode(order)}`;
}

type TicketDisplaySlot = OrderTicket & {
  rowId: string;
  slotNumber: number;
  ticketNumber: number;
  totalInTier: number;
  qrData: string;
  transferTicketId: string;
  bookingLabel: string;
  isUsed?: boolean;
  claimName: string;
  claimPhoto?: string;
  claimInitials: string;
  statusTone: 'claimed' | 'host' | 'available' | 'used';
};

function getInitials(value: string): string {
  const initials = value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'TC';
}

function resolveTicketClaimPerson({
  ticket,
  order,
  qr,
  profile,
  user,
}: {
  ticket: OrderTicket;
  order: Order;
  qr?: any;
  profile: ReturnType<typeof useProfileStore.getState>['profile'];
  user: ReturnType<typeof useAuthStore.getState>['user'];
}) {
  const currentUserPhoto = resolveCurrentUserPhoto(profile, user);
  const currentUserName = firstNonEmptyString(
    profile?.displayName,
    user?.displayName,
    order.userName,
    user?.email,
    order.userEmail,
    'You',
  );

  // 1. Check individual QR code claim status (New structure)
  if (qr) {
    if (qr.claimedBy?.uid || qr.claimedBy?.name || qr.claimedBy?.email) {
      const name = firstNonEmptyString(qr.claimedBy.name, qr.claimedBy.email, 'Claimed');
      return {
        name,
        photo: qr.claimedBy.photoURL,
        tone: 'claimed' as const,
      };
    }
    if (qr.isClaimed || ticket.isClaimed) {
      return {
        name: currentUserName,
        photo: currentUserPhoto,
        tone: 'host' as const,
      };
    }
    // If QR exists but is NOT claimed, it's definitely available.
    return {
      name: 'Unclaimed',
      photo: undefined,
      tone: 'available' as const,
    };
  }

  // 2. Fallback to tier-level claim status (Legacy structure)
  if (ticket.claimedBy?.uid || ticket.claimedBy?.name || ticket.claimedBy?.email) {
    const name = firstNonEmptyString(ticket.claimedBy.name, ticket.claimedBy.email, 'Claimed');
    return {
      name,
      photo: ticket.claimedBy.photoURL,
      tone: 'claimed' as const,
    };
  }

  if (ticket.isClaimed) {
    return {
      name: currentUserName,
      photo: currentUserPhoto,
      tone: 'host' as const,
    };
  }

  return {
    name: 'Unclaimed',
    photo: undefined,
    tone: 'available' as const,
  };
}

function buildTicketDisplaySlots(
  order: Order,
  profile: ReturnType<typeof useProfileStore.getState>['profile'],
  user: ReturnType<typeof useAuthStore.getState>['user'],
): TicketDisplaySlot[] {
  const slots: TicketDisplaySlot[] = [];
  let globalIndex = 0;

  order.tickets?.forEach((ticket, ticketIndex) => {
    const totalInTier = Math.max(ticket.quantity || 1, 1);

    Array.from({ length: totalInTier }).forEach((_, slotIndex) => {
      const qr = order.qrCodes?.[globalIndex];
      const claim = resolveTicketClaimPerson({ ticket, order, qr, profile, user });
      const assignmentTicketId =
        ticket.ticketId?.startsWith('CLAIM-') || ticket.ticketId?.startsWith('TRANS-')
          ? ticket.ticketId
          : null;
      const transferTicketId =
        qr?.ticketId ||
        assignmentTicketId ||
        `${order.id}-${ticket.tierId || ticket.ticketId || ticketIndex}-${slotIndex + 1}`;
      const fallbackQrData =
        qr?.qrCode ||
        qr?.ticketId ||
        ticket.ticketId ||
        `${order.id}-${ticket.tierId || ticketIndex}-${slotIndex + 1}`;
      const bookingLabel =
        normalizeBookingCodeLabel(qr?.bookingCode) ||
        normalizeBookingCodeLabel(ticket.bookingCode) ||
        normalizeBookingCodeLabel(qr?.ticketId) ||
        normalizeBookingCodeLabel(fallbackQrData) ||
        resolveBookingCode(order);

      slots.push({
        ...ticket,
        rowId: `${ticket.ticketId || ticket.tierId || ticketIndex}-${slotIndex}`,
        slotNumber: slotIndex + 1,
        ticketNumber: globalIndex + 1,
        totalInTier,
        qrData: fallbackQrData,
        transferTicketId,
        bookingLabel: `#${bookingLabel}`,
        isUsed: qr?.isUsed,
        claimName: claim.name,
        claimPhoto: claim.photo,
        claimInitials: getInitials(claim.name),
        statusTone: qr?.isUsed ? 'used' : claim.tone,
      });

      globalIndex += 1;
    });
  });

  if (slots.length) return slots;

  const claim = resolveTicketClaimPerson({
    ticket: {
      tierId: order.id,
      tierName: 'General Entry',
      quantity: 1,
      price: 0,
      isClaimed: order.isClaimed,
    },
    order,
    profile,
    user,
  });

  return [
    {
      tierId: order.id,
      tierName: 'General Entry',
      quantity: 1,
      price: 0,
      rowId: `${order.id}-fallback`,
      slotNumber: 1,
      ticketNumber: 1,
      totalInTier: 1,
      qrData: resolveWalletQrData(order),
      transferTicketId: order.qrCodes?.[0]?.ticketId || '',
      bookingLabel: formatBookingCode(order),
      claimName: claim.name,
      claimPhoto: claim.photo,
      claimInitials: getInitials(claim.name),
      statusTone: claim.tone,
    },
  ];
}

// Ticket Detail Sheet — Posh-style with poster flip + QR
function QRModal({
  visible,
  order,
  onClose,
  walletData,
  walletTransactions,
  onWalletRefresh,
}: {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  walletData?: any;
  walletTransactions?: any[];
  onWalletRefresh?: () => Promise<void> | void;
}) {
  const [showQR, setShowQR] = useState(false);
  const [activeTicketIndex, setActiveTicketIndex] = useState(0);
  const [activeSheet, setActiveSheet] = useState<'share' | null>(null);
  const flipProgress = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const profile = useProfileStore((state) => state.profile);
  const { user } = useAuthStore();

  // Wallet State
  const [qrJwt, setQrJwt] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(0);
  const [qrRefreshError, setQrRefreshError] = useState(false);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Active wallet check
  const activeWallet = walletData && order && walletData.orderId === order.id ? walletData : null;
  const qrRotating = !!qrJwt;
  const qrTimeLeft = qrExpiresAt ? Math.max(0, Math.floor((qrExpiresAt - Date.now()) / 1000)) : 0;
  const cardWidth = Math.min(width - 48, 380);
  const cardPageWidth = width - 32;
  const walletQrSize = 180;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

  const fetchQrJwt = async (walletId: string) => {
    try {
      const data = await apiFetch(`/api/v1/cover-charge/wallet/${walletId}/qr-jwt`);
      if (!mountedRef.current) return;
      setQrJwt(data.jwt);
      setQrExpiresAt(new Date(data.expiresAt).getTime());
      setQrRefreshError(false);

      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      qrTimerRef.current = setInterval(() => {
        fetchQrJwt(walletId);
      }, 55_000);
    } catch {
      if (!mountedRef.current) return;
      setQrRefreshError(true);
      if (!qrTimerRef.current) {
        qrTimerRef.current = setInterval(() => {
          fetchQrJwt(walletId);
        }, 55_000);
      }
    }
  };

  useEffect(() => {
    if (visible && activeWallet && activeWallet.state === 'ACTIVE') {
      fetchQrJwt(activeWallet.id);
    } else {
      if (qrTimerRef.current) {
        clearInterval(qrTimerRef.current);
        qrTimerRef.current = null;
      }
      setQrJwt(null);
    }
  }, [visible, activeWallet]);

  useEffect(() => {
    if (!visible) {
      setShowQR(false);
      setActiveTicketIndex(0);
      setActiveSheet(null);
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

  const {
    qrData,
    totalGuests,
    totalRevenue,
    ticketType,
    calendarUrl,
    accentColor,
    posterSize,
    miniQrSize,
    miniQrPadding,
    fullQrSize,
    posterTransitionTag,
  } = useMemo(() => {
    if (!order) {
      const _posterSize = Math.min(width - 48, 300, Math.max(260, height * 0.32));
      return {
        qrData: '',
        bookingLabel: '#TICKET',
        totalGuests: 1,
        totalRevenue: 0,
        ticketType: 'General Entry',
        posterHostName: 'C1RCLE',
        dateStr: '',
        shortId: '',
        calendarUrl: '',
        accentColor: TICKET_ACCENT,
        posterSize: _posterSize,
        miniQrSize: Math.max(126, Math.min(162, _posterSize * 0.38)),
        miniQrPadding: 12,
        fullQrSize: Math.min(220, _posterSize - 96),
        posterTransitionTag: 'ticket-poster-empty',
      };
    }

    const _qrData = resolveWalletQrData(order);
    const _bookingLabel = formatBookingCode(order);
    const _totalGuests =
      (order as any).totalGuests ??
      order.tickets?.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0) ??
      1;
    const _totalRevenue = (order as any).totalRevenue ?? 0;
    const _ticketType = order.tickets?.[0]?.tierName || 'General Entry';
    const _rawHostName = String((order as any).promoterName || (order as any).hostName || 'C1RCLE');
    const _posterHostName = _rawHostName.length > 14 ? 'C1RCLE' : _rawHostName;
    const _dateStr = (() => {
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
    const _shortId = order.id.replace(/-/g, '').substring(0, 8).toUpperCase();
    const _calendarUrl = buildCalendarEventUrl({
      title: order.eventTitle || 'THE C1RCLE Event',
      startDate: order.eventStartDate || order.eventDate,
      location: order.venueLocation,
      description: `${_ticketType} · ${_totalGuests} ticket${_totalGuests > 1 ? 's' : ''}`,
    });
    const _accentColor = resolveEventAccentColor(order as any, 'ticket');
    const _posterSize = Math.min(width - 48, 300, Math.max(260, height * 0.32));
    const _miniQrSize = Math.max(126, Math.min(162, _posterSize * 0.38));
    const _miniQrPadding = 12;
    const _fullQrSize = Math.min(220, _posterSize - 96);
    const _posterTransitionTag = `ticket-poster-${order.id}`;

    return {
      qrData: _qrData,
      bookingLabel: _bookingLabel,
      totalGuests: _totalGuests,
      totalRevenue: _totalRevenue,
      ticketType: _ticketType,
      posterHostName: _posterHostName,
      dateStr: _dateStr,
      shortId: _shortId,
      calendarUrl: _calendarUrl,
      accentColor: _accentColor,
      posterSize: _posterSize,
      miniQrSize: _miniQrSize,
      miniQrPadding: _miniQrPadding,
      fullQrSize: _fullQrSize,
      posterTransitionTag: _posterTransitionTag,
    };
  }, [order, width, height]);

  const ticketSlots = useMemo(
    () => (order ? buildTicketDisplaySlots(order, profile, user) : []),
    [order, profile, user],
  );
  const activeTicketSlot =
    ticketSlots[Math.min(activeTicketIndex, Math.max(ticketSlots.length - 1, 0))] || ticketSlots[0];

  if (!order) return null;

  const nowMs = Date.now();
  const eventStartMs = getOrderEventStartMs(order);
  const eventEnded = isOrderEventEnded(order, nowMs);
  const sharingClosed = eventEnded || (eventStartMs != null && eventStartMs <= nowMs);
  const transferClosed =
    eventEnded || (eventStartMs != null && eventStartMs - nowMs < 2 * 60 * 60 * 1000);

  const handleCloseSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleFlip = () => {
    if (eventEnded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = flipProgress.value < 0.5;
    flipProgress.value = withTiming(
      next ? 1 : 0,
      { duration: 400 },
      (finished) => {
        if (finished) runOnJS(setShowQR)(next);
      },
    );
  };

  const handleTransfer = () => {
    if (transferClosed) return;
    if (!activeTicketSlot?.transferTicketId) {
      Alert.alert('Transfer unavailable', 'This ticket is missing its individual ticket reference.');
      return;
    }
    if (activeTicketSlot.isUsed) {
      Alert.alert('Transfer unavailable', 'A scanned ticket cannot be transferred.');
      return;
    }
    onClose();
    router.push({
      pathname: '/transfer',
      params: { ticketId: activeTicketSlot.transferTicketId, ticketName: ticketType },
    });
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
      qrCodeData: activeTicketSlot?.qrData || qrData,
    };
    await addToWallet(passData);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShareChannel = async (
    channel: string,
    tierId?: string,
    expiresAt?: string,
    quantity = 1,
  ) => {
    if (!order || !tierId) return;
    if (sharingClosed) return;

    try {
      const response = await createShareBundle({
        orderId: order.id,
        eventId: order.eventId,
        quantity,
        tierId,
        expiresAt,
      });

      if (!response?.success || !response.bundle?.token) {
        Alert.alert('Share failed', response?.error || 'Unable to create a claim link.');
        return;
      }

      const claimUrl = `https://thec1rcle.com/tickets/claim/${encodeURIComponent(response.bundle.token)}`;
      const remainingSlots =
        typeof response.bundle.remainingSlots === 'number' ? response.bundle.remainingSlots : null;
      const slotCopy =
        remainingSlots && remainingSlots > 1
          ? `${remainingSlots} spots can be claimed from this link.`
          : 'Claim your ticket from this link.';
      const message = `Ticket for ${order.eventTitle || 'THE C1RCLE'}\n${slotCopy}\n\n${claimUrl}`;

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
        Alert.alert('Copied', 'The claim message was copied. Paste it into Instagram DM.');
      } else if (channel === 'sms') {
        const separator = Platform.OS === 'ios' ? '&' : '?';
        await Linking.openURL(`sms:${separator}body=${encodeURIComponent(message)}`);
      } else if (channel === 'email') {
        await Linking.openURL(
          `mailto:?subject=${encodeURIComponent(`Ticket for ${order.eventTitle || 'THE C1RCLE'}`)}&body=${encodeURIComponent(message)}`,
        );
      } else {
        await Share.share({ message });
      }

      setActiveSheet(null);
      await onWalletRefresh?.();
    } catch (error: any) {
      Alert.alert('Share failed', error?.message || 'Unable to share this ticket.');
    }
  };

  return (
    <Fragment>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseSheet}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSheet} />
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
                <Pressable onPress={handleCloseSheet} style={ms.headerBtn}>
                  <Text style={ms.headerCancelText}>Cancel</Text>
                </Pressable>
                <Text style={ms.headerTitle}>Your Order</Text>

                <Pressable
                  onPress={handleCloseSheet}
                  style={[ms.headerBtn, { alignItems: 'flex-end' }]}
                >
                  <Text style={ms.headerDoneText}>Done</Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={ms.scrollContent}
                bounces={false}
                overScrollMode="never"
              >
                {/* ─── Swipeable Ticket Slots ─── */}
                <FlatList
                  horizontal
                  pagingEnabled
                  data={ticketSlots}
                  keyExtractor={(item) => item.rowId}
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  overScrollMode="never"
                  snapToInterval={cardPageWidth}
                  decelerationRate="fast"
                  style={{ width: cardPageWidth, alignSelf: 'center' }}
                  onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / cardPageWidth);
                    setActiveTicketIndex(nextIndex);
                    setShowQR(false);
                    flipProgress.value = 0;
                  }}
                  renderItem={({ item }) => (
                    <View style={[ms.ticketPagerPage, { width: cardPageWidth }]}>
                      <View style={[ms.flipContainer, { width: posterSize, height: posterSize }]}>
                        {/* FRONT: Poster with small QR */}
                        <Animated.View style={[ms.cardFace, frontStyle]}>
                          {order.eventCoverImage ? (
                            <>
                              <AnimatedExpoImage
                                sharedTransitionTag={posterTransitionTag}
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
                            <View
                              style={[StyleSheet.absoluteFill, { backgroundColor: accentColor }]}
                            />
                          )}


                          <View style={ms.ticketSlotBadge}>
                            <Text style={ms.ticketSlotBadgeText}>
                              {item.tierName || ticketType} {item.slotNumber}/{item.totalInTier}
                            </Text>
                          </View>

                          <View style={ms.miniQrWrap}>
                            <View
                              style={[
                                ms.miniQrContainer,
                                {
                                  padding: miniQrPadding,
                                  borderRadius: miniQrPadding + 12,
                                  elevation: 0,
                                  shadowOpacity: 0,
                                  overflow: 'hidden',
                                },
                              ]}
                            >
                              <BlurView
                                blurMethod="dimezisBlurView"
                                intensity={50}
                                tint="light"
                                style={StyleSheet.absoluteFill}
                              />
                              <LinearGradient
                                colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.15)']}
                                style={StyleSheet.absoluteFill}
                              />
                              {eventEnded ? (
                                <View
                                  style={{
                                    width: miniQrSize,
                                    height: miniQrSize,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <Clock size={34} color="#5A5A5F" strokeWidth={1.8} />
                                  <Text
                                    style={{
                                      color: '#343438',
                                      fontSize: 12,
                                      fontWeight: '900',
                                      letterSpacing: 0.8,
                                    }}
                                  >
                                    EVENT ENDED
                                  </Text>
                                </View>
                              ) : (
                                <QRCode
                                  value={item.qrData}
                                  size={miniQrSize}
                                  color="#161616"
                                  backgroundColor="transparent"
                                />
                              )}
                            </View>
                          </View>
                        </Animated.View>

                        {/* BACK: Full QR code */}
                        <Animated.View style={[ms.cardFace, ms.cardBack, backStyle]}>
                          <View
                            style={[
                              ms.fullQrWrap,
                              { elevation: 0, shadowOpacity: 0, overflow: 'hidden' },
                            ]}
                          >
                            <BlurView
                              blurMethod="dimezisBlurView"
                              intensity={50}
                              tint="light"
                              style={StyleSheet.absoluteFill}
                            />
                            <LinearGradient
                              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.15)']}
                              style={StyleSheet.absoluteFill}
                            />
                            <QRCode
                              value={item.qrData}
                              size={fullQrSize}
                              color="#161616"
                              backgroundColor="transparent"
                            />
                          </View>
                          <Text style={ms.fullQrLabel}>Entry Pass</Text>
                          <Text style={ms.fullQrId}>{item.bookingLabel}</Text>
                        </Animated.View>
                      </View>
                    </View>
                  )}
                />

                {/* Show QR Code toggle */}
                <Pressable
                  disabled={eventEnded}
                  accessibilityState={{ disabled: eventEnded }}
                  onPress={handleFlip}
                  style={[ms.showQrBtn, eventEnded && { opacity: 0.5 }]}
                >
                  {eventEnded ? (
                    <Clock size={25} color="#fff" strokeWidth={2.1} />
                  ) : (
                    <ScanLine size={25} color="#fff" strokeWidth={2.1} />
                  )}
                  <Text style={ms.showQrText}>
                    {eventEnded ? 'Event Ended' : showQR ? 'Show Poster' : 'Show QR Code'}
                  </Text>
                </Pressable>

                {/* Claim Status Line */}
                <View style={ms.ticketHolderRow}>
                  <View style={ms.ticketHolderAvatar}>
                    {ticketSlots[activeTicketIndex]?.claimPhoto ? (
                      <Image
                        source={{ uri: ticketSlots[activeTicketIndex].claimPhoto }}
                        style={ms.ticketHolderAvatarImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={ms.ticketHolderAvatarText}>{ticketSlots[activeTicketIndex]?.claimInitials}</Text>
                    )}
                  </View>
                  <View style={{ marginLeft: 8, marginRight: 6, flex: 1, maxWidth: 172 }}>
                    <Text style={[ms.ticketHolderName, { marginLeft: 0, marginRight: 0 }]} numberOfLines={1}>
                      {ticketSlots[activeTicketIndex]?.claimName}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                      {ticketSlots[activeTicketIndex]?.bookingLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      ms.ticketStatusPill,
                      ticketSlots[activeTicketIndex]?.statusTone === 'available' && ms.ticketStatusPillAvailable,
                      ticketSlots[activeTicketIndex]?.statusTone === 'used' && ms.ticketStatusPillUsed,
                    ]}
                  >
                    <Text style={ms.ticketStatusPillText}>
                      {ticketSlots[activeTicketIndex]?.statusTone === 'available'
                        ? 'NOT CLAIMED'
                        : ticketSlots[activeTicketIndex]?.statusTone === 'used'
                          ? 'USED'
                          : 'CLAIMED'}
                    </Text>
                  </View>
                </View>

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
                    icon={Share2}
                    label={sharingClosed ? 'Sharing Closed' : 'Share Claim Link'}
                    disabled={sharingClosed}
                    onPress={() => setActiveSheet('share')}
                  />
                  <View style={ms.actionRowDivider} />
                  <ActionRow
                    icon={ArrowRightCircle}
                    label={transferClosed ? 'Transfers Closed' : 'Transfer Tickets'}
                    disabled={transferClosed}
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
                    label={Platform.OS === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet'}
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

                {/* ─── Cover Wallet Section ─── */}
                {activeWallet && (
                  <View style={[ms.walletCardWrap, { width: cardWidth, alignSelf: 'center' }]}>
                    <View style={ms.walletGlassCard}>
                      <BlurView
                        blurMethod="dimezisBlurView"
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={[
                          'rgba(255,255,255,0.08)',
                          'rgba(244,74,34,0.05)',
                          'rgba(255,255,255,0.02)',
                        ]}
                        locations={[0, 0.5, 1]}
                        style={StyleSheet.absoluteFill}
                      />

                      {/* Wallet State Badge */}
                      <View style={ms.walletBadgeRow}>
                        <View
                          style={[
                            ms.walletStateBadge,
                            {
                              backgroundColor:
                                activeWallet.state === 'ACTIVE'
                                  ? 'rgba(0,214,143,0.15)'
                                  : activeWallet.state === 'PENDING'
                                    ? 'rgba(255,170,0,0.15)'
                                    : 'rgba(255,61,113,0.15)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              ms.walletStateBadgeText,
                              {
                                color:
                                  activeWallet.state === 'ACTIVE'
                                    ? colors.success
                                    : activeWallet.state === 'PENDING'
                                      ? colors.warning
                                      : colors.error,
                              },
                            ]}
                          >
                            {activeWallet.state === 'ACTIVE'
                              ? 'ACTIVE'
                              : activeWallet.state === 'PENDING'
                                ? 'LOCKED'
                                : activeWallet.state}
                          </Text>
                        </View>
                      </View>

                      {/* Balance */}
                      <Text style={ms.walletBalanceLabel}>Cover Charge Balance</Text>
                      <Text style={ms.walletBalanceAmount}>
                        {formatRupees(activeWallet.currentBalancePaise)}
                      </Text>
                      <Text style={ms.walletOpeningBalance}>
                        Opening: {formatRupees(activeWallet.openingBalancePaise)}
                      </Text>

                      {/* Divider */}
                      <View style={ms.walletCardDivider} />

                      {/* QR Code Section */}
                      {activeWallet.state === 'ACTIVE' ? (
                        <View style={ms.walletQrSection}>
                          <Text style={ms.walletQrLabel}>Pay at Bar</Text>
                          <Text style={ms.walletQrHint}>
                            Show this QR to the bartender to pay from your cover balance
                          </Text>
                          <View style={ms.walletQrContainer}>
                            {qrRotating ? (
                              <>
                                <BlurView
                                  blurMethod="dimezisBlurView"
                                  intensity={30}
                                  tint="light"
                                  style={StyleSheet.absoluteFill}
                                />
                                <QRCode
                                  value={qrJwt}
                                  size={walletQrSize}
                                  color="#161616"
                                  backgroundColor="transparent"
                                />
                              </>
                            ) : (
                              <View style={ms.walletQrPlaceholder}>
                                <Text style={ms.walletQrPlaceholderText}>Loading QR...</Text>
                              </View>
                            )}
                          </View>
                          <View style={ms.walletQrTimerRow}>
                            <Clock size={12} color="rgba(255,255,255,0.35)" />
                            <Text style={ms.walletQrTimerText}>Refreshes in {qrTimeLeft}s</Text>
                          </View>
                          {qrRefreshError && (
                            <Text style={ms.walletQrRetryText}>
                              Could not refresh — previous code still active
                            </Text>
                          )}
                        </View>
                      ) : activeWallet.state === 'PENDING' ? (
                        <View style={ms.walletLockedBanner}>
                          <Text style={ms.walletLockedIcon}>🔒</Text>
                          <Text style={ms.walletLockedTitle}>Wallet Locked</Text>
                          <Text style={ms.walletLockedSubtitle}>
                            Check in at the venue to unlock your cover balance.
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Transaction History */}
                    <View style={ms.walletHistorySection}>
                      <View style={ms.walletHistoryHeader}>
                        <ArrowDownUp size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                        <Text style={ms.walletHistoryTitle}>Transaction History</Text>
                      </View>

                      {!walletTransactions || walletTransactions.length === 0 ? (
                        <View style={ms.walletHistoryEmpty}>
                          <Text style={ms.walletHistoryEmptyText}>No transactions yet</Text>
                        </View>
                      ) : (
                        walletTransactions.map((txn: any, i: number) => (
                          <View key={txn.id || i} style={ms.walletHistoryRow}>
                            <View style={ms.walletHistoryLeft}>
                              <Text style={ms.walletHistoryItemName}>
                                {txn.presetItemName ||
                                  (txn.type === 'TOP_UP'
                                    ? 'Top Up'
                                    : txn.type === 'REVERSAL'
                                      ? 'Reversal'
                                      : txn.type === 'DEBIT'
                                        ? 'Charge'
                                        : txn.type)}
                              </Text>
                              <Text style={ms.walletHistoryTime}>
                                {formatTxnDate(txn.createdAt)} {formatTxnTime(txn.createdAt)}
                              </Text>
                            </View>
                            <Text
                              style={[
                                ms.walletHistoryAmount,
                                {
                                  color:
                                    txn.type === 'DEBIT' || txn.type === 'EXPIRY_FORFEIT'
                                      ? colors.error
                                      : colors.success,
                                },
                              ]}
                            >
                              {txn.type === 'DEBIT' || txn.type === 'EXPIRY_FORFEIT' ? '-' : '+'}
                              {formatRupees(txn.amountPaise)}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {/* ─── Ticket Breakdown ─── */}
                <View style={ms.breakdownCard}>
                  <Text style={ms.breakdownTitle}>Ticket Breakdown</Text>
                  {order.tickets?.map((t, i) => {
                    const price = t.price ?? 0;
                    const qty = t.quantity ?? 1;
                    const genderReq = t.requiredGender || (t as any).genderRestriction;
                    return (
                      <View key={i} style={ms.breakdownRow}>
                        <View style={ms.breakdownLabelRow}>
                          <Text style={ms.breakdownLabel}>
                            {t.tierName || 'Ticket'} × {qty}
                          </Text>
                          {genderReq && genderReq !== 'any' && genderReq !== 'none' && (
                            <View
                              style={[
                                ms.genderRestrictionPill,
                                { backgroundColor: genderReq === 'female' ? '#FF1493' : '#4A90D9' },
                              ]}
                            >
                              <Text style={ms.genderRestrictionPillText}>
                                {genderReq === 'female' ? 'FEMALE' : genderReq.toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
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

      <ActionSheet
        isVisible={activeSheet === 'share'}
        onClose={() => setActiveSheet(null)}
        title="Share Tickets"
      >
        <ShareSheetContent tickets={order.tickets} onShare={handleShareChannel} />
      </ActionSheet>
    </Fragment>
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
    marginBottom: 2,
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
  ticketPagerPage: {
    alignItems: 'center',
  },
  ticketSlotBadge: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    maxWidth: '52%',
  },
  ticketSlotBadgeText: {
    color: '#FFFFFF',
    fontFamily: ticketFont.bold,
    fontSize: 13,
    fontWeight: '800',
  },
  ticketHolderRow: {
    maxWidth: 360,
    minHeight: 36,
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    marginTop: 0,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketHolderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ticketHolderAvatarImage: {
    width: '100%',
    height: '100%',
  },
  ticketHolderAvatarText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 12,
    fontWeight: '900',
  },
  ticketHolderName: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
    marginRight: 6,
    maxWidth: 172,
  },
  ticketStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,214,143,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.26)',
  },
  ticketStatusPillAvailable: {
    backgroundColor: 'rgba(255,184,0,0.16)',
    borderColor: 'rgba(255,184,0,0.26)',
  },
  ticketStatusPillUsed: {
    backgroundColor: 'rgba(255,61,113,0.16)',
    borderColor: 'rgba(255,61,113,0.26)',
  },
  ticketStatusPillText: {
    color: '#fff',
    fontFamily: ticketFont.bold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
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
  posterBookingBadge: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  posterBookingText: {
    color: '#FFFFFF',
    fontFamily: ticketFont.black,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
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
    padding: 16,
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
    marginBottom: 12,
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
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  genderRestrictionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  genderRestrictionPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // ── Wallet UI ──
  walletCardWrap: {
    paddingVertical: 16,
    width: '100%',
  },
  walletGlassCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  walletBadgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  walletStateBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  walletStateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  walletBalanceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  walletBalanceAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    fontFamily: ticketFont.black,
    marginTop: 4,
  },
  walletOpeningBalance: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 4,
  },
  walletCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  walletQrSection: {
    alignItems: 'center',
  },
  walletQrLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  walletQrHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  walletQrContainer: {
    width: 200,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  walletQrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  walletQrPlaceholderText: {
    color: 'rgba(0,0,0,0.3)',
    fontSize: 13,
    fontWeight: '600',
  },
  walletQrTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  walletQrTimerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  walletQrRetryText: {
    color: 'rgba(255,170,0,0.6)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  walletLockedBanner: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  walletLockedIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  walletLockedTitle: {
    color: '#FFAA00',
    fontSize: 16,
    fontWeight: '700',
  },
  walletLockedSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  walletHistorySection: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  walletHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  walletHistoryTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  walletHistoryEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  walletHistoryEmptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },
  walletHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  walletHistoryLeft: {
    flex: 1,
  },
  walletHistoryItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  walletHistoryTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  walletHistoryAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: ticketFont.bold,
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

  const computedQuantity =
    order.tickets?.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0) || 0;
  const totalGuests = (order as any).totalGuests ?? computedQuantity;
  const hostName = (order as any).hostName || (order as any).promoterName || '';
  const bookingLabel = formatBookingCode(order);

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
        scale.value = withTiming(0.96, { duration: 250 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 250 });
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
          <AnimatedExpoImage
            sharedTransitionTag={`ticket-poster-${order.id}`}
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

        {/* Solid black bottom section below perforated line */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 42,
            backgroundColor: '#000',
          }}
        />

        {/* Ticket Border Outline (placed behind notches so notches can mask it) */}
        <View style={styles.ticketBorder} collapsable={false}>
          <View style={{ width: 0, height: 0 }} />
        </View>

        <View pointerEvents="none" style={styles.ticketPerforation}>
          {TICKET_PERFORATION_DASHES.map((_, dashIndex) => (
            <View key={dashIndex} style={styles.ticketPerforationDash} />
          ))}
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
              'rgba(255, 105, 180, 0.15)',
              'rgba(0, 255, 255, 0.25)',
              'rgba(147, 112, 219, 0.15)',
              'rgba(255, 255, 255, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View pointerEvents="none" style={[styles.ticketNotch, styles.ticketNotchLeft]} />
        <View pointerEvents="none" style={[styles.ticketNotch, styles.ticketNotchRight]} />

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
            <Text style={styles.ticketBookingCode}>{bookingLabel}</Text>
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

// Animated Segmented Control Header
function SegmentedHeader({
  activeTab,
  onTabChange,
  upcomingCount,
  pastCount,
  scrollX,
}: {
  activeTab: TicketTab;
  onTabChange: (tab: TicketTab) => void;
  upcomingCount: number;
  pastCount: number;
  scrollX: SharedValue<number>;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const avatarPhoto = resolveCurrentUserPhoto(profile, user);
  const avatarInitials = (profile?.displayName || user?.displayName || '')
    .split(' ')
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleTabPress = (tab: TicketTab) => {
    onTabChange(tab);
  };

  const animatedBgStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [0, windowWidth],
      [0, TICKET_FILTER_THUMB_WIDTH],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        style={[styles.avatarCircle, { width: 36, height: 36, borderRadius: 18 }]}
      >
        <Wallet size={20} color={colors.gold} strokeWidth={2.5} />
      </Pressable>

      <View style={styles.segmentedContainer}>
        <BlurView
          blurMethod="dimezisBlurView"
          intensity={24}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
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
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/profile');
        }}
        style={[styles.avatarCircle, { width: 36, height: 36, borderRadius: 18 }]}
      >
        {avatarPhoto ? (
          <Image source={{ uri: avatarPhoto }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            {avatarInitials ? (
              <Text style={[styles.avatarInitial, { fontSize: 14 }]}>{avatarInitials}</Text>
            ) : (
              <User size={18} color={colors.gold} strokeWidth={2.5} />
            )}
          </View>
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
  const {
    user,
    loading: authLoading,
    initialized: authInitialized,
    authSyncFailed,
  } = useAuthStore();
  const stats = (user as any)?.stats ?? {};
  const kpiActiveLinks = stats.activeLinks ?? 0;
  const kpiClicks = stats.totalClicks ?? 0;
  const kpiSales = stats.totalSales ?? 0;
  const kpiEarnings = stats.totalEarnings ?? 0;

  const pendingReservation = useCartStore((state) => state.pendingReservation);
  const pendingPaymentOrderId = useCartStore((state) => state.pendingPaymentOrderId);
  const clearPendingReservation = useCartStore((state) => state.clearPendingReservation);
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [activeTab, setActiveTab] = useState<TicketTab>('upcoming');
  const activeTabRef = useRef<TicketTab>('upcoming');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [storeOrdersUserId, setStoreOrdersUserId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [globalWalletData, setGlobalWalletData] = useState<any>(null);
  const [globalWalletTxns, setGlobalWalletTxns] = useState<any[]>([]);

  const fetchWallet = async (requestedUserId: string) => {
    try {
      const data = await deduplicateRequest<any>(
        `tickets:cover-charge-wallet:${requestedUserId}`,
        () => apiFetch('/api/v1/cover-charge/me'),
      );
      if (useAuthStore.getState().user?.uid !== requestedUserId) return;
      if (data.wallet) {
        setGlobalWalletData(data.wallet);
        setGlobalWalletTxns(data.transactions || []);
      } else {
        setGlobalWalletData(null);
        setGlobalWalletTxns([]);
      }
    } catch {
      if (useAuthStore.getState().user?.uid !== requestedUserId) return;
      setGlobalWalletData(null);
      setGlobalWalletTxns([]);
    }
  };
  const loadCountRef = useRef(0);
  const scrollX = useSharedValue(0);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const changeTicketTab = useCallback((tab: TicketTab) => {
    if (activeTabRef.current === tab) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    void Haptics.selectionAsync();
  }, []);

  useEffect(() => {
    scrollX.value = withTiming(activeTab === 'upcoming' ? 0 : windowWidth, { duration: 180 });
  }, [activeTab, scrollX, windowWidth]);

  const ticketTabSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          const shouldSwitch =
            Math.abs(event.translationX) >= TICKET_TAB_SWIPE_DISTANCE ||
            Math.abs(event.velocityX) >= TICKET_TAB_SWIPE_VELOCITY;
          if (!shouldSwitch) return;
          runOnJS(changeTicketTab)(event.translationX < 0 ? 'past' : 'upcoming');
        }),
    [changeTicketTab],
  );

  useEffect(() => {
    trackScreen('Tickets');
    loadCountRef.current += 1;
    setCachedOrders([]);
    setStoreOrdersUserId(null);
    setIsOffline(false);
    setGlobalWalletData(null);
    setGlobalWalletTxns([]);
    setSelectedOrder(null);
    setShowQRModal(false);
    if (user?.uid) void loadData(user.uid);
  }, [user?.uid]);

  const loadData = async (requestedUserId = user?.uid) => {
    if (!requestedUserId || requestedUserId !== useAuthStore.getState().user?.uid) return;
    void fetchWallet(requestedUserId);

    const loadId = ++loadCountRef.current;

    const cached = await getCachedUserOrders(requestedUserId);
    if (
      loadId !== loadCountRef.current ||
      useAuthStore.getState().user?.uid !== requestedUserId
    ) {
      return;
    }
    if (cached.data && cached.data.length > 0) {
      setCachedOrders(cached.data);
    }

    try {
      await fetchUserOrders();
      if (
        loadId !== loadCountRef.current ||
        useAuthStore.getState().user?.uid !== requestedUserId
      ) {
        return;
      }
      const store = useTicketsStore.getState();
      if (store.error) {
        setIsOffline(true);
      } else {
        setStoreOrdersUserId(requestedUserId);
        await cacheUserOrders(requestedUserId, store.orders);
        if (
          loadId !== loadCountRef.current ||
          useAuthStore.getState().user?.uid !== requestedUserId
        ) {
          return;
        }
        setIsOffline(false);
      }
    } catch (err) {
      if (loadId === loadCountRef.current) setIsOffline(true);
    }
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  const orders = storeOrdersUserId === user?.uid ? storeOrders : [];
  const loading = storeLoading;
  const displayOrders = user?.uid
    ? (loading || isOffline) && orders.length === 0
      ? cachedOrders
      : orders
    : [];
  const nowMs = Date.now();

  const upcomingOrders = displayOrders.filter((order) => !isOrderEventEnded(order, nowMs));
  const pastOrders = displayOrders.filter((order) => isOrderEventEnded(order, nowMs));
  const displayedOrders = activeTab === 'upcoming' ? upcomingOrders : pastOrders;
  const walletIsEmpty = upcomingOrders.length === 0 && pastOrders.length === 0;
  const showPendingReservationBanner =
    Boolean(pendingReservation) && Boolean(pendingPaymentOrderId);
  const pendingReservationExpired =
    showPendingReservationBanner && new Date(pendingReservation!.expiresAt).getTime() <= Date.now();
  const getFlattened = useCallback((ordersList: Order[], isUpcoming: boolean) => {
    const groups = new Map<string, Order[]>();
    ordersList.forEach((order) => {
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
        return isUpcoming ? leftTime - rightTime : rightTime - leftTime;
      }),
    })).flatMap((g) => g.orders);
  }, []);

  const upcomingFlattened = useMemo(() => getFlattened(upcomingOrders, true), [getFlattened, upcomingOrders]);
  const pastFlattened = useMemo(() => getFlattened(pastOrders, false), [getFlattened, pastOrders]);

  // If opened via deep link, auto-open the order sheet.
  useEffect(() => {
    if (!user?.uid || !orderId) return;
    const linkedOrder = displayedOrders.find((o) => o.id === orderId);
    if (linkedOrder) {
      setSelectedOrder(linkedOrder);
      setShowQRModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders, cachedOrders, user?.uid]);

  useEffect(() => {
    if (!selectedOrder) return;
    const refreshedOrder = displayOrders.find((order) => order.id === selectedOrder.id);
    if (refreshedOrder) {
      if (refreshedOrder !== selectedOrder) {
        setSelectedOrder(refreshedOrder);
      }
    } else {
      // Order was removed from wallet — close modal and clear selection
      setShowQRModal(false);
      setSelectedOrder(null);
    }
  }, [displayOrders, selectedOrder]);

  const authPending = authLoading || !authInitialized;
  if (authPending || !user?.uid) {
    const sessionUnavailable = !authPending && authSyncFailed;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{authPending ? '🎟️' : '🔒'}</Text>
          <Text style={styles.emptyTitle}>
            {authPending
              ? 'Loading your wallet…'
              : sessionUnavailable
                ? 'We could not verify your session.'
                : 'Sign in to view your tickets'}
          </Text>
          <Text style={styles.emptyText}>
            {authPending
              ? 'Your tickets will appear as soon as your session is ready.'
              : sessionUnavailable
                ? 'Sign in again to securely reload your ticket wallet.'
                : 'Your purchased, shared, and claimed tickets are kept private to your account.'}
          </Text>
          {!authPending ? (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/(auth)/login',
                  params: { returnTo: '/(tabs)/tickets' },
                });
              }}
              style={styles.emptyButton}
            >
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>Sign In</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* QR Modal */}
      {selectedOrder ? (
        <QRModal
          visible={showQRModal}
          order={selectedOrder}
          onClose={() => setShowQRModal(false)}
          walletData={globalWalletData}
          walletTransactions={globalWalletTxns}
          onWalletRefresh={loadData}
        />
      ) : null}

      <View style={styles.header}>
        <SegmentedHeader
          activeTab={activeTab}
          onTabChange={changeTicketTab}
          upcomingCount={upcomingOrders.length}
          pastCount={pastOrders.length}
          scrollX={scrollX}
        />

        {showPendingReservationBanner && pendingReservation ? (
          <View style={styles.pendingReservationCard}>
            <View style={styles.pendingReservationCopy}>
              <Text style={styles.pendingReservationEyebrow}>
                {pendingReservationExpired ? 'Reservation Expired' : 'Incomplete Payment'}
              </Text>
              <Text style={styles.pendingReservationTitle}>
                {pendingReservationExpired
                  ? 'Your ticket reservation has expired. You can still try to complete payment.'
                  : pendingReservation.eventTitle || 'Your reserved tickets are waiting'}
              </Text>
            </View>
            <View style={styles.pendingReservationActions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  clearPendingReservation();
                }}
              >
                <Text style={styles.pendingReservationDismiss}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/checkout');
                }}
                style={styles.pendingReservationButton}
              >
                <Text style={styles.pendingReservationButtonText}>Resume</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {error && !loading && displayOrders.length > 0 && (
        <View style={styles.walletSyncBanner}>
          <Text style={styles.walletSyncText} numberOfLines={2}>
            Wallet sync failed. Showing saved tickets.
          </Text>
          <Pressable onPress={onRefresh} style={styles.walletSyncRetry}>
            <Text style={styles.walletSyncRetryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {loading && displayOrders.length === 0 && <SkeletonList count={3} />}

      {error && !loading && displayOrders.length === 0 && !isOffline && (
        <ErrorState
          message="Failed to load your tickets. Please try again."
          onRetry={onRefresh}
        />
      )}

      {isOffline && displayOrders.length === 0 && !loading && (
        <NetworkError onRetry={onRefresh} />
      )}

      <GestureDetector gesture={ticketTabSwipeGesture}>
        <View style={{ flex: 1 }}>
          {activeTab === 'upcoming' ? (
          <FlatList
            data={upcomingFlattened}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: any) => (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <TicketCard
                  order={item}
                  onShowQR={() => {
                    setSelectedOrder(item);
                    setShowQRModal(true);
                  }}
                  index={index}
                />
              </View>
            )}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={[
              { paddingBottom: 120 },
              upcomingFlattened.length === 0 && { flexGrow: 1 },
            ]}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.iris} />
            }
            ListEmptyComponent={
              !loading && upcomingFlattened.length === 0 && !error ? (
                <Animated.View entering={FadeIn.delay(200)} style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🎟️</Text>
                  <Text style={styles.emptyTitle}>
                    {walletIsEmpty ? 'Your wallet is empty.' : 'No Upcoming Tickets'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {walletIsEmpty ? 'Find your next party and grab a ticket.' : 'Your purchased tickets will appear here'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/(tabs)/explore');
                    }}
                    style={styles.emptyButton}
                  >
                    <LinearGradient
                      colors={gradients.primary as [string, string]}
                      style={styles.emptyButtonGradient}
                    >
                      <Text style={styles.emptyButtonText}>Explore Events</Text>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              ) : null
            }
          />
          ) : (
          <FlatList
            data={pastFlattened}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: any) => (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <TicketCard
                  order={item}
                  onShowQR={() => {
                    setSelectedOrder(item);
                    setShowQRModal(true);
                  }}
                  index={index}
                />
              </View>
            )}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={[
              { paddingBottom: 120 },
              pastFlattened.length === 0 && { flexGrow: 1 },
            ]}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.iris} />
            }
            ListEmptyComponent={
              !loading && pastFlattened.length === 0 && !error ? (
                <Animated.View entering={FadeIn.delay(200)} style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🎟️</Text>
                  <Text style={styles.emptyTitle}>
                    {walletIsEmpty ? 'Your wallet is empty.' : 'No Past Tickets'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {walletIsEmpty ? 'Find your next party and grab a ticket.' : 'Your attended events will appear here'}
                  </Text>
                  {walletIsEmpty && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/(tabs)/explore');
                      }}
                      style={styles.emptyButton}
                    >
                      <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.emptyButtonGradient}
                      >
                        <Text style={styles.emptyButtonText}>Explore Events</Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                </Animated.View>
              ) : null
            }
          />
          )}
        </View>
      </GestureDetector>
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
    paddingTop: 24,
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
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.base[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
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
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 24,
    zIndex: 1,
  },
  ticketPerforation: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 42,
    zIndex: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketPerforationDash: {
    width: 7,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ticketNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#070708',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 6,
  },
  ticketNotchLeft: {
    left: -8,
  },
  ticketNotchRight: {
    right: -8,
  },
  ticketContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 14,
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
  ticketBookingCode: {
    overflow: 'hidden',
    color: '#161616',
    backgroundColor: 'rgba(255,255,255,0.92)',
    fontFamily: ticketFont.black,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    fontVariant: ['tabular-nums'],
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
  walletSyncBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: 'rgba(255, 61, 113, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 113, 0.28)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletSyncText: {
    flex: 1,
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  walletSyncRetry: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  walletSyncRetryText: {
    color: colors.goldLight,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.gold,
    fontFamily: ticketFont.black,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0,
  },
  emptyText: {
    color: colors.goldMetallic,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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

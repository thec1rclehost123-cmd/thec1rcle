import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { trackPurchaseFailed, trackTicketPurchase } from '@/lib/analytics';
import { calculatePricing, type PricingResult } from '@/lib/api';
import { colors, gradients, typography } from '@/lib/design/theme';
import { discardPendingCheckout, processFullCheckout, type CheckoutStatus } from '@/lib/payments';
import { formatEventDate, formatEventTime } from '@/lib/utils/date';
import { formatInr } from '@/lib/money';
import { useAuthStore } from '@/store/authStore';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { useEventsStore, type Event } from '@/store/eventsStore';
import { useProfileStore } from '@/store/profileStore';
import { useSubscriptionStore, type PremiumFeature } from '@/store/subscriptionStore';

let _pricingCache: {
  key: string;
  data: PricingResult['pricing'];
  timestamp: number;
} | null = null;
const PRICING_CACHE_TTL = 30_000;
const PRIVACY_POLICY_URL = 'https://thec1rcle.com/privacy';

function getPricingCacheKey(
  eventId: string,
  items: { tierId: string; quantity: number }[],
  promoCode: string | null,
  promoterCode: string | null,
) {
  return `${eventId}:${JSON.stringify(items)}:${promoCode ?? ''}:${promoterCode ?? ''}`;
}

function getCachedPricing(key: string) {
  if (!_pricingCache || _pricingCache.key !== key) return null;
  if (Date.now() - _pricingCache.timestamp > PRICING_CACHE_TTL) return null;
  return _pricingCache.data;
}

function setCachedPricing(key: string, data: PricingResult['pricing']) {
  _pricingCache = { key, data, timestamp: Date.now() };
}

const checkoutFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

function getCheckoutStatusLabel(status: CheckoutStatus | null) {
  switch (status) {
    case 'reserving':
      return 'Reserving tickets';
    case 'initiating':
      return 'Creating order';
    case 'awaiting_payment':
      return 'Opening Razorpay';
    case 'verifying':
      return 'Verifying payment';
    case 'confirmed':
      return 'Confirmed';
    case 'failed':
      return 'Payment failed';
    case 'cancelled':
      return 'Payment cancelled';
    default:
      return 'Secure checkout';
  }
}

function premiumFeatureFromError(error: any): PremiumFeature {
  const feature = error?.details?.feature;
  if (feature === 'premiumOnlyEvent' || feature === 'earlyAccessDrop') return feature;
  return 'premiumOnlyEvent';
}

function CheckoutConfirmationHandoff({
  status,
  eventTitle,
}: {
  status: CheckoutStatus | null;
  eventTitle: string;
}) {
  const confirmed = status === 'confirmed';

  return (
    <SafeAreaView style={styles.handoffScreen}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,74,34,0.24)', 'rgba(0,0,0,0.74)', colors.base.DEFAULT]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.handoffContent}>
        <View style={styles.handoffIconWrap}>
          {confirmed ? (
            <Ionicons name="checkmark" size={38} color="#fff" />
          ) : (
            <ActivityIndicator color="#fff" size="large" />
          )}
        </View>
        <Text style={styles.handoffTitle}>{confirmed ? "You're in" : 'Confirming payment'}</Text>
        <Text style={styles.handoffCopy}>
          {confirmed
            ? 'Taking you to your ticket confirmation.'
            : 'Razorpay approved the payment. We are issuing your ticket now.'}
        </Text>
        <Text style={styles.handoffEvent} numberOfLines={2}>
          {eventTitle}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function PromoModal({
  visible,
  onClose,
  onApply,
  promoError,
  setPromoError,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
  promoError: string | null;
  setPromoError: (err: string | null) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setInput('');
      setPromoError(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, setPromoError]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={70}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promo Code</Text>
            <Text style={styles.modalSubtitle}>Enter a code to get a discount</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                ref={inputRef}
                placeholder="SAVE20"
                placeholderTextColor="rgba(254,248,232,0.3)"
                value={input}
                onChangeText={(text) => {
                  setInput(text);
                  setPromoError(null);
                }}
                autoCapitalize="characters"
                style={styles.modalInput}
              />
              <Pressable
                onPress={() => onApply(input.trim().toUpperCase())}
                style={({ pressed }) => [styles.modalApplyButton, pressed && { opacity: 0.8 }]}
              >
                <LinearGradient
                  colors={gradients.primary as [string, string]}
                  style={styles.modalApplyGradient}
                >
                  <Text style={styles.modalApplyText}>Apply</Text>
                </LinearGradient>
              </Pressable>
            </View>
            {promoError ? (
              <View style={styles.modalErrorRow}>
                <Ionicons name="alert-circle" size={14} color={colors.error} />
                <Text style={styles.modalErrorText}>{promoError}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GlassCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay)} style={styles.glassCard}>
      <BlurView
        blurMethod="dimezisBlurView"
        intensity={55}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassCardInner}>{children}</View>
    </Animated.View>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const {
    items,
    promo,
    reservationExpiry,
    pendingPaymentOrderId,
    pendingReservation,
    removeItem,
    updateQuantity,
    clearPendingReservation,
    applyPromoCode,
    clearPromoCode,
  } = useCartStore();
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);
  const getEventById = useEventsStore((state) => state.getEventById);

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [billingEmail, setBillingEmail] = useState(profile?.email || user?.email || '');
  const [pricing, setPricing] = useState<PricingResult['pricing'] | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [hostUpdatesOptIn, setHostUpdatesOptIn] = useState(false);
  const [reservationClock, setReservationClock] = useState(Date.now());
  const [authoritativeEvent, setAuthoritativeEvent] = useState<Event | null>(null);

  const reservationExpiresAt = pendingReservation
    ? new Date(pendingReservation.expiresAt).getTime()
    : null;
  const cartExpired = Boolean(
    reservationExpiresAt &&
    Number.isFinite(reservationExpiresAt) &&
    reservationExpiresAt <= reservationClock,
  );
  const reservationSecondsLeft = reservationExpiresAt
    ? Math.max(0, Math.ceil((reservationExpiresAt - reservationClock) / 1000))
    : 0;

  const cartEventTitle = items[0]?.eventTitle || 'Your booking';
  const cartEventDate = items[0]?.eventDate || '';
  const cartEventTimezone = items[0]?.eventTimezone;
  const cartEventVenue = items[0]?.eventVenue || 'Venue TBA';
  const cartEventImage = items[0]?.eventCoverImage;
  const cartEventAccentColor = items[0]?.eventAccentColor;
  const eventId = items[0]?.eventId || '';
  const displayEventDate = authoritativeEvent?.startDate || cartEventDate;
  const displayEventTimezone = authoritativeEvent?.timezone || cartEventTimezone;
  const promoterCode = items.find((item) => item.promoterCode)?.promoterCode;
  const ticketCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hostLabel = cartEventVenue === 'Venue TBA' ? 'the host' : cartEventVenue;
  const checkoutItems = useMemo(
    () => items.map((item) => ({ tierId: item.tier.id, quantity: item.quantity })),
    [items],
  );

  const localSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
  }, [items]);

  const fetchPricing = useCallback(() => {
    if (!eventId || checkoutItems.length === 0) {
      setPricing(null);
      setQuoteError(null);
      return;
    }

    const cacheKey = getPricingCacheKey(
      eventId,
      checkoutItems,
      promo?.code ?? null,
      promoterCode ?? null,
    );
    const cached = getCachedPricing(cacheKey);
    if (cached) {
      setPricing(cached);
      setQuoteLoading(false);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    calculatePricing({
      eventId,
      items: checkoutItems,
      promoCode: promo?.code ?? null,
      promoterCode: promoterCode ?? null,
    })
      .then((result) => {
        setCachedPricing(cacheKey, result.pricing);
        setPricing(result.pricing);
      })
      .catch((error: any) => {
        if (error.code === 'PREMIUM_REQUIRED') {
          openPaywall(premiumFeatureFromError(error), error.message);
        }
        setPricing(null);
        setQuoteError(error.message || 'We could not refresh live pricing.');
      })
      .finally(() => {
        setQuoteLoading(false);
      });
  }, [checkoutItems, eventId, openPaywall, promo?.code, promoterCode]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  useEffect(() => {
    let active = true;
    setAuthoritativeEvent(null);
    if (!eventId)
      return () => {
        active = false;
      };
    void getEventById(eventId, true).then((event) => {
      if (active) setAuthoritativeEvent(event);
    });
    return () => {
      active = false;
    };
  }, [eventId, getEventById]);

  useEffect(() => {
    if (!pendingReservation) return;
    setReservationClock(Date.now());
    const timer = setInterval(() => setReservationClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pendingReservation]);

  // Remove legacy client-only timers. A reservation countdown is valid only
  // after the backend has returned a real reservation id and expiry.
  useEffect(() => {
    if (!pendingReservation && !pendingPaymentOrderId && reservationExpiry) {
      clearPendingReservation();
    }
  }, [clearPendingReservation, pendingPaymentOrderId, pendingReservation, reservationExpiry]);

  const subtotal = Number(pricing?.subtotal ?? localSubtotal);
  const discount = Number(
    pricing?.discountTotal ?? pricing?.discount ?? promo?.discountAmount ?? 0,
  );
  const platformFee = Number(
    pricing?.fees?.platform ?? pricing?.fees?.platformFee ?? pricing?.platformFee ?? 0,
  );
  const paymentFee = Number(pricing?.fees?.payment ?? pricing?.fees?.paymentFee ?? 0);
  const taxes = Number(pricing?.fees?.gst ?? 0);
  const total = Number(
    pricing?.grandTotal ?? Math.max(0, subtotal - discount + platformFee + paymentFee + taxes),
  );
  const isFreeOrder = Boolean(pricing?.isFree ?? total === 0);
  const bookingFeesWaived = pricing?.subscription?.bookingFeesWaived === true;
  const paymentMethodLabel = isFreeOrder ? 'Free checkout' : 'Razorpay';
  const paymentMethodDetail = isFreeOrder
    ? 'No payment required'
    : 'UPI, cards, wallets, netbanking';
  const billingEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim());
  const payDisabled = processing || quoteLoading || !!quoteError || !billingEmailValid;
  const payButtonLabel = processing
    ? getCheckoutStatusLabel(checkoutStatus)
    : cartExpired
      ? isFreeOrder
        ? 'Refresh & confirm'
        : `Refresh & pay ${formatInr(total)}`
      : isFreeOrder
        ? 'Confirm order'
        : `Pay ${formatInr(total)}`;
  const showingPaymentHandoff =
    processing && (checkoutStatus === 'verifying' || checkoutStatus === 'confirmed');

  const handleApplyPromo = async (code: string) => {
    if (!code || !eventId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromoError(null);
    try {
      await discardPendingCheckout();
    } catch {
      setPromoError('Could not release the current ticket hold. Please retry.');
      return;
    }
    const result = await applyPromoCode(code, eventId);
    if (!result.success) {
      setPromoError(result.error || 'This promo code is not available for this order.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPromoModal(false);
    setPromoInput('');
  };

  const handleRemovePromo = async () => {
    Haptics.selectionAsync();
    try {
      await discardPendingCheckout();
    } catch {
      Alert.alert('Tickets still held', 'Could not release the current hold. Please retry.');
      return;
    }
    clearPromoCode();
  };

  const handleQuantityChange = async (item: CartItem, quantity: number) => {
    if (processing) return;
    Haptics.selectionAsync();
    try {
      await discardPendingCheckout();
    } catch {
      Alert.alert('Tickets still held', 'Could not release the current hold. Please retry.');
      return;
    }
    updateQuantity(item.eventId, item.tier.id, quantity);
  };

  const handleRemoveItem = async (item: CartItem) => {
    if (processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await discardPendingCheckout();
    } catch {
      Alert.alert('Tickets still held', 'Could not release the current hold. Please retry.');
      return;
    }
    removeItem(item.eventId, item.tier.id);
  };

  const handlePaymentMethodChange = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Payment method',
      isFreeOrder
        ? 'This order does not require a payment method.'
        : 'Razorpay will open secure UPI, card, wallet, and bank options after inventory is reserved.',
      [{ text: 'OK' }],
    );
  };

  const handlePay = async () => {
    if (items.length === 0) return;
    if (!user?.uid) {
      Alert.alert('Sign in needed', 'Please sign in before checkout.');
      return;
    }
    const email = billingEmail.trim();
    if (!email) {
      Alert.alert('Email needed', 'Add an email for the ticket receipt.');
      return;
    }
    if (quoteError) {
      Alert.alert(
        'Live price unavailable',
        'Refresh pricing before checkout so the backend can confirm fees and inventory.',
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);

    const result = await processFullCheckout({
      eventId,
      eventTitle: cartEventTitle,
      items: checkoutItems,
      userName: profile?.displayName || user.displayName || email,
      userEmail: email,
      userPhone: profile?.phone || undefined,
      promoCode: promo?.code ?? undefined,
      promoterCode: promoterCode ?? undefined,
      hostUpdatesOptIn,
      onStatusChange: setCheckoutStatus,
    });

    if (!result.success || !result.orderId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setProcessing(false);
      if (result.premiumRequired) return;
      if (result.cancelled) {
        Alert.alert('Payment cancelled', 'No charge was made. Your ticket hold was released.');
        return;
      }
      trackPurchaseFailed(eventId, result.error || 'Checkout failed');
      Alert.alert(
        'Checkout failed',
        result.error || 'We could not complete checkout. Please try again.',
      );
      return;
    }

    trackTicketPurchase(eventId, 'Selected tickets', total, ticketCount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: '/checkout/success',
      params: {
        orderId: result.orderId,
        eventId,
        eventTitle: cartEventTitle,
        eventDate: displayEventDate,
        eventTimezone: displayEventTimezone || '',
        eventCoverImage: cartEventImage || '',
        accentColor: cartEventAccentColor || '',
        venueLocation: cartEventVenue,
        totalAmount: String(total),
        ticketCount: String(ticketCount),
        paymentMethod: result.requiresPayment ? 'Razorpay' : 'Free checkout',
      },
    });
  };

  if (showingPaymentHandoff) {
    return <CheckoutConfirmationHandoff status={checkoutStatus} eventTitle={cartEventTitle} />;
  }

  if (items.length === 0) {
    if (processing || checkoutStatus === 'confirmed') {
      return <CheckoutConfirmationHandoff status={checkoutStatus} eventTitle={cartEventTitle} />;
    }

    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyContent}>
          <LinearGradient
            colors={['rgba(244,74,34,0.15)', 'rgba(0,0,0,0)']}
            style={styles.emptyGlow}
          />
          <View style={styles.emptyIcon}>
            <Ionicons name="ticket-outline" size={28} color={colors.iris} />
          </View>
          <Text style={styles.emptyTitle}>No tickets selected</Text>
          <Text style={styles.emptyCopy}>
            Pick an event and choose ticket tiers before checkout.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace('/(tabs)/explore');
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Explore events</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          hexToRgba(cartEventAccentColor || '#F44A22', 0.25),
          'rgba(0,0,0,0.6)',
          colors.base.DEFAULT,
        ]}
        locations={[0, 0.35, 1]}
        style={styles.ambientGlow}
      />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={10}
            style={styles.headerBack}
          >
            <Ionicons name="chevron-back" size={24} color={colors.gold} />
          </Pressable>

          {promo ? (
            <Pressable onPress={handleRemovePromo} style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>{promo.code}</Text>
              <Ionicons name="close-circle" size={14} color={colors.success} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPromoModal(true);
              }}
              style={styles.promoButton}
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.gold} />
              <Text style={styles.promoButtonText}>Promo</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 260 }]}
      >
        <Animated.View entering={FadeInUp} style={styles.heroSection}>
          <View style={styles.heroPosterWrap}>
            {cartEventImage ? (
              <Image
                source={{ uri: cartEventImage }}
                style={styles.heroPoster}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.heroPoster}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
              style={styles.heroOverlay}
            />
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {cartEventTitle}
            </Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="calendar-outline" size={13} color="rgba(254,248,232,0.6)" />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {displayEventDate
                  ? `${formatEventDate(displayEventDate, displayEventTimezone)} · ${formatEventTime(displayEventDate, displayEventTimezone)}`
                  : 'Date TBA'}
              </Text>
            </View>
            <View style={styles.heroMetaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(254,248,232,0.6)" />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {cartEventVenue}
              </Text>
            </View>
          </View>
        </Animated.View>

        <GlassCard delay={80}>
          <View style={styles.cardSectionHeader}>
            <View style={styles.cardSectionHeading}>
              <Ionicons name="receipt-outline" size={15} color="rgba(254,248,232,0.6)" />
              <Text style={styles.cardSectionTitle}>Order Receipt</Text>
            </View>
            <Pressable
              onPress={async () => {
                Haptics.selectionAsync();
                try {
                  await discardPendingCheckout();
                } catch {
                  Alert.alert(
                    'Tickets still held',
                    'Could not release the current hold. Please retry.',
                  );
                  return;
                }
                router.push(`/checkout/${eventId}`);
              }}
              hitSlop={8}
            >
              <Text style={styles.editTicketsText}>Edit tickets</Text>
            </Pressable>
          </View>

          <View style={styles.ticketSummaryList}>
            {items.map((item) => (
              <View key={`${item.eventId}-${item.tier.id}`} style={styles.ticketSummaryRow}>
                <View style={styles.ticketSummaryLeft}>
                  <Text style={styles.ticketSummaryName} numberOfLines={1}>
                    {item.tier.name}
                  </Text>
                  <Text style={styles.ticketSummaryQty}>
                    {item.quantity} × {formatInr(item.tier.price)}
                  </Text>
                </View>
                <View style={styles.ticketSummaryRight}>
                  <Text style={styles.ticketSummaryTotal}>
                    {formatInr(item.tier.price * item.quantity)}
                  </Text>
                  <View style={styles.quantityControls}>
                    <Pressable
                      accessibilityLabel={`Decrease ${item.tier.name} quantity`}
                      disabled={processing}
                      onPress={() => handleQuantityChange(item, item.quantity - 1)}
                      style={styles.quantityButton}
                    >
                      <Ionicons name="remove" size={14} color="#fff" />
                    </Pressable>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <Pressable
                      accessibilityLabel={`Increase ${item.tier.name} quantity`}
                      disabled={
                        processing ||
                        item.quantity >=
                          Math.max(item.quantity, Math.min(10, Number(item.tier.remaining) || 10))
                      }
                      onPress={() => handleQuantityChange(item, item.quantity + 1)}
                      style={styles.quantityButton}
                    >
                      <Ionicons name="add" size={14} color="#fff" />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Remove ${item.tier.name} from cart`}
                      disabled={processing}
                      onPress={() => handleRemoveItem(item)}
                      hitSlop={6}
                      style={styles.removeTicketButton}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.priceLines}>
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>{formatInr(subtotal)}</Text>
            </View>
            {discount > 0 ? (
              <View style={styles.priceLine}>
                <Text style={[styles.priceLabel, styles.discountLabel]}>
                  {promo?.code ? `${promo.code}` : 'Discount'}
                </Text>
                <Text style={[styles.priceValue, styles.discountValue]}>
                  −{formatInr(discount)}
                </Text>
              </View>
            ) : null}
            {platformFee + paymentFee + taxes > 0 ? (
              <View style={styles.priceLine}>
                <Text style={styles.priceLabel}>Taxes & Fees</Text>
                <Text style={styles.priceValue}>{formatInr(platformFee + paymentFee + taxes)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatInr(total)}</Text>
          </View>

          {quoteLoading ? (
            <View style={styles.quoteIndicator}>
              <ActivityIndicator size="small" color={colors.irisGlow} />
              <Text style={styles.quoteIndicatorText}>Updating...</Text>
            </View>
          ) : null}

          {quoteError ? (
            <View style={styles.quoteErrorBox}>
              <Ionicons name="warning-outline" size={14} color={colors.error} />
              <Text style={styles.quoteErrorText}>{quoteError}</Text>
              <Pressable onPress={fetchPricing} hitSlop={8}>
                <Text style={styles.quoteRetryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* Payment Method integrated cleanly */}
          <Pressable onPress={handlePaymentMethodChange} style={styles.compactPaymentRow}>
            <View style={styles.compactPaymentLeft}>
              <Ionicons
                name={isFreeOrder ? 'checkmark-circle' : 'card'}
                size={16}
                color={colors.iris}
              />
              <Text style={styles.compactPaymentTitle}>{paymentMethodLabel}</Text>
            </View>
            <View style={styles.compactPaymentRight}>
              <Text style={styles.compactPaymentSubtitle}>{paymentMethodDetail}</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(254,248,232,0.3)" />
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Receipt Email integrated cleanly */}
          <View style={styles.compactEmailRow}>
            <Ionicons name="mail-outline" size={16} color="rgba(254,248,232,0.6)" />
            <TextInput
              placeholder="Email for receipt"
              placeholderTextColor="rgba(254,248,232,0.3)"
              value={billingEmail}
              onChangeText={setBillingEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              accessibilityLabel="Email for ticket receipt"
              style={styles.compactEmailInput}
            />
          </View>
          {!billingEmailValid && billingEmail.length > 0 ? (
            <Text style={styles.emailValidationText}>Enter a valid receipt email.</Text>
          ) : null}
        </GlassCard>

        <View style={styles.optInRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setHostUpdatesOptIn((v) => !v);
            }}
            style={[styles.checkbox, hostUpdatesOptIn && styles.checkboxChecked]}
          >
            {hostUpdatesOptIn ? <Ionicons name="checkmark" size={10} color="#fff" /> : null}
          </Pressable>
          <Text style={styles.optInText} numberOfLines={1}>
            Get updates from {hostLabel}
          </Text>
        </View>

        {cartExpired ? (
          <View style={styles.expiredBanner}>
            <Ionicons name="time-outline" size={14} color={colors.warning} />
            <Text style={styles.expiredBannerText}>
              Your previous hold expired. Continue to refresh live pricing and availability.
            </Text>
          </View>
        ) : pendingReservation && reservationSecondsLeft > 0 ? (
          <View style={styles.reservationBanner}>
            <Ionicons name="time-outline" size={14} color={colors.success} />
            <Text style={styles.reservationBannerText}>
              Tickets held for {Math.floor(reservationSecondsLeft / 60)}:
              {String(reservationSecondsLeft % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handlePay}
          disabled={payDisabled}
          style={[styles.payButton, payDisabled && styles.payButtonDisabled]}
        >
          <LinearGradient colors={gradients.primary as [string, string]} style={styles.payGradient}>
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="lock-closed" size={16} color="#fff" />
            )}
            <Text style={styles.payButtonText}>{payButtonLabel}</Text>
          </LinearGradient>
        </Pressable>

        {bookingFeesWaived && !isFreeOrder ? (
          <View style={styles.feesWaivedRow}>
            <Ionicons name="flash" size={12} color={colors.success} />
            <Text style={styles.feesWaivedText}>Premium booking fees waived</Text>
          </View>
        ) : null}

        <Text style={styles.finePrint}>
          By confirming, you agree to the{' '}
          <Text
            style={styles.finePrintLink}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          >
            Terms
          </Text>{' '}
          &{' '}
          <Text
            style={styles.finePrintLink}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>

      <PromoModal
        visible={showPromoModal}
        onClose={() => setShowPromoModal(false)}
        onApply={handleApplyPromo}
        promoError={promoError}
        setPromoError={setPromoError}
      />
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex === 'transparent') return `rgba(0,0,0,${alpha})`;
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const num = parseInt(h, 16);
  if (isNaN(num)) return `rgba(0,0,0,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  ambientGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 340,
  },
  safeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 50,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  promoButtonText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.successMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,214,143,0.3)',
  },
  promoBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 16,
    gap: 14,
  },
  heroSection: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 2,
  },
  heroPosterWrap: {
    height: 200,
    position: 'relative',
  },
  heroPoster: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  heroInfo: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    gap: 6,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    color: 'rgba(254,248,232,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassCardInner: {
    padding: 18,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSectionTitle: {
    color: 'rgba(254,248,232,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  editTicketsText: {
    color: colors.irisGlow,
    fontSize: 12,
    fontWeight: '800',
  },
  ticketSummaryList: {
    gap: 10,
  },
  ticketSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketSummaryLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  ticketSummaryName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ticketSummaryQty: {
    color: 'rgba(254,248,232,0.5)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  ticketSummaryTotal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  ticketSummaryRight: {
    alignItems: 'flex-end',
    gap: 7,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  quantityValue: {
    minWidth: 18,
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  removeTicketButton: {
    width: 26,
    height: 26,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  priceLines: {
    gap: 8,
  },
  priceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: 'rgba(254,248,232,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  priceValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  discountLabel: {
    color: colors.success,
  },
  discountValue: {
    color: colors.success,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  totalValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  quoteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  quoteIndicatorText: {
    color: colors.goldStone,
    fontSize: 11,
    fontWeight: '500',
  },
  quoteErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.errorMuted,
  },
  quoteErrorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    fontWeight: '500',
  },
  quoteRetryText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(244,74,34,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
    minWidth: 0,
  },
  paymentTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentSubtitle: {
    color: 'rgba(254,248,232,0.5)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  emailInput: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 15,
    fontWeight: '500',
  },
  optInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(254,248,232,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.iris,
    borderColor: colors.iris,
  },
  optInText: {
    flex: 1,
    color: 'rgba(254,248,232,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warningMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,170,0,0.2)',
  },
  expiredBannerText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '500',
  },
  reservationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,214,143,0.2)',
  },
  reservationBannerText: {
    flex: 1,
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  payButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#F44A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  feesWaivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
  },
  feesWaivedText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  finePrint: {
    color: 'rgba(254,248,232,0.4)',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  finePrintLink: {
    color: 'rgba(254,248,232,0.7)',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  handoffScreen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  handoffContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  handoffIconWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  handoffTitle: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  handoffCopy: {
    color: colors.goldStone,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
  },
  handoffEvent: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 22,
    maxWidth: 320,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 28,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: 'rgba(254,248,232,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalInput: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modalApplyButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalApplyGradient: {
    height: 52,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  modalErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  modalErrorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 200,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(244,74,34,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: '900',
  },
  emptyCopy: {
    color: colors.goldStone,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
    fontSize: 15,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.iris,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  compactPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  compactPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactPaymentTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  compactPaymentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactPaymentSubtitle: {
    color: 'rgba(254,248,232,0.5)',
    fontSize: 13,
  },
  compactEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  compactEmailInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  emailValidationText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});

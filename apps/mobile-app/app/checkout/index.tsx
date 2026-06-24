import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { trackPurchaseFailed, trackTicketPurchase } from '@/lib/analytics';
import { calculatePricing, type PricingResult } from '@/lib/api';
import { colors, gradients, typography } from '@/lib/design/theme';
import { processFullCheckout, type CheckoutStatus } from '@/lib/payments';
import { formatEventDate, formatEventTime } from '@/lib/utils/date';
import { useAuthStore } from '@/store/authStore';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { useProfileStore } from '@/store/profileStore';

const checkoutFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

function formatMoney(value: number) {
  if (value <= 0) return '₹0';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

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

function CheckoutItemRow({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const tierSubtotal = item.tier.price * item.quantity;

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemCopy}>
        <Text style={styles.itemTier} numberOfLines={1}>
          {item.tier.name}
        </Text>
        <Text style={styles.itemPrice}>
          {item.quantity} x {formatMoney(item.tier.price)}
        </Text>
      </View>
      <View style={styles.quantityControl}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onQuantityChange(item.quantity - 1);
          }}
          style={styles.quantityButton}
          hitSlop={8}
        >
          <Ionicons name="remove" size={14} color={colors.gold} />
        </Pressable>
        <Text style={styles.quantityValue}>{item.quantity}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onQuantityChange(Math.min(item.tier.remaining || 10, item.quantity + 1));
          }}
          style={styles.quantityButton}
          hitSlop={8}
        >
          <Ionicons name="add" size={14} color={colors.gold} />
        </Pressable>
      </View>
      <Text style={styles.itemSubtotal}>{formatMoney(tierSubtotal)}</Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRemove();
        }}
        style={styles.removeButton}
        hitSlop={8}
      >
        <Ionicons name="close" size={15} color={colors.goldStone} />
      </Pressable>
    </View>
  );
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone?: 'discount' }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, tone === 'discount' && styles.discountText]}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'discount' && styles.discountText]}>{value}</Text>
    </View>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const { items, promo, removeItem, updateQuantity, clearCart, applyPromoCode, clearPromoCode } =
    useCartStore();

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [billingEmail, setBillingEmail] = useState(profile?.email || user?.email || '');
  const [pricing, setPricing] = useState<PricingResult['pricing'] | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [hostUpdatesOptIn, setHostUpdatesOptIn] = useState(true);

  const cartEventTitle = items[0]?.eventTitle || 'Your booking';
  const cartEventDate = items[0]?.eventDate || '';
  const cartEventVenue = items[0]?.eventVenue || 'Venue TBA';
  const cartEventImage = items[0]?.eventCoverImage;
  const eventId = items[0]?.eventId || '';
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

  useEffect(() => {
    if (!eventId || checkoutItems.length === 0) {
      setPricing(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    calculatePricing({
      eventId,
      items: checkoutItems,
      promoCode: promo?.code ?? null,
      promoterCode: promoterCode ?? null,
    })
      .then((result) => {
        if (cancelled) return;
        setPricing(result.pricing);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setPricing(null);
        setQuoteError(error.message || 'We could not refresh live pricing.');
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutItems, eventId, promo?.code, promoterCode]);

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
  const paymentMethodLabel = isFreeOrder ? 'Free checkout' : 'Razorpay';
  const paymentMethodDetail = isFreeOrder
    ? 'No payment required'
    : 'UPI, cards, wallets, netbanking';
  const payDisabled = processing || quoteLoading || !!quoteError;
  const payButtonLabel = processing
    ? getCheckoutStatusLabel(checkoutStatus)
    : isFreeOrder
      ? 'Confirm order'
      : `Pay ${formatMoney(total)}`;

  const handleApplyPromo = async () => {
    const normalized = promoInput.trim().toUpperCase();
    if (!normalized || !eventId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromoError(null);
    const result = await applyPromoCode(normalized, eventId);

    if (!result.success) {
      setPromoError(result.error || 'This promo code is not available for this order.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPromoInput('');
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
      onStatusChange: setCheckoutStatus,
    });

    if (!result.success || !result.orderId) {
      trackPurchaseFailed(eventId, result.error || 'Checkout failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setProcessing(false);
      Alert.alert(
        'Checkout failed',
        result.error || 'We could not complete checkout. Please try again.',
      );
      return;
    }

    trackTicketPurchase(eventId, 'Selected tickets', total, ticketCount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessing(false);
    router.replace({
      pathname: '/checkout/success',
      params: {
        orderId: result.orderId,
        eventTitle: cartEventTitle,
        eventDate: cartEventDate,
        venueLocation: cartEventVenue,
        totalAmount: String(total),
        ticketCount: String(ticketCount),
        paymentMethod: result.requiresPayment ? 'Razorpay' : 'Free checkout',
      },
    });
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyScreen}>
        <Ionicons name="ticket-outline" size={48} color={colors.iris} />
        <Text style={styles.emptyTitle}>No tickets selected</Text>
        <Text style={styles.emptyCopy}>Pick an event and choose ticket tiers before checkout.</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/(tabs)/explore');
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Explore events</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(244,74,34,0.20)', 'rgba(0,0,0,0.72)', colors.base.DEFAULT]}
        locations={[0, 0.45, 1]}
        style={styles.topGradient}
      />
      <View style={styles.headerShell}>
        <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.headerIconButton}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={25} color={colors.gold} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              clearCart();
            }}
            style={styles.clearButton}
            hitSlop={8}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        </View>
        <Text style={styles.reviewTitle}>REVIEW & PAY</Text>
        <Text style={styles.reviewSubtitle}>{getCheckoutStatusLabel(checkoutStatus)}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 292 }]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSummaryOpen((open) => !open);
          }}
          style={styles.eventSummaryCard}
        >
          {cartEventImage ? (
            <Image source={{ uri: cartEventImage }} style={styles.eventPoster} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={gradients.primary as [string, string]}
              style={styles.eventPoster}
            />
          )}
          <View style={styles.eventSummaryCopy}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {cartEventTitle}
            </Text>
            <Text style={styles.eventMeta} numberOfLines={1}>
              {ticketCount} {ticketCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Ionicons
            name={summaryOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.goldStone}
          />
        </Pressable>

        {summaryOpen ? (
          <View style={styles.detailPanel}>
            <View style={styles.eventDetailLine}>
              <Ionicons name="calendar-outline" size={15} color={colors.goldStone} />
              <Text style={styles.eventDetailText} numberOfLines={1}>
                {cartEventDate
                  ? `${formatEventDate(cartEventDate)} · ${formatEventTime(cartEventDate)}`
                  : 'Date TBA'}
              </Text>
            </View>
            <View style={styles.eventDetailLine}>
              <Ionicons name="location-outline" size={15} color={colors.goldStone} />
              <Text style={styles.eventDetailText} numberOfLines={1}>
                {cartEventVenue}
              </Text>
            </View>
            <View style={styles.ticketList}>
              {items.map((item) => (
                <CheckoutItemRow
                  key={`${item.eventId}-${item.tier.id}`}
                  item={item}
                  onRemove={() => removeItem(item.eventId, item.tier.id)}
                  onQuantityChange={(quantity) => {
                    Haptics.selectionAsync();
                    updateQuantity(item.eventId, item.tier.id, quantity);
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/checkout/[eventId]',
                  params: { eventId: items[0]?.eventId || '' },
                });
              }}
              style={styles.editTicketsButton}
            >
              <Ionicons name="create-outline" size={15} color={colors.gold} />
              <Text style={styles.editTicketsText}>Edit tickets</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>PAY WITH</Text>
          <View style={styles.paymentMethodRow}>
            <View style={styles.paymentMark}>
              <Ionicons name={isFreeOrder ? 'checkmark' : 'card'} size={18} color={colors.gold} />
            </View>
            <View style={styles.paymentCopy}>
              <Text style={styles.paymentTitle}>{paymentMethodLabel}</Text>
              <Text style={styles.paymentSubtitle}>{paymentMethodDetail}</Text>
            </View>
            <Pressable onPress={handlePaymentMethodChange} hitSlop={8}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.receiptHeader}>
            <Text style={styles.sectionEyebrow}>ORDER</Text>
            {quoteLoading ? (
              <View style={styles.quotePill}>
                <ActivityIndicator color={colors.irisGlow} size="small" />
                <Text style={styles.quotePillText}>Live price</Text>
              </View>
            ) : null}
          </View>

          {quoteError ? (
            <View style={styles.quoteErrorBox}>
              <Ionicons name="warning-outline" size={17} color={colors.error} />
              <Text style={styles.quoteErrorText}>{quoteError}</Text>
            </View>
          ) : null}

          <SummaryLine label={`Tickets (${ticketCount})`} value={formatMoney(subtotal)} />
          {discount > 0 ? (
            <SummaryLine
              label={`Discount${promo?.code ? ` (${promo.code})` : ''}`}
              value={`-${formatMoney(discount)}`}
              tone="discount"
            />
          ) : null}
          {platformFee > 0 ? (
            <SummaryLine label="Platform fee" value={formatMoney(platformFee)} />
          ) : null}
          {paymentFee > 0 ? (
            <SummaryLine label="Payment fee" value={formatMoney(paymentFee)} />
          ) : null}
          {taxes > 0 ? <SummaryLine label="GST on fees" value={formatMoney(taxes)} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>PROMO</Text>
          {promo ? (
            <View style={styles.appliedPromoRow}>
              <View>
                <Text style={styles.appliedPromoCode}>{promo.code}</Text>
                <Text style={styles.appliedPromoLabel}>
                  {promo.label || `${promo.discountPercent}% discount`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  clearPromoCode();
                }}
                hitSlop={8}
              >
                <Text style={styles.removePromoText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.promoInputRow}>
                <TextInput
                  placeholder="C1RCLE10"
                  placeholderTextColor="rgba(254,248,232,0.34)"
                  value={promoInput}
                  onChangeText={(text) => {
                    setPromoInput(text);
                    setPromoError(null);
                  }}
                  autoCapitalize="characters"
                  style={styles.promoInput}
                />
                <Pressable onPress={handleApplyPromo} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </Pressable>
              </View>
              {promoError ? <Text style={styles.errorText}>{promoError}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>RECEIPT</Text>
          <TextInput
            placeholder="Receipt email"
            placeholderTextColor="rgba(254,248,232,0.34)"
            value={billingEmail}
            onChangeText={setBillingEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.emailInput}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerTotalRow}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalValue}>{formatMoney(total)}</Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setHostUpdatesOptIn((value) => !value);
          }}
          style={styles.optInRow}
        >
          <View style={[styles.checkbox, hostUpdatesOptIn && styles.checkboxChecked]}>
            {hostUpdatesOptIn ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
          </View>
          <Text style={styles.optInText} numberOfLines={1}>
            Get updates from {hostLabel}
          </Text>
        </Pressable>

        <Text style={styles.feesText}>Includes fees ⓘ</Text>

        <Pressable
          onPress={handlePay}
          disabled={payDisabled}
          style={[styles.payButton, payDisabled && styles.payButtonDisabled]}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payButtonText}>{payButtonLabel}</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.finePrint}>
          By confirming your order, you agree to The C1rcle General Terms and Conditions and Privacy
          Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 220,
  },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.base.DEFAULT,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
  },
  emptyCopy: {
    color: colors.goldStone,
    fontFamily: checkoutFont.regular,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: colors.iris,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  headerShell: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: colors.goldStone,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
  },
  reviewTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
  },
  reviewSubtitle: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 13,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  eventSummaryCard: {
    minHeight: 88,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventPoster: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.base[100],
  },
  eventSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  eventMeta: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  detailPanel: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 12,
    marginTop: 10,
  },
  eventDetailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  eventDetailText: {
    flex: 1,
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
  },
  ticketList: {
    marginTop: 4,
    gap: 8,
  },
  itemRow: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTier: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  itemPrice: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 11,
    marginTop: 3,
  },
  quantityControl: {
    width: 80,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  quantityButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    minWidth: 18,
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  itemSubtotal: {
    minWidth: 46,
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 12,
    textAlign: 'right',
  },
  removeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTicketsButton: {
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  editTicketsText: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
  },
  section: {
    marginTop: 22,
  },
  sectionEyebrow: {
    color: colors.goldStone,
    fontFamily: checkoutFont.black,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  paymentMethodRow: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginTop: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMark: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentCopy: {
    flex: 1,
    minWidth: 0,
  },
  paymentTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  paymentSubtitle: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    marginTop: 3,
  },
  changeText: {
    color: colors.irisGlow,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
  },
  receiptHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  quotePillText: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 11,
  },
  quoteErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 84, 112, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 84, 112, 0.32)',
    marginTop: 10,
  },
  quoteErrorText: {
    flex: 1,
    color: colors.error,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  summaryLine: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 7,
  },
  summaryLabel: {
    flex: 1,
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 14,
  },
  discountText: {
    color: colors.success,
  },
  appliedPromoRow: {
    borderRadius: 8,
    backgroundColor: colors.successMuted,
    padding: 13,
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  appliedPromoCode: {
    color: colors.success,
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  appliedPromoLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    marginTop: 3,
  },
  removePromoText: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 12,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 9,
  },
  promoInput: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.gold,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    fontFamily: checkoutFont.medium,
  },
  applyButton: {
    width: 86,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
  },
  applyButtonText: {
    color: '#fff',
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  errorText: {
    color: colors.error,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    marginTop: 9,
  },
  emailInput: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.gold,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    fontFamily: checkoutFont.medium,
    marginTop: 9,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.13)',
  },
  footerTotalRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  footerTotalLabel: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 23,
    fontWeight: '900',
  },
  footerTotalValue: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 24,
    fontWeight: '900',
  },
  optInRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(254,248,232,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.iris,
    borderColor: colors.iris,
  },
  optInText: {
    flex: 1,
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 13,
  },
  feesText: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    marginTop: 2,
  },
  payButton: {
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.iris,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 12,
  },
  payButtonDisabled: {
    opacity: 0.58,
  },
  payButtonText: {
    color: '#fff',
    fontFamily: checkoutFont.black,
    fontSize: 17,
    fontWeight: '900',
  },
  finePrint: {
    color: 'rgba(254,248,232,0.54)',
    fontFamily: checkoutFont.regular,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 9,
  },
});

import { useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { colors, gradients, typography } from '@/lib/design/theme';
import { formatEventDate, formatEventTime } from '@/lib/utils/date';

type PromoKind = 'percent' | 'flat';
type PaymentMethodId = 'card' | 'gpay' | 'bank' | 'upi' | 'wallet';

interface PromoDefinition {
  code: string;
  label: string;
  kind: PromoKind;
  amount: number;
  maxDiscount?: number;
}

interface PaymentMethod {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  feeRate: number;
}

const checkoutFont = {
  regular: typography.fontFamily.body,
  medium: typography.fontFamily.medium,
  bold: typography.fontFamily.heading,
  black: typography.fontFamily.brandAccent,
};

const PROMOS: PromoDefinition[] = [
  {
    code: 'C1RCLE10',
    label: '10% off ticket subtotal',
    kind: 'percent',
    amount: 10,
    maxDiscount: 750,
  },
  {
    code: 'HOST20',
    label: '20% host invite discount',
    kind: 'percent',
    amount: 20,
    maxDiscount: 1200,
  },
  { code: 'WELCOME500', label: 'Flat ₹500 off', kind: 'flat', amount: 500 },
  {
    code: 'EARLYBIRD',
    label: '15% early access discount',
    kind: 'percent',
    amount: 15,
    maxDiscount: 1000,
  },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'card',
    title: 'Credit or debit card',
    subtitle: 'Visa, Mastercard, RuPay, Amex',
    icon: 'card-outline',
    feeRate: 0.025,
  },
  {
    id: 'gpay',
    title: 'Google Pay',
    subtitle: 'Fast UPI payment through GPay',
    icon: 'logo-google',
    feeRate: 0.012,
  },
  {
    id: 'upi',
    title: 'UPI',
    subtitle: 'Pay with any UPI app',
    icon: 'phone-portrait-outline',
    feeRate: 0.01,
  },
  {
    id: 'bank',
    title: 'Bank account',
    subtitle: 'Net banking or direct bank transfer',
    icon: 'business-outline',
    feeRate: 0.006,
  },
  {
    id: 'wallet',
    title: 'Wallet balance',
    subtitle: 'Use saved C1RCLE credits',
    icon: 'wallet-outline',
    feeRate: 0,
  },
];

function formatMoney(value: number) {
  if (value <= 0) return '₹0';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function calculatePromoDiscount(promo: PromoDefinition | null, subtotal: number) {
  if (!promo || subtotal <= 0) return 0;
  if (promo.kind === 'flat') return Math.min(subtotal, promo.amount);
  const percentDiscount = Math.round(subtotal * (promo.amount / 100));
  return Math.min(percentDiscount, promo.maxDiscount ?? percentDiscount);
}

function buildOrderId() {
  return `UI-${Date.now().toString(36).toUpperCase()}`;
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
      <View style={styles.itemMain}>
        <Text style={styles.itemTier}>{item.tier.name}</Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.tier.description || 'Mobile QR ticket with event access and wallet delivery.'}
        </Text>
        <Text style={styles.itemPrice}>{formatMoney(item.tier.price)} each</Text>
      </View>
      <View style={styles.itemSide}>
        <View style={styles.quantityControl}>
          <Pressable
            onPress={() => onQuantityChange(item.quantity - 1)}
            style={styles.quantityButton}
          >
            <Ionicons name="remove" size={15} color="#fff" />
          </Pressable>
          <Text style={styles.quantityValue}>{item.quantity}</Text>
          <Pressable
            onPress={() => onQuantityChange(Math.min(item.tier.remaining || 10, item.quantity + 1))}
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={15} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.itemSubtotal}>{formatMoney(tierSubtotal)}</Text>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MethodRow({
  method,
  selected,
  onPress,
}: {
  method: PaymentMethod;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.methodRow, selected && styles.methodRowSelected]}>
      <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
        <Ionicons name={method.icon} size={20} color={selected ? '#fff' : colors.goldStone} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={styles.methodTitle}>{method.title}</Text>
        <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.irisGlow : 'rgba(255,255,255,0.32)'}
      />
    </Pressable>
  );
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoDefinition | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<PaymentMethodId>('card');
  const [processing, setProcessing] = useState(false);
  const [cardName, setCardName] = useState(profile?.displayName || user?.displayName || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingEmail, setBillingEmail] = useState(profile?.email || user?.email || '');
  const [upiId, setUpiId] = useState('');

  const cartEventTitle = items[0]?.eventTitle || 'Your booking';
  const cartEventDate = items[0]?.eventDate || '';
  const cartEventVenue = items[0]?.eventVenue || 'Venue TBA';
  const cartEventImage = items[0]?.eventCoverImage;
  const ticketCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedMethod =
    PAYMENT_METHODS.find((method) => method.id === paymentMethodId) || PAYMENT_METHODS[0];

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.tier.price * item.quantity, 0);
  }, [items]);

  const discount = calculatePromoDiscount(appliedPromo, subtotal);
  const taxableBase = Math.max(0, subtotal - discount);
  const platformFee = subtotal > 0 ? Math.max(49, Math.round(taxableBase * 0.04)) : 0;
  const paymentFee = subtotal > 0 ? Math.round(taxableBase * selectedMethod.feeRate) : 0;
  const taxes = subtotal > 0 ? Math.round((platformFee + paymentFee) * 0.18) : 0;
  const total = Math.max(0, taxableBase + platformFee + paymentFee + taxes);
  const isFreeOrder = total === 0;

  const handleApplyPromo = () => {
    const normalized = promoInput.trim().toUpperCase();
    if (!normalized) return;
    const promo = PROMOS.find((candidate) => candidate.code === normalized);
    if (!promo) {
      setPromoError('Try C1RCLE10, HOST20, WELCOME500, or EARLYBIRD.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAppliedPromo(promo);
    setPromoInput('');
    setPromoError(null);
  };

  const handlePay = () => {
    if (items.length === 0) return;
    if (
      paymentMethodId === 'card' &&
      !isFreeOrder &&
      (!cardName.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim())
    ) {
      Alert.alert(
        'Card details needed',
        'Add the visible card fields to continue the UI payment flow.',
      );
      return;
    }
    if (
      (paymentMethodId === 'gpay' || paymentMethodId === 'upi') &&
      !isFreeOrder &&
      !upiId.trim()
    ) {
      Alert.alert('UPI ID needed', 'Add a UPI ID or phone handle to continue.');
      return;
    }
    if (!billingEmail.trim()) {
      Alert.alert('Email needed', 'Add an email for the ticket receipt.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);
    const orderId = buildOrderId();
    setTimeout(() => {
      clearCart();
      setProcessing(false);
      router.replace({
        pathname: '/checkout/success',
        params: {
          orderId,
          eventTitle: cartEventTitle,
          eventDate: cartEventDate,
          venueLocation: cartEventVenue,
          totalAmount: String(total),
          ticketCount: String(ticketCount),
          paymentMethod: selectedMethod.title,
        },
      });
    }, 850);
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyScreen}>
        <Ionicons name="ticket-outline" size={48} color={colors.iris} />
        <Text style={styles.emptyTitle}>No tickets selected</Text>
        <Text style={styles.emptyCopy}>Pick an event and choose ticket tiers before checkout.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/explore')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Explore events</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Pressable onPress={clearCart} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.eventCard}>
          {cartEventImage ? (
            <Image source={{ uri: cartEventImage }} style={styles.eventImage} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={gradients.primary as [string, string]}
              style={styles.eventImage}
            />
          )}
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {cartEventTitle}
            </Text>
            <Text style={styles.eventMeta}>
              {cartEventDate
                ? `${formatEventDate(cartEventDate)} · ${formatEventTime(cartEventDate)}`
                : 'Date TBA'}
            </Text>
            <Text style={styles.eventMeta} numberOfLines={1}>
              {cartEventVenue}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tickets</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/checkout/[eventId]',
                params: { eventId: items[0]?.eventId || '' },
              })
            }
          >
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>

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

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Promo code</Text>
          <Text style={styles.panelCopy}>
            Use an event, host, or C1RCLE code. This is UI-only validation for now.
          </Text>
          {appliedPromo ? (
            <View style={styles.appliedPromoRow}>
              <View>
                <Text style={styles.appliedPromoCode}>{appliedPromo.code}</Text>
                <Text style={styles.appliedPromoLabel}>{appliedPromo.label}</Text>
              </View>
              <Pressable onPress={() => setAppliedPromo(null)}>
                <Text style={styles.removePromoText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.promoInputRow}>
                <TextInput
                  placeholder="C1RCLE10"
                  placeholderTextColor="rgba(255,255,255,0.32)"
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

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Payment method</Text>
          <Text style={styles.panelCopy}>Choose how this payment would be processed.</Text>
          {PAYMENT_METHODS.map((method) => (
            <MethodRow
              key={method.id}
              method={method}
              selected={paymentMethodId === method.id}
              onPress={() => {
                Haptics.selectionAsync();
                setPaymentMethodId(method.id);
              }}
            />
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Payment details</Text>
          {paymentMethodId === 'card' ? (
            <>
              <TextInput
                placeholder="Name on card"
                placeholderTextColor="rgba(255,255,255,0.32)"
                value={cardName}
                onChangeText={setCardName}
                style={styles.input}
              />
              <TextInput
                placeholder="Card number"
                placeholderTextColor="rgba(255,255,255,0.32)"
                value={cardNumber}
                onChangeText={setCardNumber}
                keyboardType="number-pad"
                style={styles.input}
              />
              <View style={styles.splitRow}>
                <TextInput
                  placeholder="MM/YY"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  value={cardExpiry}
                  onChangeText={setCardExpiry}
                  style={[styles.input, styles.splitInput]}
                />
                <TextInput
                  placeholder="CVV"
                  placeholderTextColor="rgba(255,255,255,0.32)"
                  value={cardCvv}
                  onChangeText={setCardCvv}
                  keyboardType="number-pad"
                  secureTextEntry
                  style={[styles.input, styles.splitInput]}
                />
              </View>
            </>
          ) : paymentMethodId === 'gpay' || paymentMethodId === 'upi' ? (
            <TextInput
              placeholder="yourname@upi"
              placeholderTextColor="rgba(255,255,255,0.32)"
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              style={styles.input}
            />
          ) : paymentMethodId === 'bank' ? (
            <View style={styles.bankNotice}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.irisGlow} />
              <Text style={styles.bankNoticeText}>
                Bank authorization would open after tapping pay.
              </Text>
            </View>
          ) : (
            <View style={styles.bankNotice}>
              <Ionicons name="wallet-outline" size={20} color={colors.irisGlow} />
              <Text style={styles.bankNoticeText}>
                Wallet credits would be checked before confirmation.
              </Text>
            </View>
          )}
          <TextInput
            placeholder="Receipt email"
            placeholderTextColor="rgba(255,255,255,0.32)"
            value={billingEmail}
            onChangeText={setBillingEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tickets ({ticketCount})</Text>
            <Text style={styles.summaryValue}>{formatMoney(subtotal)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.discountText]}>
                Discount {appliedPromo?.code ? `(${appliedPromo.code})` : ''}
              </Text>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -{formatMoney(discount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform fee</Text>
            <Text style={styles.summaryValue}>{formatMoney(platformFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{selectedMethod.title} fee</Text>
            <Text style={styles.summaryValue}>{formatMoney(paymentFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxes</Text>
            <Text style={styles.summaryValue}>{formatMoney(taxes)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
        </View>

        <Text style={styles.termsText}>
          By paying, you agree to ticket transfer, refund, and venue entry rules. This screen is a
          frontend-only payment flow.
        </Text>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomTotal}>{formatMoney(total)}</Text>
        </View>
        <Pressable
          onPress={handlePay}
          disabled={processing}
          style={[styles.payButton, processing && styles.payButtonDisabled]}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.payButtonText}>{isFreeOrder ? 'Confirm' : 'Pay now'}</Text>
              <Ionicons name="lock-closed" size={16} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
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
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: colors.iris,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: colors.goldStone,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 18,
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  eventCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
  },
  eventImage: {
    width: 96,
    height: 116,
    borderRadius: 16,
    backgroundColor: colors.base[100],
  },
  eventCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  eventMeta: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
    marginTop: 7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 22,
    fontWeight: '900',
  },
  editLink: {
    color: colors.irisGlow,
    fontFamily: checkoutFont.bold,
    fontSize: 13,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 15,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 10,
  },
  itemMain: {
    flex: 1,
  },
  itemTier: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontWeight: '900',
    fontSize: 17,
  },
  itemDescription: {
    color: colors.goldStone,
    fontFamily: checkoutFont.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  itemPrice: {
    color: colors.irisGlow,
    fontFamily: checkoutFont.bold,
    fontSize: 12,
    marginTop: 9,
  },
  itemSide: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.base[100],
  },
  quantityValue: {
    minWidth: 18,
    textAlign: 'center',
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontWeight: '900',
  },
  itemSubtotal: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontWeight: '900',
    marginTop: 12,
  },
  removeButton: {
    marginTop: 10,
  },
  removeButtonText: {
    color: colors.error,
    fontFamily: checkoutFont.bold,
    fontSize: 12,
  },
  panel: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    marginTop: 14,
  },
  panelTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 18,
    fontWeight: '900',
  },
  panelCopy: {
    color: colors.goldStone,
    fontFamily: checkoutFont.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 14,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  promoInput: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: colors.gold,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    fontFamily: checkoutFont.medium,
  },
  applyButton: {
    width: 86,
    height: 48,
    borderRadius: 16,
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
  appliedPromoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: colors.successMuted,
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
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  methodRowSelected: {
    borderBottomColor: 'rgba(244,74,34,0.28)',
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  methodIconSelected: {
    backgroundColor: colors.iris,
  },
  methodCopy: {
    flex: 1,
  },
  methodTitle: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 14,
  },
  methodSubtitle: {
    color: colors.goldStone,
    fontFamily: checkoutFont.regular,
    fontSize: 12,
    marginTop: 3,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: colors.gold,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    fontFamily: checkoutFont.medium,
    marginTop: 10,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitInput: {
    flex: 1,
  },
  bankNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(244,74,34,0.10)',
    marginTop: 12,
  },
  bankNoticeText: {
    flex: 1,
    color: colors.gold,
    fontFamily: checkoutFont.medium,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 12,
  },
  summaryLabel: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    color: colors.gold,
    fontFamily: checkoutFont.bold,
    fontSize: 14,
  },
  discountText: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  totalLabel: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 18,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 20,
    fontWeight: '900',
  },
  termsText: {
    color: colors.goldStone,
    fontFamily: checkoutFont.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLabel: {
    color: colors.goldStone,
    fontFamily: checkoutFont.medium,
    fontSize: 12,
  },
  bottomTotal: {
    color: colors.gold,
    fontFamily: checkoutFont.black,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  payButton: {
    minWidth: 164,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.iris,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.65,
  },
  payButtonText: {
    color: '#fff',
    fontFamily: checkoutFont.black,
    fontSize: 16,
    fontWeight: '900',
  },
});

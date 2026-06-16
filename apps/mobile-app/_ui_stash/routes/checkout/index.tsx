/**
 * THE C1RCLE - Checkout Screen
 * Uses the same backend APIs as the guest-portal website.
 * Flow: reserve → initiate → Razorpay → verify → webhook confirms
 */

import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { useCartStore, CartItem } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { Image } from 'expo-image';
import { processFullCheckout, type CheckoutStatus } from '@/lib/payments';
import { calculatePricing, type PricingResult } from '@/lib/api';

function getReservationLabel(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'Hold expired';
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return `Held for ${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ─── Cart Item Card ──────────────────────────────────────────────

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (qty: number) => void;
}) {
  return (
    <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-3">
      <View className="flex-row">
        {item.eventCoverImage ? (
          <Image
            source={{ uri: item.eventCoverImage }}
            className="w-20 h-20 rounded-xl mr-4"
            contentFit="cover"
          />
        ) : (
          <View className="w-20 h-20 rounded-xl mr-4 bg-midnight-200 items-center justify-center">
            <Text className="text-2xl">🎉</Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="text-gold font-semibold" numberOfLines={1}>
            {item.eventTitle}
          </Text>
          <Text className="text-gold-stone text-sm">{item.tier.name}</Text>
          <Text className="text-iris font-semibold mt-1">
            ₹{item.tier.price} × {item.quantity}
          </Text>
        </View>

        <Pressable onPress={onRemove} className="p-2">
          <Text className="text-red-400">✕</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
        <View className="flex-row items-center bg-surface rounded-pill border border-white/10">
          <Pressable onPress={() => onUpdateQuantity(item.quantity - 1)} className="px-4 py-2">
            <Text className="text-gold text-lg">−</Text>
          </Pressable>
          <Text className="text-gold font-semibold px-3">{item.quantity}</Text>
          <Pressable onPress={() => onUpdateQuantity(item.quantity + 1)} className="px-4 py-2">
            <Text className="text-gold text-lg">+</Text>
          </Pressable>
        </View>
        <Text className="text-gold font-satoshi-bold text-lg">
          ₹{item.priceTotal || item.tier.price * item.quantity}
        </Text>
      </View>
    </View>
  );
}

// ─── Status Labels ───────────────────────────────────────────────

const STATUS_LABELS: Record<CheckoutStatus, string> = {
  reserving: 'Reserving your tickets...',
  initiating: 'Processing order...',
  awaiting_payment: 'Opening payment...',
  verifying: 'Verifying payment...',
  confirmed: 'Order confirmed!',
  failed: 'Something went wrong',
  cancelled: 'Payment cancelled',
};

// ─── Checkout Screen ─────────────────────────────────────────────

export default function CheckoutScreen() {
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const {
    items,
    promo,
    pendingReservation,
    pendingPaymentOrderId,
    removeItem,
    updateQuantity,
    applyPromoCode,
    clearPromoCode,
    getSubtotal,
    getTotal,
    getCheckoutItems,
    getEventId,
    clearCart,
    clearPendingReservation,
  } = useCartStore();

  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [promoterCode, setPromoterCode] = useState('');
  const [pricing, setPricing] = useState<PricingResult['pricing'] | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const cartEventId = items[0]?.eventId || null;
  const cartEventTitle = items[0]?.eventTitle || 'Your booking';
  const cartEventDate = items[0]?.eventDate || '';
  const cartEventVenue = items[0]?.eventVenue || 'Venue TBA';
  const cartEventImage = items[0]?.eventCoverImage;
  const mixedEventCart = new Set(items.map((item) => item.eventId)).size > 1;
  const subtotal = pricing?.subtotal ?? 0;
  const discount = pricing?.discountTotal ?? pricing?.discount ?? promo?.discountAmount ?? 0;
  const fees = pricing?.fees?.total ?? pricing?.platformFee ?? 0;
  const total = pricing?.grandTotal ?? 0;
  const isFreeOrder = pricing?.isFree ?? total === 0;
  const reservationLabel = getReservationLabel(pendingReservation?.expiresAt);
  const sameSelectionAsPending =
    Boolean(pendingReservation) &&
    pendingReservation?.eventId === cartEventId &&
    JSON.stringify(pendingReservation?.items || []) === JSON.stringify(getCheckoutItems());
  const canResumePayment =
    Boolean(pendingPaymentOrderId) &&
    Boolean(pendingReservation) &&
    sameSelectionAsPending &&
    new Date(pendingReservation!.expiresAt).getTime() > Date.now();

  useEffect(() => {
    if (user?.uid) {
      void loadProfile(user.uid);
    }
  }, [user?.uid, loadProfile]);

  useEffect(() => {
    setAttendeeName(
      (current) =>
        current || pendingReservation?.userName || profile?.displayName || user?.displayName || '',
    );
    setAttendeeEmail(
      (current) => current || pendingReservation?.userEmail || profile?.email || user?.email || '',
    );
    setAttendeePhone((current) => current || pendingReservation?.userPhone || profile?.phone || '');
    setPromoterCode(
      (current) => current || pendingReservation?.promoterCode || items[0]?.promoterCode || '',
    );
  }, [
    pendingReservation?.promoterCode,
    pendingReservation?.userEmail,
    pendingReservation?.userName,
    pendingReservation?.userPhone,
    profile?.displayName,
    profile?.email,
    profile?.phone,
    user?.displayName,
    user?.email,
    items,
  ]);

  useEffect(() => {
    if (!cartEventId || items.length === 0 || mixedEventCart) {
      setPricing(null);
      return;
    }

    let cancelled = false;
    setPricingLoading(true);

    void calculatePricing({
      eventId: cartEventId,
      items: items.map((item) => ({
        tierId: item.tier.id,
        quantity: item.quantity,
        price: item.tier.price,
        subtotal: item.tier.price * item.quantity,
      })),
      promoCode: promo?.code || null,
      promoterCode: promoterCode.trim() || items[0]?.promoterCode || null,
    })
      .then((result) => {
        if (!cancelled && result.success) {
          setPricing(result.pricing);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPricing(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cartEventId, items, promo?.code, promoterCode, mixedEventCart]);

  // ─── Promo Code Handler (validated via backend API) ──────────

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    const eventId = getEventId();
    if (!eventId) return;

    setPromoLoading(true);
    setPromoError(null);

    const result = await applyPromoCode(promoInput.trim(), eventId);

    if (!result.success) {
      setPromoError(result.error || 'Invalid code');
    } else {
      setPromoInput(''); // Clear input on success
    }
    setPromoLoading(false);
  }, [promoInput, applyPromoCode, getEventId]);

  // ─── Checkout Handler (server-side flow) ─────────────────────

  const handleCheckout = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert('Login Required', 'Please login to complete your purchase', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Add some tickets to continue');
      return;
    }

    if (mixedEventCart) {
      Alert.alert(
        'One Event Per Booking',
        'Your cart contains tickets from multiple events. Start a fresh booking from a single event to continue.',
      );
      return;
    }

    if (!attendeeName.trim() || !attendeeEmail.trim()) {
      Alert.alert(
        'Booking Details Missing',
        'Add your name and email so we can send your booking confirmation and tickets.',
      );
      return;
    }

    setCheckoutLoading(true);
    setCheckoutStatus(null);

    if (!cartEventId) {
      setCheckoutLoading(false);
      Alert.alert('Error', 'Missing event information');
      return;
    }

    // Use the full server-side checkout flow
    const result = await processFullCheckout({
      eventId: cartEventId,
      eventTitle: cartEventTitle,
      items: getCheckoutItems(),
      userName: attendeeName.trim(),
      userEmail: attendeeEmail.trim(),
      userPhone: attendeePhone.trim() || undefined,
      promoCode: promo?.code || null,
      promoterCode: promoterCode.trim() || items[0]?.promoterCode || null,
      onStatusChange: (status) => setCheckoutStatus(status),
    });

    setCheckoutLoading(false);

    if (result.success && result.orderId) {
      // Clear the cart on success
      clearCart();

      router.replace({
        pathname: '/checkout/success',
        params: { orderId: result.orderId },
      });
    } else if (!result.success && result.error !== 'Payment was cancelled') {
      Alert.alert('Checkout Failed', result.error || 'Something went wrong', [
        { text: 'Try Again', onPress: handleCheckout },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [
    user,
    items,
    promo,
    cartEventId,
    cartEventTitle,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    promoterCode,
    mixedEventCart,
    getCheckoutItems,
    clearCart,
  ]);

  // ─── Empty Cart State ────────────────────────────────────────

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-midnight">
        <View className="flex-row items-center px-4 py-4 border-b border-white/10">
          <Pressable onPress={() => router.back()} className="mr-4">
            <Text className="text-gold text-lg">← Back</Text>
          </Pressable>
          <Text className="text-gold font-satoshi-bold text-xl">Your Cart</Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">🛒</Text>
          <Text className="text-gold font-satoshi-bold text-xl mb-2">Your Cart is Empty</Text>
          <Text className="text-gold-stone text-center mb-6">
            Browse events and add tickets to get started
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            className="bg-iris px-6 py-3 rounded-pill"
          >
            <Text className="text-white font-semibold">Explore Events</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-midnight">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-white/10">
        <Pressable onPress={() => router.back()} className="mr-4">
          <Text className="text-gold text-lg">← Back</Text>
        </Pressable>
        <Text className="text-gold font-satoshi-bold text-xl">Checkout</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cart Items */}
        <Text className="text-gold font-semibold text-lg mt-4 mb-3">
          Your Booking ({pricing?.totalQuantity || items.length})
        </Text>

        <View className="bg-midnight-100 rounded-bubble border border-white/10 overflow-hidden mb-4">
          {cartEventImage ? (
            <Image source={{ uri: cartEventImage }} className="w-full h-40" contentFit="cover" />
          ) : (
            <View className="w-full h-40 bg-midnight-200 items-center justify-center">
              <Text className="text-5xl">🎉</Text>
            </View>
          )}
          <View className="p-4">
            <Text className="text-gold font-satoshi-bold text-xl">{cartEventTitle}</Text>
            {!!cartEventDate && <Text className="text-gold-stone mt-1">{cartEventDate}</Text>}
            <Text className="text-gold-stone mt-1">{cartEventVenue}</Text>
          </View>
        </View>

        {mixedEventCart && (
          <View className="bg-red-500/10 border border-red-500/20 rounded-bubble p-4 mb-4">
            <Text className="text-red-300 font-semibold">One event per checkout</Text>
            <Text className="text-red-200/80 text-sm mt-1">
              The guest portal checkout only supports one event at a time. Remove the extra event
              tickets before paying.
            </Text>
          </View>
        )}

        {canResumePayment && pendingReservation ? (
          <View className="bg-orange-500/10 border border-orange-500/20 rounded-bubble p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-orange-300 font-semibold">Resume Payment</Text>
                <Text className="text-orange-100/80 text-sm mt-1">
                  {pendingReservation.eventTitle || 'Your reserved tickets are waiting'}
                  {reservationLabel ? ` · ${reservationLabel}` : ''}
                </Text>
              </View>
              <Pressable onPress={clearPendingReservation}>
                <Text className="text-orange-200 font-semibold">Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {items.map((item) => (
          <CartItemCard
            key={`${item.eventId}-${item.tier.id}`}
            item={item}
            onRemove={() => removeItem(item.eventId, item.tier.id)}
            onUpdateQuantity={(qty) => updateQuantity(item.eventId, item.tier.id, qty)}
          />
        ))}

        {/* Booking details */}
        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mt-4">
          <Text className="text-gold font-semibold mb-1">Booking Details</Text>
          <Text className="text-gold-stone text-sm mb-4">
            We’ll use these details for your confirmation, ticket delivery, and payment receipt.
          </Text>

          <Text className="text-gold-stone text-xs mb-2 uppercase tracking-widest">Full Name</Text>
          <TextInput
            placeholder="Your full name"
            placeholderTextColor="#666"
            value={attendeeName}
            onChangeText={setAttendeeName}
            className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mb-3"
          />

          <Text className="text-gold-stone text-xs mb-2 uppercase tracking-widest">Email</Text>
          <TextInput
            placeholder="name@email.com"
            placeholderTextColor="#666"
            value={attendeeEmail}
            onChangeText={setAttendeeEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold mb-3"
          />

          <Text className="text-gold-stone text-xs mb-2 uppercase tracking-widest">Phone</Text>
          <TextInput
            placeholder="Optional"
            placeholderTextColor="#666"
            value={attendeePhone}
            onChangeText={setAttendeePhone}
            keyboardType="phone-pad"
            className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold"
          />
        </View>

        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mt-4">
          <Text className="text-gold font-semibold mb-1">Referral</Text>
          <Text className="text-gold-stone text-sm mb-4">
            Have a promoter or referral code? We’ll include it in the same backend checkout flow
            used on the guest portal.
          </Text>

          <Text className="text-gold-stone text-xs mb-2 uppercase tracking-widest">
            Promoter / Referral Code
          </Text>
          <TextInput
            placeholder="Optional"
            placeholderTextColor="#666"
            value={promoterCode}
            onChangeText={setPromoterCode}
            autoCapitalize="characters"
            className="bg-surface border border-white/10 rounded-bubble px-4 py-3 text-gold"
          />
        </View>

        {/* Promo Code Section */}
        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mt-4">
          <Text className="text-gold font-semibold mb-3">🏷️ Promo Code</Text>

          {promo ? (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="bg-iris/20 px-3 py-2 rounded-pill mr-3">
                  <Text className="text-iris font-semibold">{promo.code}</Text>
                </View>
                <Text className="text-green-400">-₹{promo.discountAmount} applied!</Text>
              </View>
              <Pressable onPress={clearPromoCode}>
                <Text className="text-red-400">Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View className="flex-row">
                <TextInput
                  placeholder="Enter promo code"
                  placeholderTextColor="#666"
                  value={promoInput}
                  onChangeText={(text) => {
                    setPromoInput(text);
                    setPromoError(null);
                  }}
                  autoCapitalize="characters"
                  className="flex-1 bg-surface border border-white/10 rounded-l-bubble px-4 py-3 text-gold"
                />
                <Pressable
                  onPress={handleApplyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className={`px-6 rounded-r-bubble items-center justify-center ${
                    promoLoading || !promoInput.trim() ? 'bg-iris/50' : 'bg-iris'
                  }`}
                >
                  {promoLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold">Apply</Text>
                  )}
                </Pressable>
              </View>
              {promoError && <Text className="text-red-400 text-sm mt-2">{promoError}</Text>}
            </>
          )}
        </View>

        {/* Order Summary */}
        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mt-4">
          <Text className="text-gold font-semibold mb-4">Order Summary</Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-gold-stone">Subtotal</Text>
            <Text className="text-gold">₹{subtotal}</Text>
          </View>

          {discount > 0 && (
            <>
              <View className="flex-row justify-between mb-2">
                <Text className="text-green-400">
                  Discount {promo?.code ? `(${promo.code})` : ''}
                </Text>
                <Text className="text-green-400">-₹{discount}</Text>
              </View>
              {(pricing?.discounts || []).map((entry, index) => (
                <View
                  key={`${entry.code || entry.label || 'discount'}-${index}`}
                  className="flex-row justify-between mb-2"
                >
                  <Text className="text-green-300/80 text-sm">
                    {entry.label || entry.code || 'Applied discount'}
                  </Text>
                  <Text className="text-green-300/80 text-sm">-₹{Number(entry.amount || 0)}</Text>
                </View>
              ))}
            </>
          )}

          {!!fees && (
            <>
              {Number(pricing?.fees?.platform ?? pricing?.fees?.platformFee ?? 0) > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gold-stone">Platform Fee</Text>
                  <Text className="text-gold">
                    ₹{Number(pricing?.fees?.platform ?? pricing?.fees?.platformFee ?? 0).toFixed(0)}
                  </Text>
                </View>
              )}
              {Number(pricing?.fees?.payment ?? pricing?.fees?.paymentFee ?? 0) > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gold-stone">Payment Fee</Text>
                  <Text className="text-gold">
                    ₹{Number(pricing?.fees?.payment ?? pricing?.fees?.paymentFee ?? 0).toFixed(0)}
                  </Text>
                </View>
              )}
              {Number(pricing?.fees?.gst ?? 0) > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gold-stone">GST</Text>
                  <Text className="text-gold">₹{Number(pricing?.fees?.gst ?? 0).toFixed(0)}</Text>
                </View>
              )}
              <View className="flex-row justify-between mb-2">
                <Text className="text-gold-stone">Booking Fee</Text>
                <Text className="text-gold">₹{fees.toFixed(0)}</Text>
              </View>
            </>
          )}

          <View className="border-t border-white/10 mt-3 pt-3 flex-row justify-between">
            <Text className="text-gold font-satoshi-bold text-lg">Total</Text>
            <Text className="text-gold font-satoshi-bold text-lg">₹{total.toFixed(0)}</Text>
          </View>

          {pricingLoading && (
            <Text className="text-gold-stone text-xs mt-3">
              Updating your booking total from the server...
            </Text>
          )}
          {canResumePayment && pendingPaymentOrderId ? (
            <Text className="text-orange-200 text-xs mt-3">
              Payment is already initiated for this reservation. Tap below to reopen and complete
              it.
            </Text>
          ) : null}
        </View>

        {/* Security Notice */}
        <View className="flex-row items-center justify-center mt-4 mb-2">
          <Text className="text-gold-stone text-xs">🔒 Secured by Razorpay</Text>
        </View>

        {/* Terms Notice */}
        <Text className="text-gold-stone text-xs text-center mt-2">
          By proceeding, you agree to our Terms of Service and Refund Policy
        </Text>
      </ScrollView>

      {/* Fixed Bottom Checkout Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-midnight/95 border-t border-white/10 px-4 py-4">
        <SafeAreaView edges={['bottom']}>
          {/* Status indicator during checkout */}
          {checkoutStatus && checkoutLoading && (
            <View className="flex-row items-center justify-center mb-3">
              <ActivityIndicator size="small" color="#a78bfa" />
              <Text className="text-iris text-sm ml-2">
                {STATUS_LABELS[checkoutStatus] || 'Processing...'}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleCheckout}
            disabled={checkoutLoading}
            className={`py-4 rounded-pill items-center ${
              checkoutLoading ? 'bg-iris/50' : 'bg-iris'
            }`}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-lg">
                {canResumePayment
                  ? `Resume Payment${isFreeOrder ? '' : ` · ₹${total.toFixed(0)}`}`
                  : isFreeOrder
                    ? 'Confirm Booking'
                    : `Pay ₹${total.toFixed(0)}`}
              </Text>
            )}
          </Pressable>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

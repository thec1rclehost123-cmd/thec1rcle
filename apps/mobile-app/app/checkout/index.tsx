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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { useCartStore, CartItem } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { Image } from "expo-image";
import { processFullCheckout, type CheckoutStatus } from "@/lib/payments";

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
          ₹{item.tier.price * item.quantity}
        </Text>
      </View>
    </View>
  );
}

// ─── Status Labels ───────────────────────────────────────────────

const STATUS_LABELS: Record<CheckoutStatus, string> = {
  reserving: "Reserving your tickets...",
  initiating: "Processing order...",
  awaiting_payment: "Opening payment...",
  verifying: "Verifying payment...",
  confirmed: "Order confirmed!",
  failed: "Something went wrong",
  cancelled: "Payment cancelled",
};

// ─── Checkout Screen ─────────────────────────────────────────────

export default function CheckoutScreen() {
  const { user } = useAuthStore();
  const {
    items,
    promo,
    removeItem,
    updateQuantity,
    applyPromoCode,
    clearPromoCode,
    getSubtotal,
    getTotal,
    getCheckoutItems,
    getEventId,
    clearCart,
  } = useCartStore();

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);

  const subtotal = getSubtotal();
  const total = getTotal();
  const discount = promo?.discountAmount || 0;

  // ─── Promo Code Handler (validated via backend API) ──────────

  const handleApplyPromo = useCallback(async () => {
    if (!promoInput.trim()) return;
    const eventId = getEventId();
    if (!eventId) return;

    setPromoLoading(true);
    setPromoError(null);

    const result = await applyPromoCode(promoInput.trim(), eventId);

    if (!result.success) {
      setPromoError(result.error || "Invalid code");
    } else {
      setPromoInput(""); // Clear input on success
    }
    setPromoLoading(false);
  }, [promoInput, applyPromoCode, getEventId]);

  // ─── Checkout Handler (server-side flow) ─────────────────────

  const handleCheckout = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Login Required", "Please login to complete your purchase", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }

    if (items.length === 0) {
      Alert.alert("Empty Cart", "Add some tickets to continue");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutStatus(null);

    const eventId = getEventId();
    if (!eventId) {
      setCheckoutLoading(false);
      Alert.alert("Error", "Missing event information");
      return;
    }

    // Use the full server-side checkout flow
    const result = await processFullCheckout({
      eventId,
      eventTitle: items[0].eventTitle,
      items: getCheckoutItems(),
      userName: user.displayName || "Guest",
      userEmail: user.email || "",
      userPhone: undefined,
      promoCode: promo?.code || null,
      promoterCode: null, // TODO: pass from deep link params
      onStatusChange: (status) => setCheckoutStatus(status),
    });

    setCheckoutLoading(false);

    if (result.success && result.orderId) {
      // Clear the cart on success
      clearCart();

      router.replace({
        pathname: "/checkout/success",
        params: { orderId: result.orderId },
      });
    } else if (!result.success && result.error !== "Payment was cancelled") {
      Alert.alert("Checkout Failed", result.error || "Something went wrong", [
        { text: "Try Again", onPress: handleCheckout },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [user, items, promo, getEventId, getCheckoutItems, clearCart]);

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
            onPress={() => router.push("/(tabs)/explore")}
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
          Your Tickets ({items.length})
        </Text>

        {items.map((item) => (
          <CartItemCard
            key={`${item.eventId}-${item.tier.id}`}
            item={item}
            onRemove={() => removeItem(item.eventId, item.tier.id)}
            onUpdateQuantity={(qty) => updateQuantity(item.eventId, item.tier.id, qty)}
          />
        ))}

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
                    promoLoading || !promoInput.trim() ? "bg-iris/50" : "bg-iris"
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
            <View className="flex-row justify-between mb-2">
              <Text className="text-green-400">
                Discount {promo?.code ? `(${promo.code})` : ""}
              </Text>
              <Text className="text-green-400">-₹{discount}</Text>
            </View>
          )}

          <View className="flex-row justify-between mb-2">
            <Text className="text-gold-stone">Booking Fee</Text>
            <Text className="text-gold">₹0</Text>
          </View>

          <View className="border-t border-white/10 mt-3 pt-3 flex-row justify-between">
            <Text className="text-gold font-satoshi-bold text-lg">Total</Text>
            <Text className="text-gold font-satoshi-bold text-lg">₹{total.toFixed(0)}</Text>
          </View>
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
        <SafeAreaView edges={["bottom"]}>
          {/* Status indicator during checkout */}
          {checkoutStatus && checkoutLoading && (
            <View className="flex-row items-center justify-center mb-3">
              <ActivityIndicator size="small" color="#a78bfa" />
              <Text className="text-iris text-sm ml-2">
                {STATUS_LABELS[checkoutStatus] || "Processing..."}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleCheckout}
            disabled={checkoutLoading}
            className={`py-4 rounded-pill items-center ${
              checkoutLoading ? "bg-iris/50" : "bg-iris"
            }`}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-lg">
                {total === 0 ? "Confirm RSVP (Free)" : `Pay ₹${total.toFixed(0)}`}
              </Text>
            )}
          </Pressable>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

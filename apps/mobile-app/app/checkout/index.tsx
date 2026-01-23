import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useCartStore, CartItem } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { Image } from "expo-image";

// Cart item component
function CartItemCard({ item, onRemove, onUpdateQuantity }: {
    item: CartItem;
    onRemove: () => void;
    onUpdateQuantity: (qty: number) => void;
}) {
    return (
        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-3">
            <View className="flex-row">
                {/* Event Image */}
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

                {/* Item Details */}
                <View className="flex-1">
                    <Text className="text-gold font-semibold" numberOfLines={1}>
                        {item.eventTitle}
                    </Text>
                    <Text className="text-gold-stone text-sm">{item.tier.name}</Text>
                    <Text className="text-iris font-semibold mt-1">
                        ₹{item.tier.price} × {item.quantity}
                    </Text>
                </View>

                {/* Remove Button */}
                <Pressable onPress={onRemove} className="p-2">
                    <Text className="text-red-400">✕</Text>
                </Pressable>
            </View>

            {/* Quantity Controls */}
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
                <View className="flex-row items-center bg-surface rounded-pill border border-white/10">
                    <Pressable
                        onPress={() => onUpdateQuantity(item.quantity - 1)}
                        className="px-4 py-2"
                    >
                        <Text className="text-gold text-lg">−</Text>
                    </Pressable>
                    <Text className="text-gold font-semibold px-3">{item.quantity}</Text>
                    <Pressable
                        onPress={() => onUpdateQuantity(item.quantity + 1)}
                        className="px-4 py-2"
                    >
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

export default function CheckoutScreen() {
    const { user } = useAuthStore();
    const {
        items,
        promoCode,
        promoDiscount,
        removeItem,
        updateQuantity,
        applyPromoCode,
        clearPromoCode,
        getSubtotal,
        getTotal,
        createOrder,
        clearCart
    } = useCartStore();

    const [promoInput, setPromoInput] = useState("");
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const subtotal = getSubtotal();
    const total = getTotal();
    const discount = subtotal - total;

    const handleApplyPromo = async () => {
        if (!promoInput.trim()) return;
        setPromoLoading(true);
        setPromoError(null);

        const result = await applyPromoCode(promoInput.trim());

        if (!result.success) {
            setPromoError(result.error || "Invalid code");
        }
        setPromoLoading(false);
    };

    const handleCheckout = async () => {
        if (!user?.uid) {
            Alert.alert("Login Required", "Please login to complete your purchase", [
                { text: "Cancel", style: "cancel" },
                { text: "Login", onPress: () => router.push("/(auth)/login") }
            ]);
            return;
        }

        if (items.length === 0) {
            Alert.alert("Empty Cart", "Add some tickets to continue");
            return;
        }

        setCheckoutLoading(true);

        // Create order first
        const orderResult = await createOrder(user.uid);

        if (!orderResult.success || !orderResult.orderId) {
            setCheckoutLoading(false);
            Alert.alert("Error", orderResult.error || "Failed to create order");
            return;
        }

        // If free tickets, go directly to success
        if (total === 0) {
            setCheckoutLoading(false);
            router.replace({
                pathname: "/checkout/success",
                params: { orderId: orderResult.orderId }
            });
            return;
        }

        // For paid orders, process payment
        const { processPayment } = await import("@/lib/payments");

        const paymentResult = await processPayment(
            orderResult.orderId,
            total,
            user.email || undefined,
            undefined, // phone - could get from user profile
            user.displayName || undefined
        );

        setCheckoutLoading(false);

        if (paymentResult.success) {
            router.replace({
                pathname: "/checkout/success",
                params: { orderId: orderResult.orderId }
            });
        } else {
            Alert.alert(
                "Payment Failed",
                paymentResult.error || "Something went wrong with the payment",
                [
                    { text: "Try Again", onPress: handleCheckout },
                    { text: "Cancel", style: "cancel" }
                ]
            );
        }
    };

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
                    <Text className="text-gold font-satoshi-bold text-xl mb-2">
                        Your Cart is Empty
                    </Text>
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

                    {promoCode ? (
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="bg-iris/20 px-3 py-2 rounded-pill mr-3">
                                    <Text className="text-iris font-semibold">{promoCode}</Text>
                                </View>
                                <Text className="text-green-400">-{promoDiscount}% applied!</Text>
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
                                    className={`px-6 rounded-r-bubble items-center justify-center ${promoLoading || !promoInput.trim() ? "bg-iris/50" : "bg-iris"
                                        }`}
                                >
                                    {promoLoading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text className="text-white font-semibold">Apply</Text>
                                    )}
                                </Pressable>
                            </View>
                            {promoError && (
                                <Text className="text-red-400 text-sm mt-2">{promoError}</Text>
                            )}
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
                            <Text className="text-green-400">Discount</Text>
                            <Text className="text-green-400">-₹{discount.toFixed(0)}</Text>
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

                {/* Terms Notice */}
                <Text className="text-gold-stone text-xs text-center mt-4">
                    By proceeding, you agree to our Terms of Service and Refund Policy
                </Text>
            </ScrollView>

            {/* Fixed Bottom Checkout Button */}
            <View className="absolute bottom-0 left-0 right-0 bg-midnight/95 border-t border-white/10 px-4 py-4">
                <SafeAreaView edges={["bottom"]}>
                    <Pressable
                        onPress={handleCheckout}
                        disabled={checkoutLoading}
                        className={`py-4 rounded-pill items-center ${checkoutLoading ? "bg-iris/50" : "bg-iris"
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

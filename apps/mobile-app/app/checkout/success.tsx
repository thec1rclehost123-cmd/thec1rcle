import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Share } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/store/authStore";
import { useEventInterestStore } from "@/store/eventInterestStore";
import { useProfileStore } from "@/store/profileStore";
import { Order, useTicketsStore } from "@/store/ticketsStore";

interface OrderDetails {
    id: string;
    eventTitle: string;
    eventDate?: string;
    venueLocation?: string;
    totalAmount: number;
    status: string;
    items: {
        tierName: string;
        quantity: number;
    }[];
}

export default function CheckoutSuccessScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const { user } = useAuthStore();
    const { fetchUserOrders, getOrderById } = useTicketsStore();
    const { joinEventGroupChat } = useEventInterestStore();
    const profile = useProfileStore((s) => s.profile);
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);

    const scale = useSharedValue(0);
    const checkScale = useSharedValue(0);

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        scale.value = withSpring(1, { damping: 12 });
        checkScale.value = withDelay(300, withSpring(1, { damping: 10 }));
        void fetchOrder();
    }, [orderId, user?.uid]);

    const mapStoreOrder = (storeOrder: Order): OrderDetails => ({
        id: storeOrder.id,
        eventTitle: storeOrder.eventTitle || "Event",
        eventDate: storeOrder.eventStartDate || storeOrder.eventDate,
        venueLocation: storeOrder.venueLocation,
        totalAmount: storeOrder.totalAmount || 0,
        status: storeOrder.status,
        items: storeOrder.tickets.map((ticket) => ({
            tierName: ticket.tierName || "Ticket",
            quantity: ticket.quantity || 1,
        })),
    });

    const fetchOrder = async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        try {
            if (user?.uid) {
                await fetchUserOrders(user.uid).catch(() => {});
            }

            const storeOrder = await getOrderById(orderId).catch(() => null);
            if (storeOrder) {
                setOrder(mapStoreOrder(storeOrder));
                // Auto-join event group chat on confirmed ticket purchase
                if (user?.uid && storeOrder.eventId) {
                    void joinEventGroupChat(storeOrder.eventId, user.uid, {
                        displayName: profile?.displayName ?? user.displayName ?? "",
                        photoURL: profile?.photoURL ?? user.photoURL ?? null,
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching order:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🎉 I'm going to ${order?.eventTitle}! Join me on THE C1RCLE app.`,
            });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator size="large" color="#F44A22" />
                <Text className="text-gold-stone mt-4">Processing your order...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.2)", "transparent"]}
                className="absolute top-0 left-0 right-0 h-96"
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <View className="flex-1 items-center justify-center px-6">
                <Animated.View style={circleStyle}>
                    <View className="w-32 h-32 rounded-full bg-iris/20 items-center justify-center mb-8">
                        <Animated.View style={checkStyle}>
                            <Text className="text-6xl">✓</Text>
                        </Animated.View>
                    </View>
                </Animated.View>

                <Text className="text-gold font-satoshi-black text-3xl text-center mb-2">You're In! 🎉</Text>
                <Text className="text-gold-stone text-center mb-8">Your tickets have been confirmed</Text>

                {order && (
                    <View className="bg-midnight-100 rounded-bubble border border-white/10 p-6 w-full mb-8">
                        <Text className="text-gold font-satoshi-bold text-lg mb-4">{order.eventTitle}</Text>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Date</Text>
                            <Text className="text-gold">
                                {order.eventDate ? new Date(order.eventDate).toLocaleDateString("en-IN", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                }) : "TBA"}
                            </Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Venue</Text>
                            <Text className="text-gold" numberOfLines={1}>{order.venueLocation}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Tickets</Text>
                            <Text className="text-gold">{order.items.reduce((sum, i) => sum + i.quantity, 0)} ticket(s)</Text>
                        </View>
                        <View className="border-t border-white/10 mt-3 pt-3 flex-row justify-between">
                            <Text className="text-gold font-semibold">Total Paid</Text>
                            <Text className="text-iris font-satoshi-bold text-lg">{order.totalAmount === 0 ? "Free" : `₹${order.totalAmount}`}</Text>
                        </View>
                    </View>
                )}

                <View className="w-full">
                    <Pressable onPress={() => router.replace("/(tabs)/tickets")} className="bg-iris py-4 rounded-pill items-center mb-3">
                        <Text className="text-white font-semibold text-lg">View My Tickets</Text>
                    </Pressable>
                    <Pressable onPress={handleShare} className="bg-surface border border-white/10 py-4 rounded-pill items-center mb-3">
                        <Text className="text-gold font-semibold">Share with Friends 📤</Text>
                    </Pressable>
                    <Pressable onPress={() => router.replace("/(tabs)/explore")} className="py-3 items-center">
                        <Text className="text-gold-stone">Back to Explore</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withDelay
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface OrderDetails {
    id: string;
    eventTitle: string;
    eventDate: string;
    venueLocation: string;
    totalAmount: number;
    status: string;
    items: Array<{
        tierName: string;
        quantity: number;
    }>;
}

export default function CheckoutSuccessScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);

    // Animations
    const scale = useSharedValue(0);
    const checkScale = useSharedValue(0);

    useEffect(() => {
        // Trigger success haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Animate in
        scale.value = withSpring(1, { damping: 12 });
        checkScale.value = withDelay(300, withSpring(1, { damping: 10 }));

        // Fetch order details
        fetchOrder();
    }, []);

    const fetchOrder = async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        try {
            const db = getFirebaseDb();
            const orderRef = doc(db, "orders", orderId);
            const orderDoc = await getDoc(orderRef);

            if (orderDoc.exists()) {
                const data = orderDoc.data();
                setOrder({
                    id: orderDoc.id,
                    eventTitle: data.eventTitle,
                    eventDate: data.eventDate,
                    venueLocation: data.venueLocation,
                    totalAmount: data.totalAmount,
                    status: data.status,
                    items: data.items,
                });

                // Update order status to confirmed (simulating payment success)
                await updateDoc(orderRef, {
                    status: "confirmed",
                    confirmedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
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
            {/* Background Gradient */}
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.2)", "transparent"]}
                className="absolute top-0 left-0 right-0 h-96"
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <View className="flex-1 items-center justify-center px-6">
                {/* Success Animation */}
                <Animated.View style={circleStyle}>
                    <View className="w-32 h-32 rounded-full bg-iris/20 items-center justify-center mb-8">
                        <Animated.View style={checkStyle}>
                            <Text className="text-6xl">✓</Text>
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* Success Message */}
                <Text className="text-gold font-satoshi-black text-3xl text-center mb-2">
                    You're In! 🎉
                </Text>
                <Text className="text-gold-stone text-center mb-8">
                    Your tickets have been confirmed
                </Text>

                {/* Order Summary Card */}
                {order && (
                    <View className="bg-midnight-100 rounded-bubble border border-white/10 p-6 w-full mb-8">
                        <Text className="text-gold font-satoshi-bold text-lg mb-4">
                            {order.eventTitle}
                        </Text>

                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Date</Text>
                            <Text className="text-gold">
                                {new Date(order.eventDate).toLocaleDateString("en-IN", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </Text>
                        </View>

                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Venue</Text>
                            <Text className="text-gold" numberOfLines={1}>{order.venueLocation}</Text>
                        </View>

                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gold-stone">Tickets</Text>
                            <Text className="text-gold">
                                {order.items.reduce((sum, i) => sum + i.quantity, 0)} ticket(s)
                            </Text>
                        </View>

                        <View className="border-t border-white/10 mt-3 pt-3 flex-row justify-between">
                            <Text className="text-gold font-semibold">Total Paid</Text>
                            <Text className="text-iris font-satoshi-bold text-lg">
                                {order.totalAmount === 0 ? "Free" : `₹${order.totalAmount}`}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <View className="w-full space-y-3">
                    <Pressable
                        onPress={() => router.replace("/(tabs)/tickets")}
                        className="bg-iris py-4 rounded-pill items-center mb-3"
                    >
                        <Text className="text-white font-semibold text-lg">View My Tickets</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleShare}
                        className="bg-surface border border-white/10 py-4 rounded-pill items-center mb-3"
                    >
                        <Text className="text-gold font-semibold">Share with Friends 📤</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.replace("/(tabs)/explore")}
                        className="py-3 items-center"
                    >
                        <Text className="text-gold-stone">Back to Explore</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

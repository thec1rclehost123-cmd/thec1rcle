/**
 * THE C1RCLE — Checkout Success Screen
 * 
 * This screen now acts as a redirect to the new "You're Going" celebration screen.
 * It provides a brief loading state and then navigates to the full experience.
 */

import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors } from "@/lib/design/theme";

export default function CheckoutSuccessScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();

    useEffect(() => {
        // Trigger success haptic immediately
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Redirect to the "You're Going" celebration screen
        const timer = setTimeout(() => {
            if (orderId) {
                router.replace({
                    pathname: "/going/[orderId]",
                    params: { orderId }
                });
            } else {
                // Fallback to tickets if no orderId
                router.replace("/(tabs)/tickets");
            }
        }, 300); // Brief delay to show loading transition

        return () => clearTimeout(timer);
    }, [orderId]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.base.DEFAULT }}>
            {/* Background Gradient */}
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.3)", "transparent", colors.base.DEFAULT]}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "100%",
                }}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#F44A22" />
                <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 16, fontSize: 16 }}>
                    Confirming your tickets...
                </Text>
            </View>
        </SafeAreaView>
    );
}

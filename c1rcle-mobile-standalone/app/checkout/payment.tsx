/**
 * THE C1RCLE — Final Checkout / User Details
 * 
 * This screen collects user info and initiates the final transaction.
 */

import { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Pressable,
    Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { colors, radii, shadows } from "@/lib/design/theme";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";

export default function PaymentScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { checkout, pricing, items, isProcessing, clearCart } = useCartStore();
    const { eventId } = useLocalSearchParams<{ eventId: string }>();

    const [form, setForm] = useState({
        name: user?.displayName || "",
        email: user?.email || "",
        phone: "", // Should ideally come from profile if stored
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.email.trim() || !form.email.includes("@")) newErrors.email = "Valid email is required";
        if (!form.phone.trim() || form.phone.length < 10) newErrors.phone = "Valid phone is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleProceed = async () => {
        if (!validate()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        const result = await checkout({
            name: form.name,
            email: form.email,
            phone: form.phone
        });

        if (result.success) {
            if (result.requiresPayment && result.razorpay) {
                // Initialize Payment Flow (Razorpay + Verification)
                const { processPaymentFlow } = await import("@/lib/payments");

                const paymentResult = await processPaymentFlow(
                    result.order.id,
                    result.razorpay,
                    {
                        email: form.email,
                        contact: form.phone,
                        name: form.name
                    }
                );

                if (paymentResult.success) {
                    router.replace({
                        pathname: "/checkout/success",
                        params: { orderId: result.order.id }
                    });
                } else {
                    Alert.alert("Payment Failed", paymentResult.error || "Could not verify payment.");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
            } else {
                // Free/RSVP skip payment
                router.replace({
                    pathname: "/checkout/success",
                    params: { orderId: result.order.id }
                });
            }
        } else {
            Alert.alert("Checkout Error", result.error || "Failed to initiate checkout");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.gold} />
                </Pressable>
                <Text style={styles.headerTitle}>Attendee Info</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                    <Text style={styles.sectionTitle}>Where should we send your tickets?</Text>
                    <Text style={styles.sectionSubtitle}>Tickets will be sent to this email and linked to your phone number.</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>FULL NAME</Text>
                        <TextInput
                            style={[styles.input, errors.name && styles.inputError]}
                            value={form.name}
                            onChangeText={(val) => setForm({ ...form, name: val })}
                            placeholder="Alex Smith"
                            placeholderTextColor={colors.goldMetallic}
                            keyboardAppearance="dark"
                        />
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>EMAIL ADDRESS</Text>
                        <TextInput
                            style={[styles.input, errors.email && styles.inputError]}
                            value={form.email}
                            onChangeText={(val) => setForm({ ...form, email: val })}
                            placeholder="alex@example.com"
                            placeholderTextColor={colors.goldMetallic}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            keyboardAppearance="dark"
                        />
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>PHONE NUMBER</Text>
                        <TextInput
                            style={[styles.input, errors.phone && styles.inputError]}
                            value={form.phone}
                            onChangeText={(val) => setForm({ ...form, phone: val })}
                            placeholder="+91 98765 43210"
                            placeholderTextColor={colors.goldMetallic}
                            keyboardType="phone-pad"
                            keyboardAppearance="dark"
                        />
                        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                    </View>
                </Animated.View>

                {/* Order Summary Recap */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Order Summary</Text>
                    {items.map((item, idx) => (
                        <View key={idx} style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>{item.quantity}x {item.tier.name}</Text>
                            <Text style={styles.summaryValue}>₹{(item.quantity * item.tier.price).toLocaleString()}</Text>
                        </View>
                    ))}
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalValue}>₹{pricing?.grandTotal.toLocaleString() || "0"}</Text>
                    </View>
                </Animated.View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <PremiumButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleProceed}
                    loading={isProcessing}
                >
                    {pricing?.isFreeOrder ? "Confirm Reservation" : "Proceed to Payment"}
                </PremiumButton>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
    },
    scrollContent: {
        padding: 24,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 8,
    },
    sectionSubtitle: {
        color: colors.goldMetallic,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: colors.goldMetallic,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: colors.base[50],
        borderRadius: radii.lg,
        height: 56,
        color: colors.gold,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    inputError: {
        borderColor: colors.error,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    summaryCard: {
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: radii.xl,
        padding: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    summaryTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    summaryLabel: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    summaryValue: {
        color: colors.gold,
        fontSize: 14,
    },
    totalRow: {
        marginTop: 10,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.1)",
    },
    totalLabel: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
    },
    totalValue: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: "800",
    },
    footer: {
        padding: 20,
        backgroundColor: colors.base.DEFAULT,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
    },
});

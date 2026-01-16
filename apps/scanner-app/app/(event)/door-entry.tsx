import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEvent, EventTier } from "@/store/eventContext";
import { createDoorEntry } from "@/lib/api/doorEntry";
import DoorEntrySuccess from "@/components/DoorEntry/DoorEntrySuccess";

type PaymentMethod = "cash" | "upi" | "card";

export default function DoorEntryScreen() {
    const { eventData } = useEvent();

    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [selectedTier, setSelectedTier] = useState<EventTier | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

    const tiers = eventData?.tiers || [];
    const canDoorEntry = eventData?.permissions.canDoorEntry ?? false;

    const calculateTotal = () => {
        if (!selectedTier) return 0;
        return selectedTier.price * quantity;
    };

    const resetForm = () => {
        setGuestName("");
        setGuestPhone("");
        setSelectedTier(null);
        setQuantity(1);
        setPaymentMethod("cash");
        setSuccessData(null);
    };

    const handleSubmit = async () => {
        if (!guestName.trim()) {
            Alert.alert("Required", "Please enter guest name");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        if (!selectedTier) {
            Alert.alert("Required", "Please select a ticket type");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await createDoorEntry({
                eventCode: eventData?.code || "",
                eventId: eventData?.event.id || "",
                guestName: guestName.trim(),
                guestPhone: guestPhone.trim() || undefined,
                tierId: selectedTier.id,
                tierName: selectedTier.name,
                entryType: selectedTier.entryType,
                quantity,
                unitPrice: selectedTier.price,
                totalAmount: calculateTotal(),
                paymentMethod,
                gate: eventData?.gate,
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSuccessData({
                    ...result,
                    guestName: guestName.trim(),
                    tierName: selectedTier.name,
                    quantity,
                    total: calculateTotal(),
                });
            } else {
                Alert.alert("Error", result.error || "Failed to create entry");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Something went wrong");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show success screen
    if (successData) {
        return (
            <DoorEntrySuccess
                data={successData}
                onDone={resetForm}
            />
        );
    }

    // Check permission
    if (!canDoorEntry) {
        return (
            <SafeAreaView className="flex-1 bg-background-primary items-center justify-center px-6">
                <Ionicons name="lock-closed" size={64} color="#71717A" />
                <Text className="text-text-primary text-xl font-bold mt-4 text-center">
                    Door Entry Disabled
                </Text>
                <Text className="text-text-secondary text-center mt-2">
                    This event code does not have door entry permission
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-primary" edges={["bottom"]}>
            <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
                {/* Guest Info Section */}
                <View className="mb-6">
                    <Text className="text-text-secondary text-sm font-medium mb-2">
                        GUEST INFORMATION
                    </Text>
                    <View className="bg-background-secondary rounded-xl p-4">
                        <TextInput
                            value={guestName}
                            onChangeText={setGuestName}
                            placeholder="Guest Name *"
                            placeholderTextColor="#71717A"
                            className="text-text-primary text-lg py-3 border-b border-border"
                            autoCapitalize="words"
                        />
                        <TextInput
                            value={guestPhone}
                            onChangeText={setGuestPhone}
                            placeholder="Phone (optional)"
                            placeholderTextColor="#71717A"
                            className="text-text-primary text-lg py-3 mt-2"
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                {/* Ticket Type Section */}
                <View className="mb-6">
                    <Text className="text-text-secondary text-sm font-medium mb-2">
                        TICKET TYPE
                    </Text>
                    <View className="flex-row flex-wrap gap-3">
                        {tiers.map((tier) => (
                            <TouchableOpacity
                                key={tier.id}
                                onPress={() => {
                                    setSelectedTier(tier);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                disabled={!tier.available}
                                className={`
                  flex-1 min-w-[100px] p-4 rounded-xl border-2
                  ${selectedTier?.id === tier.id
                                        ? "bg-accent/20 border-accent"
                                        : tier.available
                                            ? "bg-background-secondary border-border"
                                            : "bg-background-secondary/50 border-border/50"
                                    }
                `}
                            >
                                <Text
                                    className={`text-lg font-bold text-center ${selectedTier?.id === tier.id
                                            ? "text-accent"
                                            : tier.available
                                                ? "text-text-primary"
                                                : "text-text-muted"
                                        }`}
                                >
                                    {tier.name}
                                </Text>
                                <Text
                                    className={`text-2xl font-bold text-center mt-1 ${selectedTier?.id === tier.id
                                            ? "text-accent-light"
                                            : tier.available
                                                ? "text-text-primary"
                                                : "text-text-muted"
                                        }`}
                                >
                                    ₹{tier.price}
                                </Text>
                                {!tier.available && (
                                    <Text className="text-text-muted text-xs text-center mt-1">
                                        Sold Out
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Quantity Section */}
                <View className="mb-6">
                    <Text className="text-text-secondary text-sm font-medium mb-2">
                        QUANTITY
                    </Text>
                    <View className="flex-row items-center bg-background-secondary rounded-xl p-4">
                        <TouchableOpacity
                            onPress={() => {
                                if (quantity > 1) {
                                    setQuantity(quantity - 1);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                            }}
                            disabled={quantity <= 1}
                            className={`w-14 h-14 rounded-xl items-center justify-center ${quantity <= 1 ? "bg-border" : "bg-accent"
                                }`}
                        >
                            <Ionicons name="remove" size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <Text className="flex-1 text-center text-4xl font-bold text-text-primary">
                            {quantity}
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                setQuantity(quantity + 1);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            className="w-14 h-14 rounded-xl bg-accent items-center justify-center"
                        >
                            <Ionicons name="add" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Payment Method Section */}
                <View className="mb-6">
                    <Text className="text-text-secondary text-sm font-medium mb-2">
                        PAYMENT METHOD
                    </Text>
                    <View className="flex-row gap-3">
                        {[
                            { id: "cash" as const, icon: "cash-outline" as const, label: "Cash" },
                            { id: "upi" as const, icon: "qr-code-outline" as const, label: "UPI" },
                            { id: "card" as const, icon: "card-outline" as const, label: "Card" },
                        ].map((method) => (
                            <TouchableOpacity
                                key={method.id}
                                onPress={() => {
                                    setPaymentMethod(method.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={`
                  flex-1 py-4 rounded-xl border-2 items-center
                  ${paymentMethod === method.id
                                        ? "bg-accent/20 border-accent"
                                        : "bg-background-secondary border-border"
                                    }
                `}
                            >
                                <Ionicons
                                    name={method.icon}
                                    size={24}
                                    color={paymentMethod === method.id ? "#6366F1" : "#A1A1AA"}
                                />
                                <Text
                                    className={`mt-1 font-medium ${paymentMethod === method.id ? "text-accent" : "text-text-secondary"
                                        }`}
                                >
                                    {method.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Spacer for fixed bottom */}
                <View className="h-32" />
            </ScrollView>

            {/* Fixed Bottom - Total & Submit */}
            <View className="absolute bottom-0 left-0 right-0 bg-background-elevated border-t border-border px-4 py-4 pb-8">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-text-secondary text-lg">Total</Text>
                    <Text className="text-text-primary text-3xl font-bold">
                        ₹{calculateTotal().toLocaleString()}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isSubmitting || !selectedTier || !guestName.trim()}
                    className={`
            py-4 rounded-xl flex-row items-center justify-center
            ${isSubmitting || !selectedTier || !guestName.trim()
                            ? "bg-success/50"
                            : "bg-success"
                        }
          `}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                            <Text className="text-white font-bold text-xl ml-2">
                                Admit Guest
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

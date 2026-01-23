import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { initiateTransfer, acceptTransfer } from "@/lib/transfers";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/design/theme";

export default function TransferScreen() {
    const { orderId, ticketName } = useLocalSearchParams<{ orderId?: string; ticketName?: string }>();
    const { user } = useAuthStore();

    const [mode, setMode] = useState<"send" | "receive">("send");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [transferCode, setTransferCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [transferResult, setTransferResult] = useState<{ code: string } | null>(null);

    const handleInitiateTransfer = async () => {
        if (!orderId || !user?.uid || !recipientEmail.trim()) {
            Alert.alert("Error", "Please enter recipient email");
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await initiateTransfer(
            orderId,
            user.uid,
            { name: ticketName || "Ticket", quantity: 1 },
            recipientEmail.trim()
        );

        setLoading(false);

        if (result.success && result.transferCode) {
            setTransferResult({ code: result.transferCode });
        } else {
            Alert.alert("Error", result.error || "Failed to initiate transfer");
        }
    };

    const handleAcceptTransfer = async () => {
        if (!user?.uid || !transferCode.trim()) {
            Alert.alert("Error", "Please enter transfer code");
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await acceptTransfer(transferCode.trim().toUpperCase(), user.uid);

        setLoading(false);

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                "Success!",
                "Ticket transferred successfully! Check your My Tickets.",
                [{ text: "View Tickets", onPress: () => router.replace("/(tabs)/tickets") }]
            );
        } else {
            Alert.alert("Error", result.error || "Failed to accept transfer");
        }
    };

    const handleShareCode = async () => {
        if (!transferResult?.code) return;

        try {
            await Share.share({
                message: `I'm sending you a ticket!\n\nUse this code in THE C1RCLE app to claim it:\n\n${transferResult.code}\n\nCode expires in 24 hours.`,
            });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    // Success state after initiating transfer
    if (transferResult) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color={colors.gold} />
                    </Pressable>
                    <Text className="text-gold font-satoshi-bold text-xl">Transfer Ticket</Text>
                </View>

                <View className="flex-1 items-center justify-center px-6">
                    <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} style={{ marginBottom: 16 }} />
                    <Text className="text-gold font-satoshi-bold text-2xl mb-2">Transfer Initiated!</Text>
                    <Text className="text-gold-stone text-center mb-8">
                        Share this code with your friend
                    </Text>

                    <View className="bg-midnight-100 rounded-bubble border border-iris p-6 mb-6 w-full items-center">
                        <Text className="text-gold-stone text-sm mb-2">Transfer Code</Text>
                        <Text className="text-iris font-satoshi-black text-4xl tracking-widest">
                            {transferResult.code}
                        </Text>
                        <Text className="text-gold-stone text-xs mt-3">Expires in 24 hours</Text>
                    </View>

                    <Pressable
                        onPress={handleShareCode}
                        className="bg-iris py-4 px-8 rounded-pill mb-4"
                    >
                        <Text className="text-white font-semibold">Share Code</Text>
                        <Ionicons name="share-outline" size={18} color="white" style={{ marginLeft: 8 }} />
                    </Pressable>

                    <Pressable
                        onPress={() => router.back()}
                        className="py-3"
                    >
                        <Text className="text-gold-stone">Done</Text>
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
                    <Ionicons name="arrow-back" size={24} color={colors.gold} />
                </Pressable>
                <Text className="text-gold font-satoshi-bold text-xl">Transfer Ticket</Text>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Mode Selector */}
                <View className="flex-row bg-surface rounded-pill p-1 mb-6 border border-white/10">
                    <Pressable
                        onPress={() => setMode("send")}
                        className={`flex-1 py-3 rounded-pill items-center ${mode === "send" ? "bg-iris" : ""}`}
                    >
                        <Text className={mode === "send" ? "text-white font-semibold" : "text-gold-stone"}>
                            Send Ticket
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setMode("receive")}
                        className={`flex-1 py-3 rounded-pill items-center ${mode === "receive" ? "bg-iris" : ""}`}
                    >
                        <Text className={mode === "receive" ? "text-white font-semibold" : "text-gold-stone"}>
                            Receive Ticket
                        </Text>
                    </Pressable>
                </View>

                {mode === "send" ? (
                    <>
                        {/* Send Ticket Mode */}
                        <View className="bg-midnight-100 rounded-bubble border border-white/10 p-4 mb-6">
                            <View className="flex-row items-center mb-1">
                                <Ionicons name="send-outline" size={16} color={colors.gold} style={{ marginRight: 8 }} />
                                <Text className="text-gold font-semibold">Sending</Text>
                            </View>
                            <Text className="text-iris">{ticketName || "1 Ticket"}</Text>
                        </View>

                        <Text className="text-gold-stone text-sm mb-2">Recipient's Email</Text>
                        <TextInput
                            placeholder="friend@email.com"
                            placeholderTextColor="#666"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={recipientEmail}
                            onChangeText={setRecipientEmail}
                            className="bg-surface border border-white/10 rounded-bubble px-4 py-4 text-gold mb-6"
                        />

                        <Pressable
                            onPress={handleInitiateTransfer}
                            disabled={loading || !recipientEmail.trim()}
                            className={`py-4 rounded-pill items-center ${loading || !recipientEmail.trim() ? "bg-iris/50" : "bg-iris"
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-semibold text-lg">Generate Transfer Code</Text>
                            )}
                        </Pressable>

                        <Text className="text-gold-stone text-xs text-center mt-4">
                            The recipient will need to enter the code in the app to receive the ticket
                        </Text>
                    </>
                ) : (
                    <>
                        {/* Receive Ticket Mode */}
                        <View className="items-center mb-6">
                            <Ionicons name="ticket-outline" size={64} color={colors.gold} style={{ marginBottom: 16 }} />
                            <Text className="text-gold font-semibold text-lg">Enter Transfer Code</Text>
                            <Text className="text-gold-stone text-center mt-2">
                                Ask your friend for the 6-character code
                            </Text>
                        </View>

                        <TextInput
                            placeholder="ABC123"
                            placeholderTextColor="#666"
                            autoCapitalize="characters"
                            maxLength={6}
                            value={transferCode}
                            onChangeText={setTransferCode}
                            className="bg-surface border border-white/10 rounded-bubble px-4 py-4 text-gold text-center text-2xl font-bold tracking-widest mb-6"
                        />

                        <Pressable
                            onPress={handleAcceptTransfer}
                            disabled={loading || transferCode.length !== 6}
                            className={`py-4 rounded-pill items-center ${loading || transferCode.length !== 6 ? "bg-iris/50" : "bg-iris"
                                }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-semibold text-lg">Claim Ticket</Text>
                            )}
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

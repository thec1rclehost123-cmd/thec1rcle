import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { reportUser, UserReport } from "@/lib/social";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

const REPORT_CATEGORIES: Array<{
    id: UserReport["category"];
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
    description: string;
}> = [
        {
            id: "harassment",
            label: "Harassment",
            iconName: "alert-circle-outline",
            description: "Bullying, threats, or intimidation"
        },
        {
            id: "spam",
            label: "Spam",
            iconName: "mail-outline",
            description: "Promotional content or repetitive messages"
        },
        {
            id: "inappropriate",
            label: "Inappropriate Content",
            iconName: "remove-circle-outline",
            description: "Explicit, offensive, or harmful content"
        },
        {
            id: "safety",
            label: "Safety Concern",
            iconName: "warning-outline",
            description: "Potential danger to you or others"
        },
        {
            id: "other",
            label: "Other",
            iconName: "create-outline",
            description: "Something else that breaks our guidelines"
        },
    ];

export default function ReportScreen() {
    const { userId, eventId, messageId } = useLocalSearchParams<{
        userId: string;
        eventId?: string;
        messageId?: string;
    }>();
    const { user } = useAuthStore();

    const [selectedCategory, setSelectedCategory] = useState<UserReport["category"] | null>(null);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!selectedCategory || !user?.uid || !userId) return;

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await reportUser(
            user.uid,
            userId,
            selectedCategory,
            description || undefined,
            eventId,
            messageId
        );

        setLoading(false);

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                "Report Submitted",
                "Thank you for helping keep THE C1RCLE safe. We'll review this report within 24 hours.",
                [{ text: "OK", onPress: () => router.back() }]
            );
        } else {
            Alert.alert("Error", result.error || "Failed to submit report");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-midnight">
            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-white/10">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Text className="text-gold text-lg">Cancel</Text>
                </Pressable>
                <Text className="text-gold font-satoshi-bold text-xl flex-1">Report User</Text>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingVertical: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Info */}
                <View className="bg-surface border border-white/10 rounded-bubble p-4 mb-6">
                    <Text className="text-gold-stone text-sm">
                        Reports are reviewed by our safety team. We take all reports seriously
                        and will take action if our guidelines are violated.
                    </Text>
                </View>

                {/* Category Selection */}
                <Text className="text-gold font-semibold text-lg mb-4">
                    What's the issue?
                </Text>

                {REPORT_CATEGORIES.map((cat) => (
                    <Pressable
                        key={cat.id}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedCategory(cat.id);
                        }}
                        className={`flex-row items-center p-4 rounded-bubble mb-3 border ${selectedCategory === cat.id
                            ? "bg-iris/20 border-iris/50"
                            : "bg-midnight-100 border-white/10"
                            }`}
                    >
                        <Ionicons
                            name={cat.iconName}
                            size={24}
                            color={selectedCategory === cat.id ? "#8B5CF6" : "rgba(255,255,255,0.5)"}
                            style={{ marginRight: 16 }}
                        />
                        <View className="flex-1">
                            <Text className={`font-semibold ${selectedCategory === cat.id ? "text-iris" : "text-gold"
                                }`}>
                                {cat.label}
                            </Text>
                            <Text className="text-gold-stone text-sm">{cat.description}</Text>
                        </View>
                        {selectedCategory === cat.id && (
                            <Ionicons name="checkmark-circle" size={20} color="#8B5CF6" />
                        )}
                    </Pressable>
                ))}

                {/* Additional Details */}
                <Text className="text-gold font-semibold text-lg mb-3 mt-4">
                    Additional details (optional)
                </Text>
                <TextInput
                    placeholder="Tell us more about what happened..."
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                    className="bg-surface border border-white/10 rounded-bubble px-4 py-4 text-gold min-h-[120px] mb-6"
                    textAlignVertical="top"
                />

                {/* Safety Warning */}
                {selectedCategory === "safety" && (
                    <View className="bg-red-500/20 border border-red-500/50 rounded-bubble p-4 mb-6">
                        <Text className="text-red-400 font-semibold mb-2">Safety First</Text>
                        <Text className="text-red-300 text-sm">
                            If you're in immediate danger, please contact local emergency services.
                            Venue security can also help if you're at an event.
                        </Text>
                    </View>
                )}

                {/* Submit Button */}
                <Pressable
                    onPress={handleSubmit}
                    disabled={!selectedCategory || loading}
                    className={`py-4 rounded-pill items-center ${selectedCategory && !loading ? "bg-red-600" : "bg-red-600/50"
                        }`}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="text-white font-semibold text-lg">Submit Report</Text>
                    )}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
